"""Shared helpers for Alembic migrations (SQLite + PostgreSQL)."""

from __future__ import annotations

from alembic import op
from sqlalchemy import inspect


def has_column(table: str, column: str) -> bool:
    """Return True if ``table.column`` exists in the connected database."""
    bind = op.get_bind()
    inspector = inspect(bind)
    if table not in inspector.get_table_names():
        return False
    return column in {col["name"] for col in inspector.get_columns(table)}
