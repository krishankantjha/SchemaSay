"""Validate connection schema alias targets against cached schema metadata."""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.connection import DatabaseSchemaCache

_ALIAS_TOKEN_RE = re.compile(r"^[a-z][a-z0-9_]*$")


def normalize_alias_token(token: str) -> str:
    """Lowercase and convert spaces/hyphens to underscores for storage."""
    text = token.strip().lower()
    text = re.sub(r"[\s\-]+", "_", text)
    text = re.sub(r"_+", "_", text)
    return text.strip("_")


def validate_alias_token(token: str) -> Optional[str]:
    """Return an error message when the token is invalid."""
    normalized = normalize_alias_token(token)
    if len(normalized) < 2:
        return "Alias must be at least 2 characters"
    if len(normalized) > 128:
        return "Alias must be at most 128 characters"
    if not _ALIAS_TOKEN_RE.match(normalized):
        return "Alias must start with a letter and contain only letters, numbers, or underscores"
    return None


def load_schema_index(db: Session, connection_id: int) -> Dict[str, List[str]]:
    rows = (
        db.query(DatabaseSchemaCache)
        .filter(DatabaseSchemaCache.connection_id == connection_id)
        .order_by(DatabaseSchemaCache.table_name, DatabaseSchemaCache.column_name)
        .all()
    )
    index: Dict[str, List[str]] = {}
    for row in rows:
        index.setdefault(row.table_name, []).append(row.column_name)
    return index


def resolve_schema_target(
    schema_index: Dict[str, List[str]],
    target_table: str,
    target_column: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Resolve table/column names case-insensitively against cached schema.
    Returns (canonical_table, canonical_column, error_message).
    """
    if not schema_index:
        return None, None, "Sync schema before adding aliases"

    table_key = target_table.strip().lower()
    canonical_table = next((name for name in schema_index if name.lower() == table_key), None)
    if not canonical_table:
        return None, None, f"Table '{target_table}' was not found in synced schema"

    if target_column is None:
        return canonical_table, None, None

    column_key = target_column.strip().lower()
    canonical_column = next(
        (name for name in schema_index[canonical_table] if name.lower() == column_key),
        None,
    )
    if not canonical_column:
        return None, None, f"Column '{target_column}' was not found on table '{canonical_table}'"

    return canonical_table, canonical_column, None
