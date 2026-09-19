"""FK graph join assembly for the heuristic compiler (Phase 3 aware)."""

from __future__ import annotations

from typing import List, Optional, Set

from app.core.ai.heuristic_schema_intel import JoinPlanResult, classify_tables, plan_joins
from app.core.schema.graph import SchemaGraph


def build_join_plan(
    primary_table: str,
    target_tables: List[str],
    graph: SchemaGraph,
    *,
    mentioned_tables: Optional[Set[str]] = None,
    required_tables: Optional[Set[str]] = None,
) -> Optional[JoinPlanResult]:
    """Full join plan with ambiguity, dedup risk, and path metadata."""
    return plan_joins(
        primary_table,
        target_tables,
        graph,
        mentioned_tables=mentioned_tables,
        required_tables=required_tables,
        profiles=classify_tables(graph),
    )
