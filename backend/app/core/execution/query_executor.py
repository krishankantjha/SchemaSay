import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.config import settings


@dataclass
class QueryResult:
    success: bool
    error_message: Optional[str]
    columns: Optional[List[str]]
    rows: Optional[List[Dict[str, Any]]]
    execution_time_ms: float
    truncated: bool = False

    def __iter__(self):
        return iter((self.success, self.error_message, self.columns, self.rows, self.execution_time_ms))


logger = logging.getLogger("schemasay.query_executor")


def parse_database_exception(err: Exception, db_type: str) -> str:
    """Map driver exceptions to safe, stable user-facing messages."""
    err_msg = str(err).lower()
    db_type = db_type.lower()

    if any(
        marker in err_msg
        for marker in (
            "timeout",
            "canceling statement",
            "canceled",
            "timed out",
            "execution time exceeded",
            "interrupted",
            "query aborted",
        )
    ):
        return "Query execution cancelled: The operation exceeded the 30-second time limit."

    if db_type in {"sqlite", "file_upload"}:
        if "no such table" in err_msg:
            return "Database Error: The requested table does not exist."
        if "no such column" in err_msg:
            return "Database Error: The requested column does not exist."
        if "syntax error" in err_msg:
            return "Database Error: SQL syntax error. Please verify the SELECT statement format."
    elif db_type == "postgresql":
        if "relation" in err_msg and "does not exist" in err_msg:
            return "Database Error: The requested table does not exist."
        if "column" in err_msg and "does not exist" in err_msg:
            return "Database Error: The requested column does not exist."
        if "syntax error" in err_msg:
            return "Database Error: SQL syntax error near the query keywords."
    elif db_type == "mysql":
        if "table" in err_msg and "doesn't exist" in err_msg:
            return "Database Error: The requested table does not exist."
        if "unknown column" in err_msg:
            return "Database Error: The requested column does not exist."

    return "Database Execution Error: An unexpected database error occurred during query execution."


def _validate_frame_limits(frame: pd.DataFrame) -> None:
    if len(frame.columns) > settings.MAX_QUERY_COLUMNS:
        raise ValueError("Query result exceeded the maximum column limit")
    for column in frame.columns:
        lengths = frame[column].astype("string").str.len()
        if not lengths.empty and lengths.max(skipna=True) > settings.MAX_QUERY_CELL_BYTES:
            raise ValueError("Query result contains a value larger than the maximum cell size")


def execute_query(engine: Engine, sql_query: str, db_type: str) -> QueryResult:
    """Execute a validated query with bounded result materialization."""
    start_time = time.perf_counter()
    db_type_lower = db_type.lower()
    truncated = False

    try:
        with engine.connect() as conn:
            if db_type_lower == "postgresql":
                conn.execute(text("SET statement_timeout = 30000"))
            elif db_type_lower == "mysql":
                conn.execute(text("SET max_execution_time = 30000"))

            chunks: list[pd.DataFrame] = []
            loaded_rows = 0
            result_columns: list[str] | None = None
            for chunk in pd.read_sql_query(sql_query, conn, chunksize=2000):
                if result_columns is None:
                    result_columns = list(chunk.columns)
                    if len(result_columns) > settings.MAX_QUERY_COLUMNS:
                        raise ValueError("Query result exceeded the maximum column limit")
                remaining = settings.MAX_QUERY_ROWS - loaded_rows
                if remaining <= 0:
                    truncated = True
                    break
                if len(chunk) > remaining:
                    chunk = chunk.iloc[:remaining]
                    truncated = True
                _validate_frame_limits(chunk)
                chunks.append(chunk)
                loaded_rows += len(chunk)
                if loaded_rows >= settings.MAX_QUERY_ROWS:
                    truncated = True
                    break

            df = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()

        execution_duration_ms = (time.perf_counter() - start_time) * 1000.0
        return QueryResult(
            success=True,
            error_message=None,
            columns=list(df.columns),
            rows=df.to_dict(orient="records"),
            execution_time_ms=execution_duration_ms,
            truncated=truncated,
        )
    except ValueError as exc:
        execution_duration_ms = (time.perf_counter() - start_time) * 1000.0
        return QueryResult(False, str(exc), None, None, execution_duration_ms)
    except Exception as exc:
        execution_duration_ms = (time.perf_counter() - start_time) * 1000.0
        parsed_error = parse_database_exception(exc, db_type_lower)
        logger.error("Query execution failed: %s", parsed_error)
        return QueryResult(False, parsed_error, None, None, execution_duration_ms)
