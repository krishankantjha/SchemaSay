"""Result-aware validation: compare executed heuristic SQL against reference results."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.engine import Engine

from app.core.eval.compare import compare_aggregates, compare_results
from app.core.execution.query_executor import execute_query


def execute_reference_and_candidate(
    engine: Engine,
    db_type: str,
    reference_sql: str,
    candidate_sql: str,
) -> Tuple[bool, str, Optional[List[Dict]], Optional[List[Dict]]]:
    """Execute both SQL statements and compare row results."""
    ref_ok, _, _, ref_rows, _ = execute_query(engine, reference_sql, db_type)
    if not ref_ok:
        return False, "reference_execution_failed", None, None

    cand_ok, err, _, cand_rows, _ = execute_query(engine, candidate_sql, db_type)
    if not cand_ok:
        return False, f"candidate_execution_failed:{err}", ref_rows, None

    match, reason = compare_aggregates(cand_rows, ref_rows)
    if not match:
        match, reason = compare_results(cand_rows, ref_rows)
    return match, reason, ref_rows, cand_rows
