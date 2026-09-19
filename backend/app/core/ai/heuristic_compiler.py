"""
SchemaSay heuristic NL→SQL compiler (target: L3).

Phase 1: intent detection, fuzzy resolution, hub scoring, ambiguity escalation.
Phase 2: advanced aggregations, filters, dates, multi-column GROUP BY, HAVING, ranking.
Phase 3: FK pathfinding, bridge/M2M joins, dedup protection, join ambiguity, JOIN elimination.
Phase 4: validation + routing handled in heuristic_validation.py and query_generator.py.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from app.core.ai.heuristic_aliases import AliasContext
from app.core.ai.heuristic_aggregations import (
    build_having_clause,
    build_select_clause,
    parse_group_dimensions,
)
from app.core.ai.heuristic_dates import find_date_column, group_date_expr
from app.core.ai.heuristic_filters import build_where_clause
from app.core.ai.heuristic_intent import IntentResult, QueryIntent, detect_intent
from app.core.ai.heuristic_joins import build_join_plan
from app.core.ai.heuristic_schema_intel import (
    apply_duplicate_protection,
    assess_duplicate_risk,
    classify_tables,
    detect_join_ambiguity_for_targets,
)
from app.core.ai.heuristic_resolution import (
    score_columns,
    score_tables,
    should_escalate_for_ambiguity,
)
from app.core.schema.graph import SchemaGraph

HEURISTIC_CONFIDENCE_HIGH = 0.85
HEURISTIC_CONFIDENCE_MEDIUM = 0.60

_L4_REASONING = re.compile(
    r"\b("
    r"compare|comparison|versus|vs\.?|trend|trends|why|likely|churn|forecast|predict|"
    r"recommend|should we|best way|anomaly|unusual|correlat|impact of|what if|"
    r"explain|insight|dashboard"
    r")\b",
    re.IGNORECASE,
)

_LISTING_VERBS = re.compile(
    r"\b(show|list|display|get|see|view|fetch|give me)\b",
    re.IGNORECASE,
)

_SQL_INJECTION = re.compile(
    r";\s*(drop|delete|insert|update|alter|truncate)\b|--\s*$|\b(drop|truncate)\s+table\b",
    re.IGNORECASE,
)

_AGG_TYPES = frozenset({"count", "sum", "avg", "min", "max", "count_distinct", "ratio", "percentage"})
_DIMENSION_TABLES = frozenset(
    {"products", "users", "customers", "categories", "brands", "regions", "employees", "accounts"}
)


@dataclass
class HeuristicCompileResult:
    sql: Optional[str]
    confidence: float
    tier: str
    matched_tables: List[str] = field(default_factory=list)
    should_escalate: bool = False
    reasons: List[str] = field(default_factory=list)
    intent: Optional[str] = None


def compile_heuristic(
    question: str,
    db_type: str,
    schema_metadata: List[Dict],
    alias_context: Optional[AliasContext] = None,
) -> HeuristicCompileResult:
    """Compile natural language to SQL with confidence scoring."""
    reasons: List[str] = []
    confidence = 0.0
    aliases = alias_context or AliasContext.global_defaults()

    if not schema_metadata:
        return HeuristicCompileResult(
            sql="SELECT 1",
            confidence=0.0,
            tier="L0",
            should_escalate=True,
            reasons=["empty_schema"],
        )

    if _L4_REASONING.search(question):
        return HeuristicCompileResult(
            sql=None,
            confidence=0.0,
            tier="L4",
            should_escalate=True,
            reasons=["business_reasoning_detected"],
        )

    if _SQL_INJECTION.search(question):
        return HeuristicCompileResult(
            sql=None,
            confidence=0.0,
            tier="escalate",
            should_escalate=True,
            reasons=["sql_injection_pattern"],
        )

    intent_result = detect_intent(question)
    reasons.append(f"intent={intent_result.primary.value}")
    reasons.extend(intent_result.signals)

    tables_columns, column_types = _build_schema_maps(schema_metadata)
    graph = SchemaGraph.from_schema_metadata(schema_metadata)
    table_profiles = classify_tables(graph)
    question_lower = question.lower()
    db_type_lower = db_type.lower()

    table_resolution = score_tables(question_lower, tables_columns, graph, aliases)
    if not table_resolution.primary:
        return HeuristicCompileResult(
            sql=None,
            confidence=0.0,
            tier="escalate",
            should_escalate=True,
            reasons=reasons + ["no_table_match"],
            intent=intent_result.primary.value,
        )

    primary_table = table_resolution.primary
    matched_tables = table_resolution.matched_names
    top_score = table_resolution.matches[0].score if table_resolution.matches else 0.0
    reasons.append(f"primary_table={primary_table}")

    confidence += 0.25
    if top_score >= 10:
        confidence += 0.20
        reasons.append("explicit_table_name")
    elif top_score >= 8:
        confidence += 0.15
        reasons.append("alias_or_fuzzy_table")

    agg = intent_result.aggregation
    columns = tables_columns[primary_table]
    table_col_types = column_types.get(primary_table, {})

    prefer_numeric = agg in ("sum", "avg", "min", "max", "ratio")
    prefer_date = intent_result.primary == QueryIntent.RANKING or "filtering" in intent_result.signals
    column_resolution = score_columns(
        question_lower,
        primary_table,
        columns,
        table_col_types,
        aliases,
        intent_result,
        prefer_numeric=prefer_numeric,
        prefer_date=prefer_date,
    )

    ambiguity = should_escalate_for_ambiguity(table_resolution, column_resolution, intent_result)
    if ambiguity:
        return HeuristicCompileResult(
            sql=None,
            confidence=confidence,
            tier="escalate",
            matched_tables=matched_tables,
            should_escalate=True,
            reasons=reasons + [ambiguity],
            intent=intent_result.primary.value,
        )

    limit_num, limit_clause = _extract_limit(question_lower, intent_result)

    ranking_kind = _classify_ranking(
        question_lower, intent_result, primary_table, columns, table_col_types, agg
    )
    metric_table, metric_col = None, None
    if ranking_kind == "entity" and agg in ("sum", "avg", "min", "max"):
        metric_table, metric_col = _find_metric_source(
            question_lower, primary_table, tables_columns, column_types, graph, aliases
        )
        if metric_table and metric_table != primary_table and metric_table not in matched_tables:
            matched_tables = list(dict.fromkeys(matched_tables + [metric_table]))

    if ranking_kind == "row" and agg in ("sum", "avg"):
        agg = None

    select_result = build_select_clause(
        question_lower,
        columns,
        table_col_types,
        agg,
        aliases,
        intent_result,
        column_resolution,
    )
    select_clause = select_result.select_clause
    order_expr = select_result.order_expr

    if ranking_kind == "entity" and agg in ("sum", "avg", "min", "max") and metric_col:
        qualified = f"{metric_table}.{metric_col}" if metric_table != primary_table else metric_col
        func = agg.upper()
        order_expr = f"{func}({qualified})"
        entity_col = _entity_group_column(columns)
        if entity_col:
            select_clause = f"{entity_col}, {order_expr}"
            reasons.append(f"ranking_entity={entity_col}")

    confidence += select_result.confidence
    if select_result.reason:
        reasons.append(select_result.reason)

    if agg in ("sum", "avg", "min", "max") and select_result.confidence == 0 and ranking_kind != "entity":
        return HeuristicCompileResult(
            sql=None,
            confidence=confidence,
            tier="escalate",
            matched_tables=matched_tables,
            should_escalate=True,
            reasons=reasons + ["numeric_column_unresolved"],
            intent=intent_result.primary.value,
        )

    if agg == "count_distinct" and select_result.confidence == 0:
        return HeuristicCompileResult(
            sql=None,
            confidence=confidence,
            tier="escalate",
            matched_tables=matched_tables,
            should_escalate=True,
            reasons=reasons + ["distinct_column_unresolved"],
            intent=intent_result.primary.value,
        )

    has_top_n = bool(re.search(r"\btop\s+\d+\b", question_lower))
    if agg in _AGG_TYPES and intent_result.primary != QueryIntent.RANKING and not has_top_n:
        limit_clause = ""
        limit_num = ""

    filter_result = build_where_clause(
        question_lower, columns, table_col_types, db_type_lower, aliases
    )
    where_clause = filter_result.where_clause
    confidence += filter_result.confidence
    reasons.extend(filter_result.reasons)

    group_clause, group_confidence, group_reason = _build_group_clause(
        question_lower, columns, table_col_types, db_type_lower, agg, aliases
    )
    if ranking_kind == "entity" and agg and not group_clause:
        entity_col = _entity_group_column(columns)
        if entity_col:
            group_clause = f"GROUP BY {entity_col}"
            group_confidence = 0.12
            group_reason = f"ranking_group={entity_col}"
    confidence += group_confidence
    if group_reason:
        reasons.append(group_reason)
    if group_reason == "group_dimension_unresolved":
        return HeuristicCompileResult(
            sql=None,
            confidence=confidence,
            tier="escalate",
            matched_tables=matched_tables,
            should_escalate=True,
            reasons=reasons,
            intent=intent_result.primary.value,
        )

    having_clause, having_confidence, having_reason = build_having_clause(
        question_lower, agg, order_expr or select_clause
    )
    confidence += having_confidence
    if having_reason:
        reasons.append(having_reason)

    order_clause, order_confidence = _build_order_clause(
        question_lower,
        columns,
        table_col_types,
        intent_result,
        order_expr,
        agg,
    )
    confidence += order_confidence

    from_clause = primary_table
    join_plan = None
    if len(matched_tables) > 1 or intent_result.primary == QueryIntent.JOIN:
        targets = list(dict.fromkeys(matched_tables))
        if metric_table and metric_table not in targets:
            targets.append(metric_table)
        mentioned = set(targets)
        required: set[str] = {primary_table}
        if metric_table:
            required.add(metric_table)

        join_ambiguity = detect_join_ambiguity_for_targets(
            primary_table, targets, graph, table_profiles, mentioned
        )
        if join_ambiguity and intent_result.primary != QueryIntent.JOIN:
            return HeuristicCompileResult(
                sql=None,
                confidence=confidence,
                tier="escalate",
                matched_tables=matched_tables,
                should_escalate=True,
                reasons=reasons + [join_ambiguity],
                intent=intent_result.primary.value,
            )

        join_plan = build_join_plan(
            primary_table,
            targets,
            graph,
            mentioned_tables=mentioned,
            required_tables=required,
        )
        if join_plan is None or join_plan.is_ambiguous or not join_plan.from_clause:
            return HeuristicCompileResult(
                sql=None,
                confidence=confidence,
                tier="escalate",
                matched_tables=matched_tables,
                should_escalate=True,
                reasons=reasons
                + ([join_plan.ambiguity_reason] if join_plan and join_plan.ambiguity_reason else ["join_unresolved"]),
                intent=intent_result.primary.value,
            )
        from_clause = join_plan.from_clause
        confidence += 0.10 + min(0.05 * max(len(join_plan.joined_tables) - 2, 0), 0.10)
        reasons.append(f"join_path={','.join(join_plan.joined_tables)}")
        reasons.extend(join_plan.reasons)

    duplicate_risk, dup_mitigation = assess_duplicate_risk(
        joined_tables=join_plan.joined_tables if join_plan else [primary_table],
        profiles=table_profiles,
        has_aggregation=bool(agg),
        has_group_by=bool(group_clause),
        agg=agg,
    )
    if duplicate_risk:
        reasons.append("duplicate_risk")
    protected_select, dup_reason = apply_duplicate_protection(
        select_clause,
        agg,
        duplicate_risk=duplicate_risk,
        mitigation=dup_mitigation,
        primary_table=primary_table,
        graph=graph,
    )
    if dup_reason:
        select_clause = protected_select
        reasons.append(dup_reason)

    sql = _assemble_query(
        select_clause=select_clause,
        from_clause=from_clause,
        where_clause=where_clause,
        group_clause=group_clause,
        having_clause=having_clause,
        order_clause=order_clause,
        limit_clause=limit_clause,
        limit_num=limit_num,
        db_type_lower=db_type_lower,
    )

    tier = _compute_tier(where_clause, group_clause, having_clause, agg)

    if top_score >= 8 and agg in _AGG_TYPES and select_result.confidence > 0:
        confidence = max(confidence, 0.90)
    elif top_score >= 8 and _LISTING_VERBS.search(question) and not group_clause:
        confidence = max(confidence, 0.88)

    should_escalate = confidence < HEURISTIC_CONFIDENCE_MEDIUM
    confidence = max(0.0, min(1.0, confidence))

    return HeuristicCompileResult(
        sql=sql,
        confidence=confidence,
        tier=tier,
        matched_tables=matched_tables,
        should_escalate=should_escalate,
        reasons=reasons,
        intent=intent_result.primary.value,
    )


def heuristic_offline_compiler(
    question: str,
    db_type: str,
    schema_metadata: List[Dict],
    alias_context: Optional[AliasContext] = None,
) -> str:
    result = compile_heuristic(question, db_type, schema_metadata, alias_context)
    return result.sql if result.sql else "SELECT 1"


def _build_schema_maps(
    schema_metadata: List[Dict],
) -> Tuple[Dict[str, List[str]], Dict[str, Dict[str, str]]]:
    tables_columns: Dict[str, List[str]] = {}
    column_types: Dict[str, Dict[str, str]] = {}

    for entry in schema_metadata:
        table = entry["table_name"]
        column = entry["column_name"]
        tables_columns.setdefault(table, []).append(column)
        column_types.setdefault(table, {})[column] = entry.get("data_type", "")

    return tables_columns, column_types


def _extract_limit(question_lower: str, intent: IntentResult) -> Tuple[str, str]:
    limit_match = re.search(r"\b(?:top|limit|first)\s+(\d+)\b", question_lower)
    if limit_match:
        num = limit_match.group(1)
        return num, f"LIMIT {num}"
    if re.search(r"\b(?:all|every)\b", question_lower):
        return "", ""
    if intent.primary == QueryIntent.RANKING:
        return "10", "LIMIT 10"
    if intent.primary == QueryIntent.LISTING:
        return "10", "LIMIT 10"
    return "10", "LIMIT 10"


def _build_group_clause(
    question_lower: str,
    columns: List[str],
    column_types: Dict[str, str],
    db_type_lower: str,
    agg: Optional[str],
    aliases: AliasContext,
) -> Tuple[str, float, Optional[str]]:
    if not agg:
        return "", 0.0, None

    dimensions = parse_group_dimensions(question_lower)
    if not dimensions:
        return "", 0.0, None

    exprs: List[str] = []
    for dimension in dimensions:
        expr = _group_dimension_expr(dimension, columns, column_types, db_type_lower, aliases)
        if expr:
            exprs.append(expr)

    if not exprs:
        return "", 0.0, "group_dimension_unresolved"
    return f"GROUP BY {', '.join(exprs)}", 0.15 + 0.03 * (len(exprs) - 1), f"group_by={','.join(dimensions)}"


def _group_dimension_expr(
    dimension: str,
    columns: List[str],
    column_types: Dict[str, str],
    db_type_lower: str,
    aliases: AliasContext,
) -> Optional[str]:
    date_col = find_date_column(columns, column_types)

    if dimension in ("month", "quarter", "year", "week", "day") and date_col:
        return group_date_expr(dimension, date_col, db_type_lower)

    col = aliases.resolve_column(dimension, columns)
    if col:
        return col
    for c in columns:
        if dimension in c.lower():
            return c
    return None


def _build_order_clause(
    question_lower: str,
    columns: List[str],
    column_types: Dict[str, str],
    intent: IntentResult,
    order_expr: Optional[str],
    agg: Optional[str],
) -> Tuple[str, float]:
    is_ranking = intent.primary == QueryIntent.RANKING or re.search(
        r"\b(latest|recent|newest|oldest|youngest|highest|lowest|top|bottom)\b", question_lower
    )
    if not is_ranking:
        return "", 0.0

    by_metric = re.search(
        r"\bby\s+(revenue|sales|price|amount|cost|quantity|count|total|name|\w+)\b",
        question_lower,
    )
    if by_metric and order_expr:
        direction = "ASC" if re.search(r"\b(lowest|bottom|oldest|smallest|least)\b", question_lower) else "DESC"
        return f"ORDER BY {order_expr} {direction}", 0.08

    if by_metric:
        metric = by_metric.group(1)
        for col in columns:
            if metric in col.lower() or col.lower() in metric:
                direction = "ASC" if re.search(r"\b(lowest|bottom|oldest)\b", question_lower) else "DESC"
                if agg and agg in _AGG_TYPES:
                    return f"ORDER BY {agg.upper()}({col}) {direction}", 0.08
                return f"ORDER BY {col} {direction}", 0.08

    date_col = find_date_column(columns, column_types)
    if date_col:
        direction = "ASC" if re.search(r"\b(oldest|lowest)\b", question_lower) else "DESC"
        return f"ORDER BY {date_col} {direction}", 0.05

    if order_expr and agg:
        direction = "DESC" if re.search(r"\b(top|highest|most)\b", question_lower) else "ASC"
        return f"ORDER BY {order_expr} {direction}", 0.06

    return "", 0.0


def _classify_ranking(
    question_lower: str,
    intent: IntentResult,
    primary_table: str,
    columns: List[str],
    column_types: Dict[str, str],
    agg: Optional[str],
) -> Optional[str]:
    if intent.primary != QueryIntent.RANKING and not re.search(r"\btop\s+\d+\b", question_lower):
        return None
    if re.search(r"\bgroup(?:ed)?\s+by\b", question_lower):
        return "grouped"
    if primary_table in _DIMENSION_TABLES or primary_table.rstrip("s") in {
        "product", "user", "customer", "category", "brand", "region", "employee", "account"
    }:
        return "entity"
    if agg and _has_local_metric(question_lower, columns, column_types):
        return "row"
    return "row"


def _has_local_metric(
    question_lower: str,
    columns: List[str],
    column_types: Dict[str, str],
) -> bool:
    for col in columns:
        dtype = column_types.get(col, "").lower()
        if any(k in dtype for k in ("int", "float", "decimal", "numeric", "real")):
            if re.search(r"\b" + re.escape(col.lower()) + r"\b", question_lower):
                return True
            for kw in ("price", "revenue", "amount", "sales", "cost", "quantity"):
                if kw in question_lower and kw in col.lower():
                    return True
    for kw in ("price", "revenue", "amount", "sales", "cost", "quantity"):
        if re.search(r"\b" + re.escape(kw) + r"\b", question_lower):
            for col in columns:
                if kw in col.lower():
                    return True
    return False


def _find_metric_source(
    question_lower: str,
    primary_table: str,
    tables_columns: Dict[str, List[str]],
    column_types: Dict[str, Dict[str, str]],
    graph: SchemaGraph,
    aliases: AliasContext,
) -> Tuple[Optional[str], Optional[str]]:
    primary_cols = tables_columns.get(primary_table, [])
    found = _find_numeric_on_table(
        question_lower, primary_cols, column_types.get(primary_table, {}), aliases
    )
    if found:
        return primary_table, found

    neighbors: List[str] = []
    for edge in graph.foreign_key_edges():
        if edge.from_table == primary_table and edge.to_table not in neighbors:
            neighbors.append(edge.to_table)
        if edge.to_table == primary_table and edge.from_table not in neighbors:
            neighbors.append(edge.from_table)

    for neighbor in neighbors:
        ncol = _find_numeric_on_table(
            question_lower,
            tables_columns.get(neighbor, []),
            column_types.get(neighbor, {}),
            aliases,
        )
        if ncol:
            return neighbor, ncol
    return None, None


def _find_numeric_on_table(
    question_lower: str,
    columns: List[str],
    column_types: Dict[str, str],
    aliases: AliasContext,
) -> Optional[str]:
    for kw in ("revenue", "sales", "price", "amount", "cost", "quantity", "total"):
        if re.search(r"\b" + re.escape(kw) + r"\b", question_lower):
            resolved = aliases.resolve_column(kw, columns)
            if resolved:
                return resolved
    for col in columns:
        if re.search(r"\b" + re.escape(col.lower()) + r"\b", question_lower):
            dtype = column_types.get(col, "").lower()
            if any(k in dtype for k in ("int", "float", "decimal", "numeric", "real")):
                return col
    for kw in ("price", "amount", "revenue", "sales", "cost", "quantity"):
        if re.search(r"\b" + re.escape(kw) + r"\b", question_lower):
            for col in columns:
                if kw in col.lower():
                    return col
    return None


def _entity_group_column(columns: List[str]) -> Optional[str]:
    for kw in ("name", "title", "label", "category"):
        for col in columns:
            if kw == col.lower() or col.lower().endswith(f"_{kw}"):
                return col
    for col in columns:
        if col.lower() == "id" or col.lower().endswith("_id"):
            continue
        if col.lower() in ("name", "title"):
            return col
    for col in columns:
        if "name" in col.lower():
            return col
    for col in columns:
        if col.lower() == "id":
            return col
    return columns[0] if columns else None


def _compute_tier(
    where_clause: str,
    group_clause: str,
    having_clause: str,
    agg: Optional[str],
) -> str:
    parts = sum(bool(x) for x in (where_clause, group_clause, having_clause, agg))
    if parts >= 2 or (group_clause and having_clause):
        return "L3"
    if parts >= 1 or agg:
        return "L2"
    return "L1"


def _assemble_query(
    *,
    select_clause: str,
    from_clause: str,
    where_clause: str,
    group_clause: str,
    having_clause: str,
    order_clause: str,
    limit_clause: str,
    limit_num: str,
    db_type_lower: str,
) -> str:
    if db_type_lower == "mssql" and limit_num and not group_clause and not having_clause:
        parts = [f"SELECT TOP {limit_num} {select_clause} FROM {from_clause}"]
    else:
        parts = [f"SELECT {select_clause} FROM {from_clause}"]

    if where_clause:
        parts.append(where_clause)
    if group_clause:
        parts.append(group_clause)
    if having_clause:
        parts.append(having_clause)
    if order_clause:
        parts.append(order_clause)
    if limit_clause and db_type_lower != "mssql":
        parts.append(limit_clause)
    elif limit_clause and db_type_lower == "mssql" and (group_clause or having_clause):
        parts.append(limit_clause)

    return " ".join(parts)
