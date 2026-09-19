import re
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.config import settings
from app.core.ai.heuristic_aliases import AliasContext
from app.core.ai.heuristic_compiler import compile_heuristic
from app.core.ai.heuristic_routing import (
    RouteAction,
    decide_heuristic_route,
    should_use_heuristic_result,
)
from app.core.ai.heuristic_validation import validate_heuristic_sql
from app.core.ai.llm_client import (
    complete_chat_with_fallback,
    list_llm_clients,
)
from app.core.grounding.validator import validate_sql_grounding
from app.core.schema.graph import SchemaGraph
from app.core.security.sql_validator import validate_sql_structure

logger = logging.getLogger("schemasay.generator")


def sanitize_prompt_input(text: str) -> str:
    """
    Strips raw control character symbols and blocks instruction overrides
    to mitigate prompt injection attacks.
    """
    cleaned = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
    override_pattern = r'(?i)(ignore\s+all\s+previous|ignore\s+all\s+instructions|forget\s+all\s+previous|forget\s+all\s+instructions|system\s+prompt|system\s+override|instruction\s+override|override\s+system|override\s+instruction|developer\s+instruction)'
    cleaned = re.sub(override_pattern, '', cleaned)
    return cleaned.strip()


@dataclass
class SqlGenerationResult:
    sql: str
    used_llm: bool
    provider: Optional[str] = None
    model: Optional[str] = None
    heuristic_confidence: Optional[float] = None
    heuristic_tier: Optional[str] = None
    heuristic_intent: Optional[str] = None
    calibrated_confidence: Optional[float] = None
    routing_decision: Optional[str] = None
    validation_passed: Optional[bool] = None
    component_confidence: Optional[Dict[str, float]] = None
    validation_issues: List[str] = field(default_factory=list)


def extract_sql(text: str) -> str:
    """Strip markdown fences and keep the first SELECT/WITH/PRAGMA statement."""
    if not text:
        return ""
    cleaned = text.replace("```sql", "").replace("```", "").strip()
    match = re.search(r"(?is)\b(with|select|pragma)\b", cleaned)
    if match:
        cleaned = cleaned[match.start():]
    return cleaned.strip().rstrip(";").strip()


def _is_heuristic_grounded(sql: str, graph: SchemaGraph) -> bool:
    """True when compiled SQL references only known schema objects."""
    if not graph.tables:
        return True
    grounding = validate_sql_grounding(sql, graph)
    return (
        grounding.valid
        and not grounding.unknown_tables
        and not grounding.unknown_columns
    )


def _heuristic_result_payload(heuristic, validation=None, route=None) -> dict:
    payload = {
        "heuristic_confidence": heuristic.confidence,
        "heuristic_tier": heuristic.tier,
        "heuristic_intent": heuristic.intent,
    }
    if validation:
        payload["calibrated_confidence"] = validation.calibrated_confidence
        payload["validation_passed"] = validation.can_execute
        payload["component_confidence"] = {
            "table": validation.component.table,
            "column": validation.component.column,
            "join": validation.component.join,
            "aggregation": validation.component.aggregation,
        }
        payload["validation_issues"] = validation.issues
    if route:
        payload["routing_decision"] = route.action.value
    return payload


def _validate_llm_sql(sql: str, db_type: str, graph: SchemaGraph) -> tuple[bool, List[str]]:
    issues: List[str] = []
    safe, err = validate_sql_structure(sql, db_type)
    if not safe:
        issues.append(f"safety:{err}")
    grounding = validate_sql_grounding(sql, graph)
    if not grounding.valid:
        issues.extend(grounding.warnings)
    return len(issues) == 0, issues


