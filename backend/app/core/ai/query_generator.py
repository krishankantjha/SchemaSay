import re
import threading
import logging
from typing import List, Dict, Optional
from openai import OpenAI
from app.config import settings

logger = logging.getLogger("schemasay.generator")

# Global OpenAI client cache with a thread lock to prevent connection leaks across concurrent requests
_llm_clients = {}
_client_lock = threading.Lock()

def get_cached_client(api_key: str, base_url: Optional[str] = None) -> OpenAI:
    """
    Retrieves a cached OpenAI client registry instance or instantiates one securely.
    Reusable socket pools reduce latency.
    """
    cache_key = (api_key, base_url)
    if cache_key in _llm_clients:
        return _llm_clients[cache_key]
        
    with _client_lock:
        if cache_key not in _llm_clients:
            if base_url:
                _llm_clients[cache_key] = OpenAI(api_key=api_key, base_url=base_url)
            else:
                _llm_clients[cache_key] = OpenAI(api_key=api_key)
        return _llm_clients[cache_key]

def is_api_key_valid(key: Optional[str]) -> bool:
    """
    Validates that a configured third-party API key exists and is not
    a default placeholder string.
    """
    if not key:
        return False
    sanitized = key.strip().lower()
    placeholders = {
        "", "none", "null", "your-openai-key-here", "your-gemini-key-here",
        "placeholder", "your_openai_key", "your_gemini_key"
    }
    return sanitized not in placeholders

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

def generate_sql_from_question(question: str, db_type: str, schema_metadata: List[Dict]) -> str:
    """
    Main generator routing queries to online LLM APIs (Gemini/OpenAI) or falling back
    to the Smart Heuristic Offline Compiler.
    """
    gemini_active = is_api_key_valid(settings.GEMINI_API_KEY)
    openai_active = is_api_key_valid(settings.OPENAI_API_KEY)

    # Sanitize user question to prevent prompt injection overrides
    sanitized_question = sanitize_prompt_input(question)

    if not gemini_active and not openai_active:
        return heuristic_offline_compiler(sanitized_question, db_type, schema_metadata)

    # Context window protection: limit schema context elements to a max of 200 items
    max_schema_items = 200
    is_truncated = False
    if len(schema_metadata) > max_schema_items:
        schema_metadata = schema_metadata[:max_schema_items]
        is_truncated = True

    # Format schema context for the LLM
    schema_context = []
    for entry in schema_metadata:
        schema_context.append(
            f"Table: {entry['table_name']}, Column: {entry['column_name']}, Type/Constraint: {entry['data_type']}"
        )
    schema_str = "\n".join(schema_context)

    truncation_warning = ""
    if is_truncated:
        truncation_warning = "\nWARNING: The database schema is very large and has been truncated. Focus strictly on these tables."

    system_prompt = (
        f"You are a SQL expert query generator. Your task is to translate natural language questions "
        f"into clean, valid {db_type} SQL select queries. You are provided with the target database schema:\n"
        f"{schema_str}{truncation_warning}\n\n"
        f"CRITICAL INSTRUCTIONS:\n"
        f"1. Generate only a read-only SELECT statement.\n"
        f"2. Output only the raw SQL query. Do not wrap the output in markdown code blocks or add text. "
        f"Do not write conversational sentences.\n"
        f"3. Make sure table and column names exactly match the schema above.\n"
        f"4. If the schema has no relevant tables or data targets to answer the question, output 'SELECT 1'."
    )

    try:
        if gemini_active:
            # Instantiate/Fetch cached Gemini compatibility client
            client = get_cached_client(
                api_key=settings.GEMINI_API_KEY,
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
            )
            response = client.chat.completions.create(
                model="gemini-1.5-flash",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": sanitized_question}
                ],
                temperature=0.0
            )
            sql = response.choices[0].message.content
        else:
            # Fallback to OpenAI GPT
            client = get_cached_client(api_key=settings.OPENAI_API_KEY)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": sanitized_question}
                ],
                temperature=0.0
            )
            sql = response.choices[0].message.content

        # Strip any markdown code block markers that the LLM may have added
        sql = sql.replace("```sql", "").replace("```", "").strip()
        return sql
    except Exception as e:
        logger.error(f"AI compilation failed, falling back to heuristic offline compiler: {str(e)}")
        return heuristic_offline_compiler(sanitized_question, db_type, schema_metadata)
