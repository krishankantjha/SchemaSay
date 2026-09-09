from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional

from app.core.schema.graph import SchemaGraph
from app.models.metric import MetricDefinition


@dataclass
class ResolvedMetricQuery:
    sql: str
    metric_id: int
    metric_name: str
    metric_label: str
    match_score: float
    dimensions_used: List[str] = field(default_factory=list)
    assumptions: List[str] = field(default_factory=list)


def _tokenize(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9_]+", text.lower()) if len(token) > 1}


def _score_metric_match(question: str, metric: MetricDefinition) -> float:
    question_lower = question.lower()
    question_tokens = _tokenize(question)

    score = 0.0
    candidates = [metric.name, metric.label]
    if metric.description:
        candidates.extend(metric.description.split())

    for candidate in candidates:
        candidate_lower = candidate.lower().strip()
        if not candidate_lower:
            continue
        if candidate_lower in question_lower:
            score += 3.0
        candidate_tokens = _tokenize(candidate_lower)
        overlap = question_tokens.intersection(candidate_tokens)
        score += len(overlap) * 1.5

    return score


def _infer_dimensions(question: str, metric: MetricDefinition) -> List[dict]:
    question_lower = question.lower()
    selected: List[dict] = []

    for dimension in metric.get_dimensions():
        labels = {dimension.get("name", "").lower(), dimension.get("label", "").lower()}
        labels = {label for label in labels if label}
        if any(label in question_lower for label in labels):
            selected.append(dimension)
            continue
        if re.search(rf"\bby\s+{dimension.get('name', '')}\b", question_lower):
            selected.append(dimension)
            continue
        if re.search(rf"\bby\s+{dimension.get('label', '').lower()}\b", question_lower):
            selected.append(dimension)

    if not selected and metric.get_dimensions():
        first = metric.get_dimensions()[0]
        if re.search(r"\bby\b", question_lower):
            selected.append(first)

    return selected


def _infer_time_filter(question: str, dimensions: List[dict], db_type: str) -> Optional[str]:
    question_lower = question.lower()
    time_dimension = next((dim for dim in dimensions if dim.get("dimension_type") == "time"), None)
    if not time_dimension and dimensions:
        for dim in dimensions:
            column_ref = dim.get("column_ref", "").lower()
            if any(token in column_ref for token in ["date", "time", "month", "year", "created"]):
                time_dimension = dim
                break

    if not time_dimension:
        return None

    column_ref = time_dimension["column_ref"]
    db_type_lower = db_type.lower()

    if "last month" in question_lower:
        if db_type_lower == "sqlite":
            return (
                f"{column_ref} >= date('now', 'start of month', '-1 month') "
                f"AND {column_ref} < date('now', 'start of month')"
            )
        if db_type_lower == "postgresql":
            return (
                f"{column_ref} >= (date_trunc('month', CURRENT_DATE) - interval '1 month') "
                f"AND {column_ref} < date_trunc('month', CURRENT_DATE)"
            )
        return f"{column_ref} >= DATEADD(month, DATEDIFF(month, 0, GETDATE()) - 1, 0)"

    if "this month" in question_lower or "current month" in question_lower:
        if db_type_lower == "sqlite":
            return f"{column_ref} >= date('now', 'start of month')"
        if db_type_lower == "postgresql":
            return f"{column_ref} >= date_trunc('month', CURRENT_DATE)"
        return f"{column_ref} >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0)"

    if "last year" in question_lower:
        if db_type_lower == "sqlite":
            return (
                f"{column_ref} >= date('now', 'start of year', '-1 year') "
                f"AND {column_ref} < date('now', 'start of year')"
            )
        if db_type_lower == "postgresql":
            return (
                f"{column_ref} >= (date_trunc('year', CURRENT_DATE) - interval '1 year') "
                f"AND {column_ref} < date_trunc('year', CURRENT_DATE)"
            )
        return f"{column_ref} >= DATEADD(year, DATEDIFF(year, 0, GETDATE()) - 1, 0)"

    year_match = re.search(r"\b(20\d{2})\b", question_lower)
    if year_match:
        year = year_match.group(1)
        return f"{column_ref} >= '{year}-01-01' AND {column_ref} < '{int(year) + 1}-01-01'"

    return None


def build_metric_sql(
    metric: MetricDefinition,
    dimensions: List[dict],
    db_type: str,
    question: str,
) -> tuple[str, List[str]]:
    assumptions: List[str] = []
    select_parts: List[str] = []
    group_parts: List[str] = []

    for dimension in dimensions:
        column_ref = dimension["column_ref"]
        alias = dimension["name"]
        select_parts.append(f"{column_ref} AS {alias}")
        group_parts.append(column_ref)
        assumptions.append(f"Grouped results by dimension '{dimension.get('label', alias)}'.")

    select_parts.append(f"{metric.sql_expression} AS {metric.name}")

    sql = f"SELECT {', '.join(select_parts)} FROM {metric.base_table}"
    where_clauses: List[str] = []

    if metric.default_filters and metric.default_filters.strip():
        where_clauses.append(metric.default_filters.strip())
        assumptions.append("Applied default metric filters.")

    time_filter = _infer_time_filter(question, dimensions, db_type)
    if time_filter:
        where_clauses.append(time_filter)
        assumptions.append("Applied time range inferred from the question.")

    if where_clauses:
        sql += " WHERE " + " AND ".join(where_clauses)

    if group_parts:
        sql += " GROUP BY " + ", ".join(group_parts)

    if re.search(r"\b(top|first)\s+(\d+)\b", question.lower()):
        limit_match = re.search(r"\b(top|first)\s+(\d+)\b", question.lower())
        limit_value = limit_match.group(2)
        if db_type.lower() == "mssql":
            sql = sql.replace("SELECT ", f"SELECT TOP {limit_value} ", 1)
        else:
            sql += f" LIMIT {limit_value}"
        assumptions.append(f"Limited output to {limit_value} rows.")

    return sql, assumptions


def resolve_metric_question(
    question: str,
    metrics: List[MetricDefinition],
    graph: SchemaGraph,
    db_type: str,
    match_threshold: float,
    dimension_names: Optional[List[str]] = None,
) -> Optional[ResolvedMetricQuery]:
    if not metrics:
        return None

    scored = sorted(
        ((metric, _score_metric_match(question, metric)) for metric in metrics),
        key=lambda item: item[1],
        reverse=True,
    )
    best_metric, best_score = scored[0]
    if best_score < match_threshold:
        return None

    if not graph.table_exists(best_metric.base_table):
        return None

    if dimension_names:
        dimensions = [
            dim
            for dim in best_metric.get_dimensions()
            if dim.get("name") in dimension_names
        ]
    else:
        dimensions = _infer_dimensions(question, best_metric)

    sql, assumptions = build_metric_sql(best_metric, dimensions, db_type, question)
    assumptions.insert(
        0,
        f"Resolved governed metric '{best_metric.label}' (score {best_score:.1f}).",
    )

    return ResolvedMetricQuery(
        sql=sql,
        metric_id=best_metric.id,
        metric_name=best_metric.name,
        metric_label=best_metric.label,
        match_score=best_score,
        dimensions_used=[dim["name"] for dim in dimensions],
        assumptions=assumptions,
    )