def generate_sql(
    question: str,
    db_type: str,
    schema_metadata: List[Dict],
    verified_examples: Optional[List[Dict]] = None,
    alias_context: Optional[AliasContext] = None,
) -> SqlGenerationResult:
    """
    Translate natural language to SQL.

    Resolution order:
    1. High-confidence verified learning example
    2. Heuristic compiler with tier-based routing (L1/L2 execute, L3 validate)
    3. LLM for ambiguous / ungrounded / complex questions
    4. Heuristic fallback when LLM fails
    """
    sanitized_question = sanitize_prompt_input(question)

    if verified_examples:
        from app.core.learning.retrieval import pick_high_confidence_example, VerifiedExample

        examples = [
            VerifiedExample(
                question=item["question"],
                sql=item["sql"],
                similarity=item.get("similarity", 1.0),
                source=item.get("source", "verified"),
            )
            for item in verified_examples
        ]
        direct_match = pick_high_confidence_example(sanitized_question, examples)
        if direct_match:
            logger.info("Using high-confidence verified example for SQL generation.")
            return SqlGenerationResult(
                sql=direct_match.sql,
                used_llm=False,
                provider="learning_example",
            )

    schema_graph = SchemaGraph.from_schema_metadata(schema_metadata)
    heuristic = compile_heuristic(
        sanitized_question,
        db_type,
        schema_metadata,
        alias_context=alias_context or AliasContext.global_defaults(),
    )

    route = decide_heuristic_route(heuristic)
    require_semantic = route.action == RouteAction.HEURISTIC_VALIDATE

    if route.action in (RouteAction.HEURISTIC_EXECUTE, RouteAction.HEURISTIC_VALIDATE) and heuristic.sql:
        validation = validate_heuristic_sql(
            sql=heuristic.sql,
            db_type=db_type,
            graph=schema_graph,
            heuristic=heuristic,
            require_semantic=require_semantic,
        )
        if should_use_heuristic_result(route, validation):
            logger.info(
                "Using heuristic (%s, route=%s, tier=%s, compile=%.2f, calibrated=%.2f).",
                route.reason,
                route.action.value,
                heuristic.tier,
                heuristic.confidence,
                validation.calibrated_confidence,
            )
            return SqlGenerationResult(
                sql=heuristic.sql,
                used_llm=False,
                provider="heuristic",
                **_heuristic_result_payload(heuristic, validation, route),
            )
        logger.info(
            "Heuristic validation failed (route=%s, tier=%s, issues=%s); escalating to LLM.",
            route.action.value,
            heuristic.tier,
            validation.issues,
        )

    if not list_llm_clients():
        sql = heuristic.sql if heuristic.sql else "SELECT 1"
        logger.info(
            "No LLM configured; using heuristic fallback (tier=%s, confidence=%.2f).",
            heuristic.tier,
            heuristic.confidence,
        )
        return SqlGenerationResult(
            sql=sql,
            used_llm=False,
            provider="heuristic",
            routing_decision=RouteAction.FALLBACK.value,
            **_heuristic_result_payload(heuristic),
        )

    max_schema_items = 200
    is_truncated = False
    llm_schema = schema_metadata
    if len(schema_metadata) > max_schema_items:
        llm_schema = schema_metadata[:max_schema_items]
        is_truncated = True

    schema_context = []
    for entry in llm_schema:
        schema_context.append(
            f"Table: {entry['table_name']}, Column: {entry['column_name']}, Type/Constraint: {entry['data_type']}"
        )
    schema_str = "\n".join(schema_context)

    truncation_warning = ""
    if is_truncated:
        truncation_warning = (
            "\nWARNING: The database schema is very large and has been truncated. "
            "Focus strictly on these tables."
        )

    examples_block = ""
    if verified_examples:
        from app.core.learning.retrieval import VerifiedExample, format_examples_for_prompt

        examples = [
            VerifiedExample(
                question=item["question"],
                sql=item["sql"],
                similarity=item.get("similarity", 0.0),
                source=item.get("source", "verified"),
            )
            for item in verified_examples
        ]
        formatted = format_examples_for_prompt(examples)
        if formatted:
            examples_block = f"\n{formatted}\n"

    system_prompt = (
        f"You are a SQL expert query generator. Your task is to translate natural language questions "
        f"into clean, valid {db_type} SQL select queries. You are provided with the target database schema:\n"
        f"{schema_str}{truncation_warning}\n"
        f"{examples_block}\n"
        f"CRITICAL INSTRUCTIONS:\n"
        f"1. Generate only a read-only SELECT statement.\n"
        f"2. Output only the raw SQL query. Do not wrap the output in markdown code blocks or add text. "
        f"Do not write conversational sentences.\n"
        f"3. Make sure table and column names exactly match the schema above.\n"
        f"4. If the schema has no relevant tables or data targets to answer the question, output 'SELECT 1'."
    )

    try:
        completion = complete_chat_with_fallback(
            system_prompt=system_prompt,
            user_prompt=sanitized_question,
            temperature=0.0,
            timeout=settings.LLM_TIMEOUT_SECONDS,
            max_tokens=800,
        )
        sql = extract_sql(completion.content)
        if not sql:
            raise RuntimeError("LLM returned no SQL statement.")

        llm_valid, llm_issues = _validate_llm_sql(sql, db_type, schema_graph)
        if not llm_valid:
            logger.warning("LLM SQL failed validation (%s); attempting heuristic fallback.", llm_issues)
            if heuristic.sql:
                fallback_validation = validate_heuristic_sql(
                    sql=heuristic.sql,
                    db_type=db_type,
                    graph=schema_graph,
                    heuristic=heuristic,
                    require_semantic=False,
                )
                if fallback_validation.safety_valid and fallback_validation.grounding_valid:
                    return SqlGenerationResult(
                        sql=heuristic.sql,
                        used_llm=False,
                        provider="heuristic",
                        routing_decision=RouteAction.FALLBACK.value,
                        **_heuristic_result_payload(heuristic, fallback_validation),
                    )
            raise RuntimeError("LLM SQL failed safety/grounding validation.")

        logger.info("SQL generated via %s (%s).", completion.provider, completion.model)
        return SqlGenerationResult(
            sql=sql,
            used_llm=True,
            provider=completion.provider,
            model=completion.model,
            routing_decision=RouteAction.LLM.value,
            validation_passed=llm_valid,
        )
    except Exception as e:
        logger.error(
            "AI compilation failed, falling back to heuristic offline compiler: %s",
            str(e),
        )
        fallback_sql = heuristic.sql if heuristic.sql else "SELECT 1"
        fallback_validation = None
        if heuristic.sql:
            fallback_validation = validate_heuristic_sql(
                sql=heuristic.sql,
                db_type=db_type,
                graph=schema_graph,
                heuristic=heuristic,
                require_semantic=False,
            )
        return SqlGenerationResult(
            sql=fallback_sql,
            used_llm=False,
            provider="heuristic",
            routing_decision=RouteAction.FALLBACK.value,
            **_heuristic_result_payload(heuristic, fallback_validation),
        )


def generate_sql_from_question(
    question: str,
    db_type: str,
    schema_metadata: List[Dict],
    verified_examples: Optional[List[Dict]] = None,
    alias_context: Optional[AliasContext] = None,
) -> str:
    """Compatibility wrapper that returns only the generated SQL string."""
    return generate_sql(
        question, db_type, schema_metadata, verified_examples, alias_context=alias_context
    ).sql
