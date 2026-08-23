from __future__ import annotations

import re
from typing import Tuple

import sqlglot
from sqlglot import exp

DIALECTS = {
    "postgresql": "postgres",
    "mysql": "mysql",
    "mssql": "tsql",
    "sqlite": "sqlite",
    "file_upload": "sqlite",
}

BLOCKED_FUNCTIONS = {
    "pg_sleep", "sleep", "waitfor", "load_file", "readfile", "writefile",
    "load_extension", "dblink", "lo_import", "lo_export", "pg_read_file",
    "pg_read_binary_file", "pg_ls_dir", "openrowset", "opendatasource",
}
LOCKING_PATTERN = re.compile(r"\bfor\s+(?:no\s+key\s+)?(?:update|share|key\s+share)\b", re.IGNORECASE)
BLOCKED_NODES = (
    exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Alter, exp.Create,
    exp.Merge, exp.Command, exp.TruncateTable, exp.Union, exp.Into,
)


def validate_sql_structure(raw_sql: str, db_type: str = "generic") -> Tuple[bool, str]:
    """Validate one dialect-specific, read-only SELECT statement."""
    if not raw_sql or len(raw_sql) > 10_000:
        return False, "Access Denied: Query must contain between 1 and 10,000 characters."
    if "\x00" in raw_sql:
        return False, "Access Denied: Control characters are not allowed in SQL."

    dialect = DIALECTS.get((db_type or "").lower())
    try:
        expressions = sqlglot.parse(raw_sql, read=dialect) if dialect else sqlglot.parse(raw_sql)
    except Exception:
        return False, "SQL Syntax Error: Unable to parse the query for the target database dialect."

    if len(expressions) != 1:
        return False, "Access Denied: Stacked query statements containing semicolons are blocked for security."

    expr = expressions[0]
    for node in expr.walk():
        if isinstance(node, exp.Union):
            return False, "Access Denied: UNION operations are blocked for security."
        if isinstance(node, exp.Command):
            return False, "Access Denied: Stored procedure or utility query commands are blocked for security."
        if isinstance(node, BLOCKED_NODES):
            return False, "Access Denied: Unsafe mutating operation is blocked. The database is read-only."
        if isinstance(node, exp.Anonymous) and node.name.lower() in BLOCKED_FUNCTIONS:
            return False, f"Access Denied: Timing or restricted database function ({node.name}) is blocked for security."

    if not isinstance(expr, exp.Select):
        return False, "Access Denied: Only read-only SELECT statements are allowed."
    if LOCKING_PATTERN.search(raw_sql):
        return False, "Access Denied: Row-locking clauses are not allowed."
    return True, ""
