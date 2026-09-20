"""
Phase 4: SQL validation and confidence calibration for heuristic routing.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional, Set, Tuple

import sqlglot
from sqlglot import exp

from app.config import settings
from app.core.ai.heuristic_compiler import HEURISTIC_CONFIDENCE_MEDIUM, HeuristicCompileResult
from app.core.grounding.validator import GroundingResult, validate_sql_grounding
from app.core.schema.graph import JoinEdge, SchemaGraph
from app.core.security.sql_validator import validate_sql_structure


@dataclass
class ComponentConfidence:
    table: float = 0.0
    column: float = 0.0
    join: float = 0.0
    aggregation: float = 0.0

    @property
    def average(self) -> float:
        return (self.table + self.column + self.join + self.aggregation) / 4.0


@dataclass
class SqlValidationResult:
    grounding: GroundingResult
    grounding_valid: bool
    join_valid: bool
    semantic_valid: bool
    safety_valid: bool
    overall_valid: bool
    can_execute: bool
    component: ComponentConfidence
    calibrated_confidence: float
    issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


def extract_component_confidence(heuristic: HeuristicCompileResult) -> ComponentConfidence:
    """Derive per-component confidence from compile metadata."""
    reasons = heuristic.reasons

    if any("explicit_table_name" in r for r in reasons):
        table = 0.95
    elif any("alias_or_fuzzy_table" in r for r in reasons):
        table = 0.82
    elif heuristic.matched_tables:
        table = 0.70
    else:
        table = 0.0

    if any(r.startswith("columns=explicit") for r in reasons):
        column = 0.88
    elif any(r.startswith("agg=") for r in reasons):
        column = 0.80
    elif any("ranking_entity=" in r for r in reasons):
        column = 0.85
    else:
        column = 0.55

    if any(r.startswith("join_path=") for r in reasons):
        join = 0.90
    elif len(heuristic.matched_tables) > 1:
        join = 0.65
    else:
        join = 1.0

    if any(r.startswith("agg=") for r in reasons):
        aggregation = 0.92
    elif any(r.startswith("group_by=") for r in reasons):
        aggregation = 0.85
    elif heuristic.intent in ("aggregation", "grouping"):
        aggregation = 0.60
    else:
        aggregation = 0.75

    return ComponentConfidence(table=table, column=column, join=join, aggregation=aggregation)


def calibrate_confidence(
    heuristic: HeuristicCompileResult,
    component: ComponentConfidence,
    *,
    grounding_valid: bool,
    join_valid: bool,
    semantic_valid: bool,
    safety_valid: bool,
) -> float:
    """Blend compile confidence with component scores and validation outcomes."""
    base = heuristic.confidence
    component_blend = component.average

    calibrated = base * 0.55 + component_blend * 0.45

    if not safety_valid:
        calibrated *= 0.1
    if not grounding_valid:
        calibrated *= 0.35
    if not join_valid:
        calibrated *= 0.5
    if not semantic_valid:
        calibrated *= 0.6

    tier_bonus = {"L1": 0.05, "L2": 0.03, "L3": 0.0}.get(heuristic.tier, -0.1)
    calibrated += tier_bonus

    return max(0.0, min(1.0, calibrated))


def validate_join_grounding(sql: str, graph: SchemaGraph) -> Tuple[bool, List[str]]:
    """Verify JOIN ON clauses align with known FK edges."""
    if not graph.tables:
        return True, []

    try:
        expression = sqlglot.parse_one(sql)
    except Exception as exc:
        return False, [f"join_parse_error:{exc}"]

    fk_edges = _fk_edge_set(graph)
    issues: List[str] = []

    joins = list(expression.find_all(exp.Join))
    if not joins:
        return True, []

    for join in joins:
        on = join.args.get("on")
        if on is None:
            issues.append("join_missing_on_clause")
            continue
        matched = _on_clause_matches_fk(on, fk_edges)
        if not matched:
            left = on.left.sql() if hasattr(on, "left") else str(on)
            issues.append(f"join_ungrounded:{left}")

    return len(issues) == 0, issues


def validate_semantic_intent(
    sql: str,
    heuristic: HeuristicCompileResult,
) -> Tuple[bool, List[str]]:
    """Check that generated SQL structure matches detected intent."""
    issues: List[str] = []
    sql_upper = sql.upper()
    reasons = heuristic.reasons
    intent = heuristic.intent or ""

    agg_reason = next((r for r in reasons if r.startswith("agg=")), None)
    if agg_reason:
        agg = agg_reason.split("=", 1)[1]
        if agg == "count" and "COUNT" not in sql_upper:
            issues.append("semantic:missing_count")
        elif agg in ("sum", "avg", "min", "max") and agg.upper() not in sql_upper:
            issues.append(f"semantic:missing_{agg}")
        elif agg == "count_distinct" and "COUNT" not in sql_upper:
            issues.append("semantic:missing_count_distinct")

    if any(r.startswith("group_by=") or r.startswith("ranking_group=") for r in reasons):
        if "GROUP BY" not in sql_upper:
            issues.append("semantic:missing_group_by")

    if any(r.startswith("filter:") for r in reasons):
        if "WHERE" not in sql_upper:
            issues.append("semantic:missing_where")

    if any(r.startswith("having") for r in reasons):
        if "HAVING" not in sql_upper:
            issues.append("semantic:missing_having")

    if intent == "ranking" or any("ranking" in r for r in reasons):
        if "ORDER BY" not in sql_upper and "TOP " not in sql_upper:
            issues.append("semantic:missing_order")

    for table in heuristic.matched_tables:
        if table.lower() not in sql.lower():
            issues.append(f"semantic:missing_table:{table}")

    return len(issues) == 0, issues


def validate_heuristic_sql(
    *,
    sql: str,
    db_type: str,
    graph: SchemaGraph,
    heuristic: HeuristicCompileResult,
    require_semantic: bool = False,
) -> SqlValidationResult:
    """Run grounding, join, safety, and optional semantic validation."""
    issues: List[str] = []
    warnings: List[str] = []

    safety_valid, safety_error = validate_sql_structure(sql, db_type)
    if not safety_valid:
        issues.append(f"safety:{safety_error}")

    grounding = validate_sql_grounding(sql, graph)
    grounding_valid = grounding.valid and not grounding.unknown_tables and not grounding.unknown_columns
    if not grounding_valid:
        issues.extend(grounding.warnings)

    join_valid, join_issues = validate_join_grounding(sql, graph)
    if not join_valid:
        issues.extend(join_issues)

    semantic_valid = True
    if require_semantic:
        semantic_valid, semantic_issues = validate_semantic_intent(sql, heuristic)
        if not semantic_valid:
            issues.extend(semantic_issues)

    component = extract_component_confidence(heuristic)
    calibrated = calibrate_confidence(
        heuristic,
        component,
        grounding_valid=grounding_valid,
        join_valid=join_valid,
        semantic_valid=semantic_valid,
        safety_valid=safety_valid,
    )

    overall_valid = safety_valid and grounding_valid and join_valid and semantic_valid

    l3_min = settings.HEURISTIC_L3_MIN_CONFIDENCE
    if heuristic.tier in ("L1", "L2"):
        can_execute = overall_valid and calibrated >= HEURISTIC_CONFIDENCE_MEDIUM
    elif heuristic.tier == "L3":
        can_execute = overall_valid and calibrated >= l3_min
    else:
        can_execute = overall_valid and calibrated >= HEURISTIC_CONFIDENCE_MEDIUM

    if heuristic.should_escalate:
        can_execute = False
        issues.append("compile:should_escalate")

    return SqlValidationResult(
        grounding=grounding,
        grounding_valid=grounding_valid,
        join_valid=join_valid,
        semantic_valid=semantic_valid,
        safety_valid=safety_valid,
        overall_valid=overall_valid,
        can_execute=can_execute,
        component=component,
        calibrated_confidence=calibrated,
        issues=issues,
        warnings=warnings,
    )


def _fk_edge_set(graph: SchemaGraph) -> Set[Tuple[str, str, str, str]]:
    edges: Set[Tuple[str, str, str, str]] = set()
    for edge in graph.foreign_key_edges():
        edges.add((edge.from_table.lower(), edge.from_column.lower(), edge.to_table.lower(), edge.to_column.lower()))
        edges.add((edge.to_table.lower(), edge.to_column.lower(), edge.from_table.lower(), edge.from_column.lower()))
    return edges


def _on_clause_matches_fk(on: exp.Expression, fk_edges: Set[Tuple[str, str, str, str]]) -> bool:
    if isinstance(on, exp.And):
        left_ok = _on_clause_matches_fk(on.left, fk_edges)
        right_ok = _on_clause_matches_fk(on.right, fk_edges)
        return left_ok or right_ok

    if isinstance(on, exp.EQ):
        left = _column_ref(on.left)
        right = _column_ref(on.right)
        if left and right:
            a_table, a_col = left
            b_table, b_col = right
            return (a_table, a_col, b_table, b_col) in fk_edges
    return False


def _column_ref(node: exp.Expression) -> Optional[Tuple[str, str]]:
    if isinstance(node, exp.Column):
        table = (node.table or "").lower()
        col = node.name.lower()
        if table and col:
            return table, col
    return None
