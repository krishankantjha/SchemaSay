import sqlglot

DIALECTS = {
    "postgresql": "postgres",
    "mysql": "mysql",
    "mssql": "tsql",
    "sqlite": "sqlite",
    "file_upload": "sqlite",
}


def wrap_query_with_limit(sql: str, db_type: str, limit: int = 10_000) -> str:
    """Add a hard row limit through the parsed AST for the target dialect."""
    if not 1 <= limit <= 100_000:
        raise ValueError("Query limit must be between 1 and 100000")
    dialect = DIALECTS.get((db_type or "").lower())
    expression = sqlglot.parse_one(sql.strip().rstrip(";"), read=dialect) if dialect else sqlglot.parse_one(sql.strip().rstrip(";"))

    existing_limit = expression.args.get("limit")
    existing_top = expression.args.get("top")
    if existing_limit is None and existing_top is None:
        expression = expression.limit(limit)

    return expression.sql(dialect=dialect) if dialect else expression.sql()
