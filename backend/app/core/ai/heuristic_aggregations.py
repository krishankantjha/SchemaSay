"""
Advanced aggregation building for heuristic NL→SQL.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from app.core.ai.heuristic_aliases import AliasContext
from app.core.ai.heuristic_intent import IntentResult

_NUMERIC_KEYWORDS = ["price", "amount", "sales", "revenue", "cost", "quantity", "value", "total", "score", "rating"]


@dataclass
class SelectResult:
    select_clause: str
    confidence: float
    reason: Optional[str] = None
    order_expr: Optional[str] = None  # expression for ORDER BY on ranked agg queries


def build_select_clause(
    question_lower: str,
    columns: List[str],
    column_types: Dict[str, str],
    agg: Optional[str],
    aliases: AliasContext,
    intent: IntentResult,
    column_resolution,
) -> SelectResult:
    if agg == "count_distinct":
        col = _find_target_column(question_lower, columns, column_types, aliases, column_resolution)
        if col:
            return SelectResult(f"COUNT(DISTINCT {col})", 0.18, "agg=count_distinct", f"COUNT(DISTINCT {col})")
        return SelectResult("COUNT(DISTINCT *)", 0.0, None)

    if agg == "count":
        return SelectResult("COUNT(*)", 0.15, "agg=count", "COUNT(*)")

    if agg in ("sum", "avg", "min", "max"):
        numeric_col = _find_numeric_column(question_lower, columns, column_types, aliases, column_resolution)
        if not numeric_col:
            return SelectResult("*", 0.0, None)
        func = agg.upper()
        expr = f"{func}({numeric_col})"
        return SelectResult(expr, 0.15, f"agg={agg}", expr)

    if agg == "ratio":
        return _build_ratio_select(question_lower, columns, column_types, aliases)

    if agg == "percentage":
        return _build_percentage_select(question_lower, columns, column_types, aliases)

    if column_resolution.best and intent.primary.value == "lookup":
        selected = [column_resolution.best]
    else:
        selected = [
            col for col in columns if re.search(r"\b" + re.escape(col.lower()) + r"\b", question_lower)
        ]
        if not selected and column_resolution.best:
            selected = [column_resolution.best]

    if selected:
        return SelectResult(", ".join(selected), 0.10, "columns=explicit")
    return SelectResult("*", 0.05, "columns=wildcard")


def build_having_clause(
    question_lower: str,
    agg: Optional[str],
    select_expr: str,
) -> Tuple[str, float, Optional[str]]:
    """Build HAVING clause for post-aggregation filters."""
    if not agg:
        return "", 0.0, None

    having_match = re.search(
        r"\bhaving\s+(.+?)(?:\s+order|\s+limit|\s+by\s+\d|$)",
        question_lower,
    )
    if having_match:
        expr = _parse_having_expr(having_match.group(1), select_expr)
        if expr:
            return f"HAVING {expr}", 0.12, "having=explicit"

    for pattern, op in (
        (r"\bhaving\s+(?:more than|greater than|over)\s+(\d+)\b", ">"),
        (r"\b(?:with|having)\s+(?:more than|greater than|over)\s+(\d+)\b", ">"),
        (r"\b(?:with|having)\s+(?:at least)\s+(\d+)\b", ">="),
        (r"\b(?:with|having)\s+(?:less than|under|fewer than)\s+(\d+)\b", "<"),
        (r"\b(?:with|having)\s+(?:at most)\s+(\d+)\b", "<="),
        (r"\b(?:more than|greater than|over)\s+(\d+)\s+(?:orders|records|items|rows)\b", ">"),
        (r"\b(?:at least)\s+(\d+)\s+(?:orders|records|items|rows)\b", ">="),
        (r"\b(?:less than|under|fewer than)\s+(\d+)\s+(?:orders|records|items|rows)\b", "<"),
        (r"\b(?:at most)\s+(\d+)\s+(?:orders|records|items|rows)\b", "<="),
        (r"\b(?:exceeds?|above)\s+(\d+)\b", ">"),
        (r"\b(?:below|under)\s+(\d+)\b", "<"),
    ):
        match = re.search(pattern, question_lower)
        if match:
            val = match.group(1)
            return f"HAVING {select_expr} {op} {val}", 0.10, f"having:{op}"

    return "", 0.0, None


def parse_group_dimensions(question_lower: str) -> List[str]:
    """Extract one or more GROUP BY dimension tokens."""
    if re.search(r"\btop\s+\d+\b", question_lower) and not re.search(
        r"\bgroup(?:ed)?\s+by\b", question_lower
    ):
        return []

    group_match = re.search(
        r"\b(?:grouped by|group by)\s+"
        r"(.+?)(?:\s+having|\s+order\s+by|\s+where|\s+with|\s+limit|\s+top|$)",
        question_lower,
    )
    if not group_match:
        group_match = re.search(
            r"\b(?:by|per|broken down by)\s+"
            r"(.+?)(?:\s+having|\s+order\s+by|\s+where|\s+with|\s+limit|\s+top|\s+for\s+\w+|$)",
            question_lower,
        )
    if not group_match:
        return []

    raw = group_match.group(1).strip()
    raw = re.sub(r"\s+(for|from|in|on|of)\s+\w+$", "", raw)
    parts = re.split(r"\s*,\s*|\s+and\s+", raw)
    dimensions: List[str] = []
    for part in parts:
        token = part.strip()
        if token and token not in ("month", "quarter", "year", "week", "day"):
            token = token.split()[-1] if len(token.split()) > 1 and token.split()[0] in ("each", "every") else token
        if token:
            dimensions.append(token)
    return dimensions


def _parse_having_expr(raw: str, select_expr: str) -> Optional[str]:
    raw = raw.strip()
    gt = re.search(r"(?:>|(?:more than|greater than|over))\s*(\d+)", raw)
    if gt:
        return f"{select_expr} > {gt.group(1)}"
    gte = re.search(r"(?:>=|at least)\s*(\d+)", raw)
    if gte:
        return f"{select_expr} >= {gte.group(1)}"
    lt = re.search(r"(?:<|(?:less than|under|fewer than))\s*(\d+)", raw)
    if lt:
        return f"{select_expr} < {lt.group(1)}"
    lte = re.search(r"(?:<=|at most)\s*(\d+)", raw)
    if lte:
        return f"{select_expr} <= {lte.group(1)}"
    eq = re.search(r"(?:=|equals?)\s*(\d+)", raw)
    if eq:
        return f"{select_expr} = {eq.group(1)}"
    return None


def _build_ratio_select(
    question_lower: str,
    columns: List[str],
    column_types: Dict[str, str],
    aliases: AliasContext,
) -> SelectResult:
    num_col = _find_numeric_column(question_lower, columns, column_types, aliases, None)
    if num_col:
        expr = f"CAST(SUM({num_col}) AS REAL) / NULLIF(COUNT(*), 0)"
        return SelectResult(expr, 0.12, "agg=ratio", expr)
    return SelectResult("*", 0.0, None)


def _build_percentage_select(
    question_lower: str,
    columns: List[str],
    column_types: Dict[str, str],
    aliases: AliasContext,
) -> SelectResult:
    status_col = None
    for col in columns:
        if "status" in col.lower() or "state" in col.lower():
            status_col = col
            break
    if status_col:
        active = re.search(r"\b(active|completed|open|yes|true)\b", question_lower)
        if active:
            val = active.group(1).lower()
            expr = (
                f"ROUND(100.0 * SUM(CASE WHEN {status_col} = '{val}' THEN 1 ELSE 0 END) "
                f"/ NULLIF(COUNT(*), 0), 2)"
            )
            return SelectResult(expr, 0.12, "agg=percentage", expr)
    return SelectResult("COUNT(*)", 0.08, "agg=percentage_fallback", "COUNT(*)")


def _find_numeric_column(
    question_lower: str,
    columns: List[str],
    column_types: Dict[str, str],
    aliases: AliasContext,
    column_resolution,
) -> Optional[str]:
    if column_resolution and column_resolution.best:
        cat = column_types.get(column_resolution.best, "")
        if _is_numeric_type(cat):
            return column_resolution.best

    for col in columns:
        if re.search(r"\b" + re.escape(col.lower()) + r"\b", question_lower):
            return col
    for kw in _NUMERIC_KEYWORDS:
        if re.search(r"\b" + re.escape(kw) + r"\b", question_lower):
            resolved = aliases.resolve_column(kw, columns)
            if resolved:
                return resolved
        for col in columns:
            if kw in col.lower():
                return col
    return None


def _find_target_column(
    question_lower: str,
    columns: List[str],
    column_types: Dict[str, str],
    aliases: AliasContext,
    column_resolution,
) -> Optional[str]:
    for col in columns:
        if re.search(r"\b" + re.escape(col.lower()) + r"\b", question_lower):
            return col
    distinct_hint = re.search(r"\bdistinct\s+(\w+)\b", question_lower)
    if distinct_hint:
        return aliases.resolve_column(distinct_hint.group(1), columns)
    unique_hint = re.search(r"\bunique\s+(\w+)\b", question_lower)
    if unique_hint:
        return aliases.resolve_column(unique_hint.group(1), columns)
    return column_resolution.best if column_resolution else None


def _is_numeric_type(data_type: str) -> bool:
    base = data_type.split(" | ")[0].lower()
    return any(k in base for k in ("int", "float", "decimal", "numeric", "real", "number", "money"))
