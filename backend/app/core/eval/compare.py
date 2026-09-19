"""Result and SQL comparison utilities for evaluation."""

from __future__ import annotations

import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple


def normalize_cell(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float):
        if math.isnan(value):
            return None
        return round(value, 6)
    if isinstance(value, (int, str, bool)):
        return value
    return str(value)


def _sortable_value(value: Any) -> Tuple[int, str]:
    """Stable sort key for heterogeneous SQL cell values."""
    if value is None:
        return (0, "")
    if isinstance(value, bool):
        return (1, str(int(value)))
    if isinstance(value, (int, float)):
        return (2, f"{float(value):.6f}")
    return (3, str(value))


def rows_to_multiset(rows: Optional[List[Dict[str, Any]]]) -> List[Tuple[Tuple[str, Any], ...]]:
    if not rows:
        return []
    normalized: List[Tuple[Tuple[str, Any], ...]] = []
    for row in rows:
        items = tuple(sorted((k, normalize_cell(v)) for k, v in row.items()))
        normalized.append(items)
    return sorted(normalized)


def rows_to_value_multiset(rows: Optional[List[Dict[str, Any]]]) -> List[Tuple[Tuple[int, str], ...]]:
    """Row multiset ignoring column names — useful when aliases differ."""
    if not rows:
        return []
    normalized: List[Tuple[Tuple[int, str], ...]] = []
    for row in rows:
        values = tuple(
            sorted(
                (_sortable_value(normalize_cell(v)) for v in row.values()),
            )
        )
        normalized.append(values)
    return sorted(normalized)


def compare_results(
    actual: Optional[List[Dict[str, Any]]],
    expected: Optional[List[Dict[str, Any]]],
    *,
    ignore_order: bool = True,
) -> Tuple[bool, str]:
    """Compare query result rows with optional order independence."""
    if actual is None and expected is None:
        return True, "both_empty"
    if actual is None or expected is None:
        return False, "one_side_empty"

    if ignore_order:
        if rows_to_multiset(actual) == rows_to_multiset(expected):
            return True, "multiset_match"
        if rows_to_value_multiset(actual) == rows_to_value_multiset(expected):
            return True, "value_multiset_match"
        return False, f"row_mismatch:actual={len(actual)}:expected={len(expected)}"

    if len(actual) != len(expected):
        return False, f"row_count:{len(actual)}!={len(expected)}"

    for index, (a_row, e_row) in enumerate(zip(actual, expected)):
        a_norm = {k: normalize_cell(v) for k, v in a_row.items()}
        e_norm = {k: normalize_cell(v) for k, v in e_row.items()}
        if set(a_norm.keys()) != set(e_norm.keys()):
            return False, f"columns_differ:row={index}"
        for key in e_norm:
            if a_norm[key] != e_norm[key]:
                return False, f"value_differ:row={index}:col={key}"
    return True, "ordered_match"


def compare_aggregates(
    actual: Optional[List[Dict[str, Any]]],
    expected: Optional[List[Dict[str, Any]]],
    *,
    numeric_tolerance: float = 0.01,
) -> Tuple[bool, str]:
    """Looser comparison for aggregate queries — single-row numeric tolerance."""
    if not actual or not expected:
        return compare_results(actual, expected)

    if len(actual) == 1 and len(expected) == 1:
        a_row, e_row = actual[0], expected[0]
        a_values = sorted((normalize_cell(v) for v in a_row.values()), key=_sortable_value)
        e_values = sorted((normalize_cell(v) for v in e_row.values()), key=_sortable_value)
        if len(a_values) == len(e_values):
            for actual_val, expected_norm in zip(a_values, e_values):
                if isinstance(actual_val, (int, float)) and isinstance(expected_norm, (int, float)):
                    if abs(float(actual_val) - float(expected_norm)) > numeric_tolerance:
                        return False, "numeric_diff"
                elif actual_val != expected_norm:
                    return False, "value_diff"
            return True, "aggregate_match"

    return compare_results(actual, expected)


def sql_contains_all(sql: str, fragments: List[str]) -> Tuple[bool, List[str]]:
    missing = [frag for frag in fragments if frag.lower() not in sql.lower()]
    return len(missing) == 0, missing


def normalize_sql(sql: str) -> str:
    return re.sub(r"\s+", " ", sql.strip().rstrip(";")).lower()
