"""
Table and column resolution: fuzzy matching, hub scoring, ambiguity detection.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Set, Tuple

from app.core.ai.heuristic_aliases import AliasContext, table_tokens_in_question
from app.core.ai.heuristic_intent import IntentResult, QueryIntent
from app.core.schema.graph import SchemaGraph

FUZZY_TABLE_THRESHOLD = 0.82
AMBIGUITY_SCORE_GAP = 2
HUB_SCORE_WEIGHT = 3
MIN_TABLE_SCORE = 5.0
MIN_CONFIDENT_TABLE_SCORE = 8.0


@dataclass
class TableMatch:
    table: str
    score: float
    reasons: List[str] = field(default_factory=list)


@dataclass
class TableResolution:
    matches: List[TableMatch]
    primary: Optional[str]
    matched_names: List[str]
    is_ambiguous: bool
    ambiguity_reason: Optional[str] = None


@dataclass
class ColumnMatch:
    column: str
    score: float
    reasons: List[str] = field(default_factory=list)


@dataclass
class ColumnResolution:
    matches: List[ColumnMatch]
    best: Optional[str]
    is_ambiguous: bool
    ambiguity_reason: Optional[str] = None


def _fuzzy_ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _singular_plural_variants(token: str) -> Set[str]:
    lowered = token.lower()
    variants = {lowered}
    if lowered.endswith("ies") and len(lowered) > 4:
        variants.add(lowered[:-3] + "y")
    elif lowered.endswith("es") and len(lowered) > 3:
        variants.add(lowered[:-2])
        variants.add(lowered[:-1])
    elif lowered.endswith("s") and len(lowered) > 2:
        variants.add(lowered[:-1])
    else:
        variants.add(lowered + "s")
        variants.add(lowered + "es")
    return variants


def compute_hub_scores(graph: SchemaGraph) -> Dict[str, int]:
    """Higher score = more central table in the FK graph (inbound FKs weighted higher)."""
    scores: Dict[str, int] = {table: 0 for table in graph.tables}
    for edge in graph.foreign_key_edges():
        scores[edge.from_table] = scores.get(edge.from_table, 0) + 1
        scores[edge.to_table] = scores.get(edge.to_table, 0) + 2
    for table, count in graph.table_row_counts.items():
        if count and table in scores:
            if count > 1000:
                scores[table] += 2
            elif count > 100:
                scores[table] += 1
    return scores


def score_tables(
    question_lower: str,
    tables_columns: Dict[str, List[str]],
    graph: SchemaGraph,
    alias_context: AliasContext,
) -> TableResolution:
    known = set(tables_columns.keys())
    hub_scores = compute_hub_scores(graph)
    raw: Dict[str, Tuple[float, List[str]]] = {}

    def add_score(table: str, points: float, reason: str) -> None:
        current, reasons = raw.get(table, (0.0, []))
        raw[table] = (current + points, reasons + [reason])

    for table in known:
        tl = table.lower()
        if re.search(r"\b" + re.escape(tl) + r"\b", question_lower):
            add_score(table, 10.0, "exact_table_name")

        for variant in _singular_plural_variants(tl):
            if variant != tl and re.search(r"\b" + re.escape(variant) + r"\b", question_lower):
                add_score(table, 9.0, "plural_variant")
                break

    for token in table_tokens_in_question(question_lower):
        resolved = alias_context.resolve_table(token, known)
        if resolved:
            add_score(resolved, 8.0, f"alias:{token}")

        for table in known:
            tl = table.lower()
            ratio = _fuzzy_ratio(token, tl)
            if len(token) >= 4 and ratio >= FUZZY_TABLE_THRESHOLD:
                add_score(table, 7.0 * ratio, f"fuzzy_token:{token}")

    for table, columns in tables_columns.items():
        for col in columns:
            if re.search(r"\b" + re.escape(col.lower()) + r"\b", question_lower):
                add_score(table, 2.0, f"column:{col}")

    for token in table_tokens_in_question(question_lower):
        if len(token) < 3:
            continue
        col_hint = alias_context.resolve_column_hint(token)
        if not col_hint or col_hint == token and token not in alias_context.column_aliases:
            mapped = alias_context.column_aliases.get(token)
            if not mapped:
                continue
            col_hint = mapped
        for table, columns in tables_columns.items():
            if any(col_hint in col.lower() for col in columns):
                add_score(table, 3.0, f"column_alias:{token}")

    for table in list(raw.keys()):
        hub_bonus = hub_scores.get(table, 0) * HUB_SCORE_WEIGHT
        if hub_bonus:
            score, reasons = raw[table]
            raw[table] = (score + hub_bonus, reasons + [f"hub:{hub_scores.get(table, 0)}"])

    matches = [
        TableMatch(table=name, score=score, reasons=reasons)
        for name, (score, reasons) in raw.items()
        if score >= MIN_TABLE_SCORE
    ]
    matches.sort(key=lambda m: m.score, reverse=True)

    if not matches or matches[0].score < MIN_CONFIDENT_TABLE_SCORE:
        return TableResolution(matches=[], primary=None, matched_names=[], is_ambiguous=False)

    top = matches[0].score
    close = [m for m in matches if m.score >= top - AMBIGUITY_SCORE_GAP]
    explicit = [
        m.table
        for m in matches
        if any(r.startswith(("exact_table", "plural_variant", "alias:", "fuzzy_token")) for r in m.reasons)
    ]
    matched_names = list(dict.fromkeys(explicit if explicit else [m.table for m in close]))

    primary = matches[0].table
    is_ambiguous = False
    ambiguity_reason = None

    if len(matched_names) > 1:
        hubs = sorted(
            [m for m in matches if m.table in matched_names],
            key=lambda m: (hub_scores.get(m.table, 0), m.score),
            reverse=True,
        )
        primary = hubs[0].table

    if len(close) > 1:
        hubs = sorted(close, key=lambda m: hub_scores.get(m.table, 0), reverse=True)
        hub_gap = hub_scores.get(hubs[0].table, 0) - hub_scores.get(hubs[1].table, 0)
        if hub_gap >= 2:
            primary = hubs[0].table
        elif matches[0].score - matches[1].score <= AMBIGUITY_SCORE_GAP and len(matched_names) <= 1:
            is_ambiguous = True
            ambiguity_reason = f"tables_tied:{','.join(m.table for m in close[:3])}"

    return TableResolution(
        matches=matches,
        primary=primary,
        matched_names=matched_names,
        is_ambiguous=is_ambiguous,
        ambiguity_reason=ambiguity_reason,
    )


_NUMERIC_TYPES = re.compile(r"\b(int|integer|float|double|decimal|numeric|real|number|money|bigint|smallint)\b", re.I)
_DATE_TYPES = re.compile(r"\b(date|time|timestamp|datetime)\b", re.I)
_TEXT_TYPES = re.compile(r"\b(text|varchar|char|string|clob)\b", re.I)


def _column_type_category(data_type: str) -> str:
    base = data_type.split(" | ")[0].lower()
    if _NUMERIC_TYPES.search(base):
        return "numeric"
    if _DATE_TYPES.search(base):
        return "date"
    if _TEXT_TYPES.search(base):
        return "text"
    return "other"


def score_columns(
    question_lower: str,
    table: str,
    columns: List[str],
    column_types: Dict[str, str],
    alias_context: AliasContext,
    intent: IntentResult,
    prefer_numeric: bool = False,
    prefer_date: bool = False,
) -> ColumnResolution:
    raw: Dict[str, Tuple[float, List[str]]] = {}

    def add_score(col: str, points: float, reason: str) -> None:
        current, reasons = raw.get(col, (0.0, []))
        raw[col] = (current + points, reasons + [reason])

    for col in columns:
        cl = col.lower()
        if re.search(r"\b" + re.escape(cl) + r"\b", question_lower):
            add_score(col, 10.0, "exact_column")

        for token in table_tokens_in_question(question_lower):
            if len(token) >= 3 and _fuzzy_ratio(token, cl) >= FUZZY_TABLE_THRESHOLD:
                add_score(col, 6.0 * _fuzzy_ratio(token, cl), f"fuzzy:{token}")

        for token in table_tokens_in_question(question_lower):
            mapped = alias_context.resolve_column_hint(token)
            if mapped and mapped.lower() in cl:
                add_score(col, 8.0, f"alias:{token}")

        cat = _column_type_category(column_types.get(col, ""))
        if prefer_numeric and cat == "numeric":
            add_score(col, 2.0, "type:numeric")
        if prefer_date and cat == "date":
            add_score(col, 2.0, "type:date")
        if intent.primary == QueryIntent.LOOKUP and cat == "text":
            add_score(col, 1.0, "type:text_lookup")

    matches = [
        ColumnMatch(column=name, score=score, reasons=reasons)
        for name, (score, reasons) in raw.items()
        if score > 0
    ]
    matches.sort(key=lambda m: m.score, reverse=True)

    if not matches:
        return ColumnResolution(matches=[], best=None, is_ambiguous=False)

    best = matches[0].column
    is_ambiguous = False
    ambiguity_reason = None
    if len(matches) > 1 and matches[0].score - matches[1].score <= 1.5:
        if intent.primary in (QueryIntent.LOOKUP, QueryIntent.AGGREGATION):
            is_ambiguous = True
            ambiguity_reason = f"columns_tied:{matches[0].column},{matches[1].column}"

    return ColumnResolution(
        matches=matches,
        best=best,
        is_ambiguous=is_ambiguous,
        ambiguity_reason=ambiguity_reason,
    )


def should_escalate_for_ambiguity(
    table_resolution: TableResolution,
    column_resolution: Optional[ColumnResolution],
    intent: IntentResult,
) -> Optional[str]:
    if table_resolution.is_ambiguous and intent.primary not in (QueryIntent.JOIN, QueryIntent.GROUPING):
        return table_resolution.ambiguity_reason or "ambiguous_table"
    if column_resolution and column_resolution.is_ambiguous:
        return column_resolution.ambiguity_reason or "ambiguous_column"
    return None
