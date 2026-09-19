"""
Advanced filter parsing for heuristic NL→SQL: comparisons, BETWEEN, IN, NULL, LIKE, AND/OR.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from app.core.ai.heuristic_aliases import AliasContext
from app.core.ai.heuristic_dates import find_date_column, parse_date_filters


@dataclass
class FilterResult:
    where_clause: str = ""
    confidence: float = 0.0
    reasons: List[str] = field(default_factory=list)
    has_or: bool = False


_STATUS_VALUES = re.compile(
    r"\b(active|inactive|pending|completed|cancelled|open|closed|draft|published|archived)\b",
    re.I,
)

_COMPARISON_OPS = [
    (re.compile(r"\b(\w+)\s*(?:>=|≥|at least|no less than)\s*([\d.]+)\b", re.I), ">="),
    (re.compile(r"\b(\w+)\s*(?:<=|≤|at most|no more than)\s*([\d.]+)\b", re.I), "<="),
    (re.compile(r"\b(\w+)\s*(?:>|greater than|more than|above|over|exceeds?)\s*([\d.]+)\b", re.I), ">"),
    (re.compile(r"\b(\w+)\s*(?:<|less than|below|under|fewer than)\s*([\d.]+)\b", re.I), "<"),
    (re.compile(r"\b(\w+)\s*(?:=|equals?|is exactly)\s*([\d.]+)\b", re.I), "="),
]

_IN_LIST = re.compile(
    r"\b(\w+)\s+(?:in|within)\s*\(([^)]+)\)",
    re.I,
)
_IN_WORDS = re.compile(
    r"\b(\w+)\s+(?:in|one of)\s+([a-z][\w,\s]+?)(?:\s+and|\s+or|\s+where|\s+group|\s+order|\s+having|$)",
    re.I,
)
_LIKE = re.compile(
    r"\b(\w+)\s+(?:like|contains|starts with|ends with|matches)\s+['\"]?([^'\"]+?)['\"]?(?:\s+and|\s+or|$)",
    re.I,
)
_NULL = re.compile(r"\b(\w+)\s+is\s+(not\s+)?null\b", re.I)
_EQ_WHERE = re.compile(r"\bwhere\s+(\w+)\s*(?:=|is)\s*['\"]?([\w-]+)['\"]?", re.I)


def build_where_clause(
    question_lower: str,
    columns: List[str],
    column_types: Dict[str, str],
    db_type_lower: str,
    aliases: AliasContext,
) -> FilterResult:
    clauses: List[str] = []
    reasons: List[str] = []
    confidence = 0.0
    has_or = False

    date_col = find_date_column(columns, column_types)
    if date_col:
        date_clauses = parse_date_filters(question_lower, date_col, db_type_lower)
        for dc in date_clauses:
            clauses.append(dc)
            reasons.append("filter:date")
            confidence += 0.08

    for pattern, op in _COMPARISON_OPS:
        for match in pattern.finditer(question_lower):
            col = aliases.resolve_column(match.group(1), columns)
            if col:
                val = match.group(2)
                clauses.append(f"{col} {op} {val}")
                reasons.append(f"filter:compare:{op}")
                confidence += 0.08

    between = re.search(
        r"\b(\w+)\s+between\s+([\d.]+)\s+and\s+([\d.]+)\b",
        question_lower,
    )
    if between:
        col = aliases.resolve_column(between.group(1), columns)
        if col:
            clauses.append(f"{col} BETWEEN {between.group(2)} AND {between.group(3)}")
            reasons.append("filter:between")
            confidence += 0.10

    for match in _IN_LIST.finditer(question_lower):
        col = aliases.resolve_column(match.group(1), columns)
        if col:
            values = _format_in_values(match.group(2))
            clauses.append(f"{col} IN ({values})")
            reasons.append("filter:in")
            confidence += 0.10

    in_words = _IN_WORDS.search(question_lower)
    if in_words and not _IN_LIST.search(question_lower):
        col = aliases.resolve_column(in_words.group(1), columns)
        if col:
            raw = in_words.group(2).strip()
            values = _format_in_values(raw)
            clauses.append(f"{col} IN ({values})")
            reasons.append("filter:in_words")
            confidence += 0.08

    for match in _LIKE.finditer(question_lower):
        col = aliases.resolve_column(match.group(1), columns)
        if col:
            pattern_val = match.group(2).strip()
            like_pattern = _to_like_pattern(question_lower, match.group(0), pattern_val)
            clauses.append(f"{col} LIKE '{like_pattern}'")
            reasons.append("filter:like")
            confidence += 0.08

    for match in _NULL.finditer(question_lower):
        col = aliases.resolve_column(match.group(1), columns)
        if col:
            if match.group(2):
                clauses.append(f"{col} IS NOT NULL")
                reasons.append("filter:not_null")
            else:
                clauses.append(f"{col} IS NULL")
                reasons.append("filter:null")
            confidence += 0.08

    eq_match = _EQ_WHERE.search(question_lower)
    if eq_match:
        col = aliases.resolve_column(eq_match.group(1), columns)
        if col:
            clauses.append(f"{col} = '{eq_match.group(2)}'")
            reasons.append("filter:eq")
            confidence += 0.08

    status_match = _STATUS_VALUES.search(question_lower)
    if status_match and not eq_match:
        status_col = _find_column_by_keywords(columns, column_types, ["status", "state", "is_active"])
        if status_col:
            clauses.append(f"{status_col} = '{status_match.group(1).lower()}'")
            reasons.append("filter:status")
            confidence += 0.06

    or_groups = _extract_or_groups(question_lower, columns, aliases)
    if or_groups:
        has_or = True
        for group in or_groups:
            if len(group) == 1:
                clauses.append(group[0])
            else:
                clauses.append("(" + " OR ".join(group) + ")")
        reasons.append("filter:or")
        confidence += 0.05

    if not clauses:
        return FilterResult()

    joiner = " AND "
    where = "WHERE " + joiner.join(clauses)
    return FilterResult(
        where_clause=where,
        confidence=min(confidence, 0.25),
        reasons=reasons,
        has_or=has_or,
    )


def _format_in_values(raw: str) -> str:
    parts = [p.strip().strip("'\"") for p in re.split(r",|\bor\b", raw) if p.strip()]
    return ", ".join(f"'{p}'" for p in parts)


def _to_like_pattern(question_lower: str, full_match: str, value: str) -> str:
    if "starts with" in full_match.lower():
        return f"{value}%"
    if "ends with" in full_match.lower():
        return f"%{value}"
    return f"%{value}%"


def _extract_or_groups(
    question_lower: str,
    columns: List[str],
    aliases: AliasContext,
) -> List[List[str]]:
    """Parse simple OR status/value lists: 'active or pending orders'."""
    groups: List[List[str]] = []
    or_status = re.search(
        r"\b(active|inactive|pending|completed|cancelled|open|closed)\s+or\s+"
        r"(active|inactive|pending|completed|cancelled|open|closed)\b",
        question_lower,
    )
    if or_status:
        status_col = _find_column_by_keywords(columns, {}, ["status", "state"])
        if status_col:
            groups.append([
                f"{status_col} = '{or_status.group(1).lower()}'",
                f"{status_col} = '{or_status.group(2).lower()}'",
            ])
    return groups


def _find_column_by_keywords(
    columns: List[str],
    column_types: Dict[str, str],
    keywords: List[str],
) -> Optional[str]:
    for kw in keywords:
        for col in columns:
            if kw in col.lower():
                return col
    return None
