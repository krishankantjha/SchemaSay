"""
Date intelligence for heuristic NL→SQL: relative ranges, calendar periods, BETWEEN.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional

_DATE_KEYWORDS = ["created_at", "updated_at", "date", "timestamp", "ordered_at", "order_date", "placed_at"]


def find_date_column(
    columns: List[str],
    column_types: Dict[str, str],
    keywords: Optional[List[str]] = None,
) -> Optional[str]:
    keywords = keywords or _DATE_KEYWORDS
    for col in columns:
        dtype = column_types.get(col, "").lower()
        if any(k in dtype for k in ("date", "time", "timestamp")):
            for kw in keywords:
                if kw in col.lower():
                    return col
    for kw in keywords:
        for col in columns:
            if kw in col.lower():
                return col
    return None


def parse_date_filters(
    question_lower: str,
    date_col: str,
    db_type_lower: str,
) -> List[str]:
    """Return SQL date predicates found in the question."""
    clauses: List[str] = []

    last_days = re.search(r"\blast\s+(\d+)\s+days?\b", question_lower)
    if last_days:
        clauses.append(_relative_days(date_col, int(last_days.group(1)), db_type_lower))

    if re.search(r"\btoday\b", question_lower):
        clauses.append(_today(date_col, db_type_lower))

    if re.search(r"\byesterday\b", question_lower):
        clauses.append(_yesterday(date_col, db_type_lower))

    if re.search(r"\blast\s+week\b", question_lower):
        clauses.append(_relative_days(date_col, 7, db_type_lower))

    if re.search(r"\blast\s+month\b", question_lower):
        clauses.append(_last_month(date_col, db_type_lower))

    if re.search(r"\bthis\s+month\b", question_lower):
        clauses.append(_this_month(date_col, db_type_lower))

    if re.search(r"\bthis\s+year\b", question_lower):
        clauses.append(_this_year(date_col, db_type_lower))

    if re.search(r"\blast\s+year\b", question_lower):
        clauses.append(_last_year(date_col, db_type_lower))

    between = re.search(
        r"\bbetween\s+['\"]?([\d-]+)['\"]?\s+and\s+['\"]?([\d-]+)['\"]?",
        question_lower,
    )
    if between:
        start, end = between.group(1), between.group(2)
        clauses.append(f"{date_col} BETWEEN '{start}' AND '{end}'")

    since = re.search(r"\bsince\s+['\"]?([\d-]+)['\"]?", question_lower)
    if since and not between:
        clauses.append(f"{date_col} >= '{since.group(1)}'")

    before = re.search(r"\bbefore\s+['\"]?([\d-]+)['\"]?", question_lower)
    if before:
        clauses.append(f"{date_col} < '{before.group(1)}'")

    after = re.search(r"\bafter\s+['\"]?([\d-]+)['\"]?", question_lower)
    if after and not since:
        clauses.append(f"{date_col} > '{after.group(1)}'")

    return clauses


def group_date_expr(
    dimension: str,
    date_col: str,
    db_type_lower: str,
) -> Optional[str]:
    """Return a GROUP BY expression for a calendar dimension (month, quarter, year, week, day)."""
    if dimension == "month":
        if db_type_lower == "sqlite":
            return f"strftime('%Y-%m', {date_col})"
        if db_type_lower == "postgres":
            return f"to_char({date_col}, 'YYYY-MM')"
        if db_type_lower == "mysql":
            return f"DATE_FORMAT({date_col}, '%Y-%m')"
        if db_type_lower == "mssql":
            return f"FORMAT({date_col}, 'yyyy-MM')"
    if dimension == "quarter":
        if db_type_lower == "sqlite":
            return (
                f"strftime('%Y', {date_col}) || '-Q' || "
                f"((cast(strftime('%m', {date_col}) as integer) - 1) / 3 + 1)"
            )
        if db_type_lower == "postgres":
            return f"to_char({date_col}, 'YYYY-\"Q\"Q')"
        if db_type_lower == "mysql":
            return f"CONCAT(YEAR({date_col}), '-Q', QUARTER({date_col}))"
        if db_type_lower == "mssql":
            return f"CONCAT(YEAR({date_col}), '-Q', DATEPART(QUARTER, {date_col}))"
    if dimension == "year":
        if db_type_lower == "sqlite":
            return f"strftime('%Y', {date_col})"
        if db_type_lower == "postgres":
            return f"to_char({date_col}, 'YYYY')"
        if db_type_lower == "mysql":
            return f"YEAR({date_col})"
        if db_type_lower == "mssql":
            return f"YEAR({date_col})"
    if dimension == "week":
        if db_type_lower == "sqlite":
            return f"strftime('%Y-W%W', {date_col})"
        if db_type_lower == "postgres":
            return f"to_char({date_col}, 'IYYY-\"W\"IW')"
        if db_type_lower == "mysql":
            return f"DATE_FORMAT({date_col}, '%x-W%v')"
        if db_type_lower == "mssql":
            return f"CONCAT(YEAR({date_col}), '-W', DATEPART(ISO_WEEK, {date_col}))"
    if dimension == "day":
        if db_type_lower == "sqlite":
            return f"date({date_col})"
        if db_type_lower == "postgres":
            return f"date_trunc('day', {date_col})::date"
        if db_type_lower == "mysql":
            return f"DATE({date_col})"
        if db_type_lower == "mssql":
            return f"CAST({date_col} AS DATE)"
    return None


def _relative_days(date_col: str, days: int, db_type_lower: str) -> str:
    if db_type_lower == "sqlite":
        return f"{date_col} >= date('now', '-{days} days')"
    if db_type_lower == "postgres":
        return f"{date_col} >= CURRENT_DATE - INTERVAL '{days} days'"
    if db_type_lower == "mysql":
        return f"{date_col} >= DATE_SUB(CURDATE(), INTERVAL {days} DAY)"
    if db_type_lower == "mssql":
        return f"{date_col} >= DATEADD(day, -{days}, GETDATE())"
    return f"{date_col} >= date('now', '-{days} days')"


def _today(date_col: str, db_type_lower: str) -> str:
    if db_type_lower == "sqlite":
        return f"date({date_col}) = date('now')"
    if db_type_lower == "postgres":
        return f"{date_col}::date = CURRENT_DATE"
    if db_type_lower == "mysql":
        return f"DATE({date_col}) = CURDATE()"
    if db_type_lower == "mssql":
        return f"CAST({date_col} AS DATE) = CAST(GETDATE() AS DATE)"
    return f"date({date_col}) = date('now')"


def _yesterday(date_col: str, db_type_lower: str) -> str:
    if db_type_lower == "sqlite":
        return f"date({date_col}) = date('now', '-1 day')"
    if db_type_lower == "postgres":
        return f"{date_col}::date = CURRENT_DATE - INTERVAL '1 day'"
    if db_type_lower == "mysql":
        return f"DATE({date_col}) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
    if db_type_lower == "mssql":
        return f"CAST({date_col} AS DATE) = CAST(DATEADD(day, -1, GETDATE()) AS DATE)"
    return f"date({date_col}) = date('now', '-1 day')"


def _last_month(date_col: str, db_type_lower: str) -> str:
    if db_type_lower == "sqlite":
        return (
            f"strftime('%Y-%m', {date_col}) = "
            f"strftime('%Y-%m', date('now', 'start of month', '-1 month'))"
        )
    if db_type_lower == "postgres":
        return (
            f"to_char({date_col}, 'YYYY-MM') = "
            f"to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM')"
        )
    if db_type_lower == "mysql":
        return (
            f"DATE_FORMAT({date_col}, '%Y-%m') = "
            f"DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m')"
        )
    if db_type_lower == "mssql":
        return (
            f"FORMAT({date_col}, 'yyyy-MM') = "
            f"FORMAT(DATEADD(month, -1, GETDATE()), 'yyyy-MM')"
        )
    return _relative_days(date_col, 30, db_type_lower)


def _this_month(date_col: str, db_type_lower: str) -> str:
    if db_type_lower == "sqlite":
        return f"strftime('%Y-%m', {date_col}) = strftime('%Y-%m', 'now')"
    if db_type_lower == "postgres":
        return f"to_char({date_col}, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')"
    if db_type_lower == "mysql":
        return f"DATE_FORMAT({date_col}, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')"
    if db_type_lower == "mssql":
        return f"FORMAT({date_col}, 'yyyy-MM') = FORMAT(GETDATE(), 'yyyy-MM')"
    return _relative_days(date_col, 30, db_type_lower)


def _this_year(date_col: str, db_type_lower: str) -> str:
    if db_type_lower == "sqlite":
        return f"strftime('%Y', {date_col}) = strftime('%Y', 'now')"
    if db_type_lower == "postgres":
        return f"to_char({date_col}, 'YYYY') = to_char(CURRENT_DATE, 'YYYY')"
    if db_type_lower == "mysql":
        return f"YEAR({date_col}) = YEAR(CURDATE())"
    if db_type_lower == "mssql":
        return f"YEAR({date_col}) = YEAR(GETDATE())"
    return _relative_days(date_col, 365, db_type_lower)


def _last_year(date_col: str, db_type_lower: str) -> str:
    if db_type_lower == "sqlite":
        return f"strftime('%Y', {date_col}) = strftime('%Y', date('now', '-1 year'))"
    if db_type_lower == "postgres":
        return f"to_char({date_col}, 'YYYY') = to_char(CURRENT_DATE - INTERVAL '1 year', 'YYYY')"
    if db_type_lower == "mysql":
        return f"YEAR({date_col}) = YEAR(CURDATE()) - 1"
    if db_type_lower == "mssql":
        return f"YEAR({date_col}) = YEAR(GETDATE()) - 1"
    return _relative_days(date_col, 365, db_type_lower)
