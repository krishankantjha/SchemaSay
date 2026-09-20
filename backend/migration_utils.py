"""Shared helpers for Alembic migrations (SQLite + PostgreSQL)."""

from __future__ import annotations

import json
import time
from pathlib import Path

from alembic import op
from sqlalchemy import inspect

_LOG_PATH = Path(__file__).resolve().parents[1] / "debug-623df6.log"


def _agent_log(message: str, data: dict, hypothesis_id: str) -> None:
    # #region agent log
    try:
        payload = {
            "sessionId": "623df6",
            "timestamp": int(time.time() * 1000),
            "location": "migration_utils.py",
            "message": message,
            "data": data,
            "hypothesisId": hypothesis_id,
        }
        with _LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload) + "\n")
    except OSError:
        pass
    # #endregion


def has_table(table: str) -> bool:
    """Return True if ``table`` exists in the connected database."""
    bind = op.get_bind()
    inspector = inspect(bind)
    names = inspector.get_table_names()
    exists = table in names
    _agent_log("has_table", {"table": table, "dialect": bind.dialect.name, "exists": exists}, "H1")
    return exists


def has_index(table: str, index_name: str) -> bool:
    """Return True if ``index_name`` exists on ``table``."""
    bind = op.get_bind()
    inspector = inspect(bind)
    if table not in inspector.get_table_names():
        _agent_log("has_index", {"table": table, "index": index_name, "exists": False}, "H2")
        return False
    index_names = {idx["name"] for idx in inspector.get_indexes(table)}
    exists = index_name in index_names
    _agent_log(
        "has_index",
        {"table": table, "index": index_name, "dialect": bind.dialect.name, "exists": exists},
        "H2",
    )
    return exists


def has_column(table: str, column: str) -> bool:
    """Return True if ``table.column`` exists in the connected database."""
    bind = op.get_bind()
    inspector = inspect(bind)
    if table not in inspector.get_table_names():
        _agent_log("has_column", {"table": table, "column": column, "exists": False}, "H3")
        return False
    exists = column in {col["name"] for col in inspector.get_columns(table)}
    _agent_log(
        "has_column",
        {"table": table, "column": column, "dialect": bind.dialect.name, "exists": exists},
        "H3",
    )
    return exists
