import re
import logging
from dataclasses import dataclass
from typing import List, Dict, Optional

from app.config import settings
from app.core.ai.llm_client import (
    complete_chat_with_fallback,
    get_cached_client,
    is_api_key_valid,
    list_llm_clients,
)

logger = logging.getLogger("schemasay.generator")

_SIMPLE_LISTING = re.compile(
    r"\b(show|list|display|get|see|view|fetch)\b|\b(all|every)\b",
    re.IGNORECASE,
)
_AGGREGATION_QUESTION = re.compile(
    r"\b(count|sum|average|avg|total|how many|top\s+\d+|bottom|rate|percent|compare|trend)\b",
    re.IGNORECASE,
)


def _should_use_heuristic_first(question: str, schema_metadata: List[Dict]) -> bool:
    """Use the offline compiler for straightforward listing questions."""
    if not schema_metadata or _AGGREGATION_QUESTION.search(question):
        return False
    if not _SIMPLE_LISTING.search(question):
        return False
    q = question.lower()
    table_names = {entry["table_name"].lower() for entry in schema_metadata}
    return any(name in q for name in table_names)


def sanitize_prompt_input(text: str) -> str:
    """
    Strips raw control character symbols and blocks instruction overrides
    to mitigate prompt injection attacks.
    """
    # Strip ASCII control characters that may interfere with prompts
    cleaned = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
    # Remove common system prompt injection patterns
    override_pattern = r'(?i)(ignore\s+all\s+previous|ignore\s+all\s+instructions|forget\s+all\s+previous|forget\s+all\s+instructions|system\s+prompt|system\s+override|instruction\s+override|override\s+system|override\s+instruction|developer\s+instruction)'
    cleaned = re.sub(override_pattern, '', cleaned)
    return cleaned.strip()

def heuristic_offline_compiler(question: str, db_type: str, schema_metadata: List[Dict]) -> str:
    """
    Offline fallback compiler that matches natural language questions to cached database
    table and column schemas, generating clean read-only SQL queries rule-base.
    Supports SQLite, PostgreSQL, MySQL, and Microsoft SQL Server (MSSQL) limit dialects.
    """
    if not schema_metadata:
        return "SELECT 1"

    # Map tables and their column lists
    tables_columns = {}
    for entry in schema_metadata:
        t_name = entry["table_name"]
        if t_name not in tables_columns:
            tables_columns[t_name] = []
        tables_columns[t_name].append(entry["column_name"])

    question_lower = question.lower()
    db_type_lower = db_type.lower()
    
    # 1. Match referenced tables
    matched_tables = []
    for t_name in tables_columns.keys():
        if re.search(r'\b' + re.escape(t_name.lower()) + r'\b', question_lower):
            matched_tables.append(t_name)
            
    # Default to first table if none recognized
    primary_table = matched_tables[0] if matched_tables else list(tables_columns.keys())[0]

    # 2. Extract row limit
    limit_num = "10"
    limit_clause = "LIMIT 10"
    limit_match = re.search(r'\b(top|limit|first|show)\s+(\d+)\b', question_lower)
    if limit_match:
        limit_num = limit_match.group(2)
        limit_clause = f"LIMIT {limit_num}"
    elif re.search(r'\b(all|every)\b', question_lower):
        limit_clause = ""
        limit_num = ""

    # 3. Select columns
    selected_cols = []
    for col in tables_columns[primary_table]:
        if re.search(r'\b' + re.escape(col.lower()) + r'\b', question_lower):
            selected_cols.append(col)
            
    columns_clause = ", ".join(selected_cols) if selected_cols else "*"

    # 4. Handle aggregations (COUNT, SUM)
    is_count = any(word in question_lower for word in ["count", "total number", "how many"])
    if is_count:
        columns_clause = "COUNT(*)"
        limit_clause = ""
        limit_num = ""
        
    is_sum = any(word in question_lower for word in ["sum", "total", "amount", "cost"]) and not is_count
    if is_sum:
        numeric_keywords = ["price", "amount", "sales", "cost", "quantity", "value", "id"]
        target_num_col = None
        for kw in numeric_keywords:
            for col in tables_columns[primary_table]:
                if kw in col.lower():
                    target_num_col = col
                    break
            if target_num_col:
                break
        if target_num_col:
            columns_clause = f"SUM({target_num_col})"
            limit_clause = ""
            limit_num = ""

    # 5. Apply chronological ordering
    order_clause = ""
    is_chrono = any(word in question_lower for word in ["latest", "recent", "newest", "youngest"])
    if is_chrono:
        date_keywords = ["created_at", "updated_at", "date", "timestamp", "id"]
        target_date_col = None
        for kw in date_keywords:
            for col in tables_columns[primary_table]:
                if kw in col.lower():
                    target_date_col = col
                    break
            if target_date_col:
                break
        if target_date_col:
            order_clause = f"ORDER BY {target_date_col} DESC"

    # 6. Auto-join referenced tables using FK relationships
    if len(matched_tables) > 1:
        secondary_table = matched_tables[1]
        fk_col = None
        referred_col = None
        for entry in schema_metadata:
            if entry["table_name"] == primary_table and "FOREIGN KEY ->" in entry["data_type"]:
                ref_target = entry["data_type"].split("FOREIGN KEY -> ")[1].strip()
                if ref_target.startswith(secondary_table + "."):
                    fk_col = entry["column_name"]
                    referred_col = ref_target.split(".")[1]
                    break
                    
        # Check bidirectional FK mapping relation
        if not fk_col:
            for entry in schema_metadata:
                if entry["table_name"] == secondary_table and "FOREIGN KEY ->" in entry["data_type"]:
                    ref_target = entry["data_type"].split("FOREIGN KEY -> ")[1].strip()
                    if ref_target.startswith(primary_table + "."):
                        fk_col = ref_target.split(".")[1]
                        referred_col = entry["column_name"]
                        break

        if fk_col and referred_col:
            # Handle MSSQL SELECT TOP dialect conversion for JOIN query
            if db_type_lower == "mssql" and limit_num:
                query = f"SELECT TOP {limit_num} {columns_clause} FROM {primary_table} JOIN {secondary_table} ON {primary_table}.{fk_col} = {secondary_table}.{referred_col}"  # nosec B608: schema-derived identifiers; output is centrally validated
            else:
                query = f"SELECT {columns_clause} FROM {primary_table} JOIN {secondary_table} ON {primary_table}.{fk_col} = {secondary_table}.{referred_col}"  # nosec B608: schema-derived identifiers; output is centrally validated
                
            if order_clause:
                query += f" {order_clause}"
            if limit_clause and db_type_lower != "mssql":
                query += f" {limit_clause}"
            return query

    # Assemble simple select query based on dialect
    if db_type_lower == "mssql":
        # MSSQL select top mapping
        if limit_num:
            query_parts = [f"SELECT TOP {limit_num} {columns_clause} FROM {primary_table}"]  # nosec B608: schema-derived identifiers; output is centrally validated
        else:
            query_parts = [f"SELECT {columns_clause} FROM {primary_table}"]  # nosec B608: schema-derived identifiers; output is centrally validated
        if order_clause:
            query_parts.append(order_clause)
    else:
        # Standard SQL
        query_parts = [f"SELECT {columns_clause} FROM {primary_table}"]  # nosec B608: schema-derived identifiers; output is centrally validated
        if order_clause:
            query_parts.append(order_clause)
        if limit_clause:
            query_parts.append(limit_clause)

    return " ".join(query_parts)


