"""
Schema intelligence for join planning: table roles, path scoring, dedup, ambiguity.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set, Tuple

from app.core.schema.graph import JoinEdge, SchemaGraph

_NUMERIC_TYPES = frozenset({"int", "integer", "float", "double", "decimal", "numeric", "real", "money", "bigint"})


class TableRole(str, Enum):
    FACT = "fact"
    DIMENSION = "dimension"
    BRIDGE = "bridge"
    UNKNOWN = "unknown"


@dataclass
class TableProfile:
    table: str
    role: TableRole
    inbound_fk: int = 0
    outbound_fk: int = 0
    pk_columns: List[str] = field(default_factory=list)
    numeric_columns: int = 0
    text_columns: int = 0
    row_count: int = 0
    hub_score: int = 0

    @property
    def is_hub(self) -> bool:
        return self.hub_score >= 4


@dataclass
class JoinPlanResult:
    from_clause: str
    joined_tables: List[str]
    paths_used: List[List[JoinEdge]] = field(default_factory=list)
    is_ambiguous: bool = False
    ambiguity_reason: Optional[str] = None
    duplicate_risk: bool = False
    duplicate_mitigation: Optional[str] = None
    reasons: List[str] = field(default_factory=list)


def classify_tables(graph: SchemaGraph) -> Dict[str, TableProfile]:
    """Classify tables as fact, dimension, or bridge from FK topology."""
    inbound: Dict[str, int] = {t: 0 for t in graph.tables}
    outbound: Dict[str, int] = {t: 0 for t in graph.tables}

    for edge in graph.foreign_key_edges():
        outbound[edge.from_table] = outbound.get(edge.from_table, 0) + 1
        inbound[edge.to_table] = inbound.get(edge.to_table, 0) + 1

    profiles: Dict[str, TableProfile] = {}
    for table, columns in graph.tables.items():
        pk_cols = [c.name for c in columns if c.is_primary_key]
        fk_col_count = sum(1 for c in columns if c.is_foreign_key)
        numeric = sum(
            1 for c in columns
            if _is_numeric(c.data_type) and not c.is_primary_key and not c.is_foreign_key
        )
        text = sum(1 for c in columns if _is_text(c.data_type))
        in_fk = inbound.get(table, 0)
        out_fk = outbound.get(table, 0)
        row_count = graph.table_row_counts.get(table, 0) or 0
        hub_score = in_fk * 2 + out_fk

        role = _infer_role(in_fk, out_fk, fk_col_count, numeric, text, len(pk_cols), len(columns), row_count)
        profiles[table] = TableProfile(
            table=table,
            role=role,
            inbound_fk=in_fk,
            outbound_fk=out_fk,
            pk_columns=pk_cols,
            numeric_columns=numeric,
            text_columns=text,
            row_count=row_count,
            hub_score=hub_score,
        )
    return profiles


def minimize_join_targets(
    primary: str,
    targets: List[str],
    graph: SchemaGraph,
    profiles: Dict[str, TableProfile],
    *,
    required_tables: Optional[Set[str]] = None,
) -> List[str]:
    """Drop targets that are transitively reachable without a direct join requirement."""
    required = required_tables or set()
    unique = list(dict.fromkeys([primary] + [t for t in targets if t != primary]))
    if len(unique) <= 1:
        return unique

    essential: Set[str] = {primary} | {t for t in unique if t in required}
    for target in unique:
        if target == primary:
            continue
        if target in required:
            essential.add(target)
            continue
        # Keep explicitly requested targets (in original targets list)
        essential.add(target)

    # Remove redundant targets covered by another target's path node (unless required)
    pruned = list(essential)
    changed = True
    while changed:
        changed = False
        for candidate in list(pruned):
            if candidate == primary or candidate in required:
                continue
            others = [t for t in pruned if t != candidate]
            if not others:
                continue
            if _covered_by_other_paths(primary, candidate, others, graph):
                pruned.remove(candidate)
                changed = True
                break
    return list(dict.fromkeys([primary] + [t for t in pruned if t != primary]))


def plan_joins(
    primary_table: str,
    target_tables: List[str],
    graph: SchemaGraph,
    *,
    mentioned_tables: Optional[Set[str]] = None,
    required_tables: Optional[Set[str]] = None,
    profiles: Optional[Dict[str, TableProfile]] = None,
) -> Optional[JoinPlanResult]:
    """Build an optimal FROM clause with FK pathfinding and ambiguity detection."""
    if profiles is None:
        profiles = classify_tables(graph)

    mentioned = mentioned_tables or set()
    required = required_tables or set()
    targets = minimize_join_targets(
        primary_table,
        target_tables,
        graph,
        profiles,
        required_tables=required,
    )

    if len(targets) <= 1:
        return JoinPlanResult(
            from_clause=primary_table,
            joined_tables=[primary_table],
            reasons=["join_single_table"],
        )

    joined_order: List[str] = [primary_table]
    joined_set: Set[str] = {primary_table}
    from_clause = primary_table
    paths_used: List[List[JoinEdge]] = []
    reasons: List[str] = []

    remaining = [t for t in targets if t != primary_table]
    while remaining:
        best_target: Optional[str] = None
        best_path: Optional[List[JoinEdge]] = None
        best_score = float("-inf")
        ambiguous_alts: List[str] = []

        for target in remaining:
            candidate_paths: List[Tuple[List[JoinEdge], float, str, str]] = []
            for anchor in joined_order:
                paths = graph.all_join_paths(anchor, target, max_depth=6, max_paths=8)
                for path in paths:
                    score, reason = score_join_path(path, profiles, mentioned, anchor, target)
                    candidate_paths.append((path, score, reason, anchor))

            if not candidate_paths:
                continue

            candidate_paths.sort(key=lambda item: (-item[1], len(item[0])))
            top_path, top_score, top_reason, top_anchor = candidate_paths[0]
            tied = [
                p for p, s, _, _ in candidate_paths
                if abs(s - top_score) < 0.5 and len(p) == len(top_path)
            ]
            if len(tied) > 1:
                alt_tables = sorted({edge.to_table for path in tied for edge in path})
                ambiguous_alts.append(f"{top_anchor}->{target}:{'|'.join(alt_tables[:4])}")

            if top_score > best_score:
                best_score = top_score
                best_target = target
                best_path = top_path
                reasons.append(f"path_{target}={top_reason}")

        if best_target is None or best_path is None:
            return None

        if ambiguous_alts and best_score < 5.0:
            return JoinPlanResult(
                from_clause="",
                joined_tables=[],
                is_ambiguous=True,
                ambiguity_reason=";".join(ambiguous_alts[:3]),
                reasons=reasons,
            )

        for edge in best_path:
            if edge.to_table in joined_set:
                continue
            from_clause += (
                f" JOIN {edge.to_table} ON {edge.from_table}.{edge.from_column}"
                f" = {edge.to_table}.{edge.to_column}"
            )
            joined_set.add(edge.to_table)
            joined_order.append(edge.to_table)

        paths_used.append(best_path)
        remaining.remove(best_target)

    bridge_used = [t for t in joined_set if profiles.get(t) and profiles[t].role == TableRole.BRIDGE]
    if bridge_used:
        reasons.append(f"bridge={','.join(bridge_used)}")

    return JoinPlanResult(
        from_clause=from_clause,
        joined_tables=joined_order,
        paths_used=paths_used,
        reasons=reasons,
    )


def score_join_path(
    path: List[JoinEdge],
    profiles: Dict[str, TableProfile],
    mentioned_tables: Set[str],
    anchor: str,
    target: str,
) -> Tuple[float, str]:
    """Score a join path: shorter + semantically relevant tables score higher."""
    if not path:
        return 10.0, "direct"

    score = 10.0 - len(path) * 2.0
    tables_on_path = {anchor, target}
    for edge in path:
        tables_on_path.add(edge.from_table)
        tables_on_path.add(edge.to_table)

    for table in tables_on_path:
        if table in mentioned_tables:
            score += 3.0
        profile = profiles.get(table)
        if not profile:
            continue
        if profile.role == TableRole.BRIDGE:
            score += 1.5
        elif profile.role == TableRole.FACT:
            score += 1.0
        elif profile.role == TableRole.DIMENSION:
            score += 0.5
        if profile.is_hub:
            score += 0.5

    # Penalize extra dimension hops not explicitly mentioned
    for table in tables_on_path:
        if table in mentioned_tables or table in (anchor, target):
            continue
        profile = profiles.get(table)
        if profile and profile.role == TableRole.DIMENSION:
            score -= 1.0

    reason = f"len={len(path)},score={score:.1f}"
    return score, reason


def assess_duplicate_risk(
    *,
    joined_tables: List[str],
    profiles: Dict[str, TableProfile],
    has_aggregation: bool,
    has_group_by: bool,
    agg: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    """Detect fan-out duplicate risk when joining fact to dimensions without aggregation."""
    if len(joined_tables) <= 1:
        return False, None
    if has_group_by:
        return False, None
    if has_aggregation and agg not in (None, "count"):
        return False, None

    facts = [t for t in joined_tables if profiles.get(t) and profiles[t].role == TableRole.FACT]
    bridges = [t for t in joined_tables if profiles.get(t) and profiles[t].role == TableRole.BRIDGE]
    if facts and len(joined_tables) > 1:
        return True, "distinct_or_group"
    if bridges and len(joined_tables) >= 2:
        return True, "distinct_or_group"
    if len(joined_tables) >= 2:
        return True, "distinct_or_group" if agg == "count" else "distinct"
    return False, None


def apply_duplicate_protection(
    select_clause: str,
    agg: Optional[str],
    *,
    duplicate_risk: bool,
    mitigation: Optional[str],
    primary_table: str,
    graph: SchemaGraph,
) -> Tuple[str, Optional[str]]:
    """Apply DISTINCT or COUNT(DISTINCT pk) when joins may fan out rows."""
    if not duplicate_risk or not mitigation:
        return select_clause, None

    if agg == "count":
        pk = graph.primary_key_columns(primary_table)
        if pk:
            return f"COUNT(DISTINCT {primary_table}.{pk[0]})", "count_distinct_pk"
        return select_clause, None

    if agg in ("sum", "avg", "min", "max", "count_distinct", "ratio", "percentage"):
        return select_clause, None

    if mitigation in ("distinct", "distinct_or_group") and not select_clause.startswith("DISTINCT"):
        if select_clause.strip() == "*":
            return "DISTINCT *", "select_distinct"
        return f"DISTINCT {select_clause}", "select_distinct"

    return select_clause, None


def detect_join_ambiguity_for_targets(
    primary: str,
    targets: List[str],
    graph: SchemaGraph,
    profiles: Dict[str, TableProfile],
    mentioned: Set[str],
) -> Optional[str]:
    """Return ambiguity reason when multiple equally-scored paths exist for any target pair."""
    for target in targets:
        if target == primary:
            continue
        paths = graph.all_join_paths(primary, target, max_depth=6, max_paths=8)
        if len(paths) <= 1:
            continue
        scores = [score_join_path(p, profiles, mentioned, primary, target)[0] for p in paths]
        if len(scores) >= 2 and abs(scores[0] - scores[1]) < 0.5:
            intermediates = sorted({e.to_table for p in paths for e in p})
            return f"join_paths_tied:{primary}->{target}:{','.join(intermediates[:4])}"
    return None


def pick_hub_primary(candidates: List[str], profiles: Dict[str, TableProfile]) -> str:
    """Pick the best primary table from candidates using hub/fact scoring."""
    def sort_key(table: str) -> Tuple[int, int, int]:
        p = profiles.get(table)
        if not p:
            return (0, 0, 0)
        role_bonus = {TableRole.FACT: 3, TableRole.BRIDGE: 2, TableRole.DIMENSION: 1}.get(p.role, 0)
        return (role_bonus, p.hub_score, p.row_count)

    return max(candidates, key=sort_key)


def _infer_role(
    inbound: int,
    outbound: int,
    fk_cols: int,
    numeric: int,
    text: int,
    pk_count: int,
    col_count: int,
    row_count: int,
) -> TableRole:
    non_pk = max(col_count - pk_count, 1)
    fk_ratio = fk_cols / non_pk

    if outbound >= 2 and fk_cols >= 2 and fk_ratio >= 0.4:
        return TableRole.BRIDGE
    if inbound >= 1 and outbound == 0 and text >= 1 and numeric == 0:
        return TableRole.DIMENSION
    if inbound >= 2 and outbound <= 1:
        return TableRole.DIMENSION
    if outbound >= 1 and numeric >= 1 and fk_ratio < 0.6:
        return TableRole.FACT
    if outbound >= 2 and numeric >= 2:
        return TableRole.FACT
    if inbound >= 2:
        return TableRole.DIMENSION
    if outbound >= 2:
        return TableRole.BRIDGE
    if row_count > 500 and numeric >= 1:
        return TableRole.FACT
    if text >= 1 and numeric == 0:
        return TableRole.DIMENSION
    return TableRole.UNKNOWN


def _covered_by_other_paths(
    primary: str,
    candidate: str,
    others: List[str],
    graph: SchemaGraph,
) -> bool:
    for other in others:
        if other == primary:
            continue
        path = graph.join_path(primary, other)
        if not path:
            continue
        nodes = {primary, other}
        for edge in path:
            nodes.add(edge.from_table)
            nodes.add(edge.to_table)
        if candidate in nodes:
            return True
    return False


def _is_numeric(data_type: str) -> bool:
    base = data_type.lower()
    return any(t in base for t in _NUMERIC_TYPES)


def _is_text(data_type: str) -> bool:
    base = data_type.lower()
    return any(t in base for t in ("text", "varchar", "char", "string", "clob"))
