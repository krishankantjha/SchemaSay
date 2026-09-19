"""
Semantic intent classification for heuristic NL→SQL compilation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import List


class QueryIntent(str, Enum):
    LISTING = "listing"
    LOOKUP = "lookup"
    AGGREGATION = "aggregation"
    FILTERING = "filtering"
    RANKING = "ranking"
    GROUPING = "grouping"
    JOIN = "join"
    UNKNOWN = "unknown"


@dataclass
class IntentResult:
    primary: QueryIntent
    signals: List[str] = field(default_factory=list)
    aggregation: str | None = None  # count | sum | avg | min | max | count_distinct | ratio | percentage


_LISTING = re.compile(r"\b(show|list|display|see|view|fetch|give me|all|every)\b", re.I)
_LOOKUP = re.compile(r"\b(get|find|what is|what are|lookup|retrieve)\b", re.I)
_COUNT_DISTINCT = re.compile(r"\b(count distinct|distinct count|unique|number of unique|distinct)\b", re.I)
_COUNT = re.compile(r"\b(count|how many|total number|number of)\b", re.I)
_SUM = re.compile(r"\b(sum|total|amount|revenue|sales|cost)\b", re.I)
_AVG = re.compile(r"\b(average|avg|mean)\b", re.I)
_MIN = re.compile(r"\b(minimum|min|smallest|least)\b", re.I)
_MAX = re.compile(r"\b(maximum|max|largest)\b", re.I)
_RATIO = re.compile(r"\b(ratio|rate|per order|per customer|per user)\b", re.I)
_PERCENTAGE = re.compile(r"\b(percent|percentage|% of|share of)\b", re.I)
_FILTER = re.compile(
    r"\b(where|filter|only|with status|last\s+\d+\s+days?|in the last|since|before|after|between|"
    r"today|yesterday|last month|this month|is null|is not null|contains|like|greater than|less than|"
    r"more than|at least|at most|in \()\b",
    re.I,
)
_HAVING = re.compile(
    r"\b(having|with more than|with less than|with at least|with at most|"
    r"more than \d+ (?:orders|records|items)|exceeds?|above \d+|below \d+)\b",
    re.I,
)
_RANK = re.compile(r"\b(top|bottom|first|latest|recent|newest|oldest|highest|lowest|rank)\b", re.I)
_GROUP = re.compile(r"\b(by|per|grouped by|group by|broken down by)\b", re.I)
_JOIN = re.compile(r"\b(and|with|including|joined|across|between .+ and)\b", re.I)


def detect_intent(question: str) -> IntentResult:
    """Classify the user's question into a primary query intent."""
    q = question.lower()
    signals: List[str] = []
    aggregation: str | None = None

    if _COUNT_DISTINCT.search(q):
        aggregation = "count_distinct"
        signals.append("agg:count_distinct")
    elif _COUNT.search(q):
        aggregation = "count"
        signals.append("agg:count")
    elif _AVG.search(q):
        aggregation = "avg"
        signals.append("agg:avg")
    elif _MIN.search(q):
        aggregation = "min"
        signals.append("agg:min")
    elif _MAX.search(q):
        aggregation = "max"
        signals.append("agg:max")
    elif _RATIO.search(q):
        aggregation = "ratio"
        signals.append("agg:ratio")
    elif _PERCENTAGE.search(q):
        aggregation = "percentage"
        signals.append("agg:percentage")
    elif _SUM.search(q) and not _COUNT.search(q):
        aggregation = "sum"
        signals.append("agg:sum")

    if _GROUP.search(q):
        signals.append("grouping")
    if _FILTER.search(q):
        signals.append("filtering")
    if _HAVING.search(q):
        signals.append("having")
    if _RANK.search(q):
        signals.append("ranking")
    if _JOIN.search(q):
        signals.append("join_hint")

    if aggregation:
        if "grouping" in signals:
            primary = QueryIntent.GROUPING
        else:
            primary = QueryIntent.AGGREGATION
    elif "join_hint" in signals and re.search(r"\band\b", q):
        primary = QueryIntent.JOIN
    elif "filtering" in signals and not _LISTING.search(q):
        primary = QueryIntent.FILTERING
    elif "ranking" in signals:
        primary = QueryIntent.RANKING
    elif "grouping" in signals:
        primary = QueryIntent.GROUPING
    elif _LOOKUP.search(q):
        primary = QueryIntent.LOOKUP
    elif _LISTING.search(q):
        primary = QueryIntent.LISTING
    elif "join_hint" in signals:
        primary = QueryIntent.JOIN
    else:
        primary = QueryIntent.UNKNOWN

    return IntentResult(primary=primary, signals=signals, aggregation=aggregation)