@dataclass
class SqlGenerationResult:
    sql: str
    used_llm: bool
    provider: Optional[str] = None
    model: Optional[str] = None


def extract_sql(text: str) -> str:
    """Strip markdown fences and keep the first SELECT/WITH/PRAGMA statement."""
    if not text:
        return ""
    cleaned = text.replace("```sql", "").replace("```", "").strip()
    match = re.search(r"(?is)\b(with|select|pragma)\b", cleaned)
    if match:
        cleaned = cleaned[match.start():]
    return cleaned.strip().rstrip(";").strip()


def generate_sql(
    question: str,
    db_type: str,
    schema_metadata: List[Dict],
    verified_examples: Optional[List[Dict]] = None,
) -> SqlGenerationResult:
    """
    Translate a natural-language question into SQL using configured LLM providers,
    falling back to the heuristic compiler when no provider succeeds.
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

    heuristic_sql = heuristic_offline_compiler(sanitized_question, db_type, schema_metadata)

    if _should_use_heuristic_first(sanitized_question, schema_metadata):
        logger.info("Using heuristic compiler for simple listing question.")
        return SqlGenerationResult(sql=heuristic_sql, used_llm=False, provider="heuristic")

    if not list_llm_clients():
        return SqlGenerationResult(sql=heuristic_sql, used_llm=False, provider="heuristic")

    max_schema_items = 200
    is_truncated = False
    if len(schema_metadata) > max_schema_items:
        schema_metadata = schema_metadata[:max_schema_items]
        is_truncated = True

    schema_context = []
    for entry in schema_metadata:
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
        logger.info("SQL generated via %s (%s).", completion.provider, completion.model)
        return SqlGenerationResult(
            sql=sql,
            used_llm=True,
            provider=completion.provider,
            model=completion.model,
        )
    except Exception as e:
        logger.error(f"AI compilation failed, falling back to heuristic offline compiler: {str(e)}")
        return SqlGenerationResult(sql=heuristic_sql, used_llm=False, provider="heuristic")


def generate_sql_from_question(
    question: str,
    db_type: str,
    schema_metadata: List[Dict],
    verified_examples: Optional[List[Dict]] = None,
) -> str:
    """
    Compatibility wrapper that returns only the generated SQL string.
    """
    return generate_sql(question, db_type, schema_metadata, verified_examples).sql
