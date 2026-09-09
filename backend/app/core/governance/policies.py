from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import List, Optional

import sqlglot
from sqlglot import exp

from app.core.schema.graph import SchemaGraph
from app.models.governance import ConnectionPolicy


@dataclass
class PolicyEvaluationResult:
    allowed: bool
    warnings: List[str] = field(default_factory=list)
    message: Optional[str] = None


def _parse_json_list(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return [str(item) for item in data]
    except json.JSONDecodeError:
        return []


def _extract_sql_references(sql: str) -> tuple[set[str], set[str]]:
    tables: set[str] = set()
    columns: set[str] = set()

    try:
        expression = sqlglot.parse_one(sql)
    except Exception:
        return tables, columns

    for table in expression.find_all(exp.Table):
        tables.add(table.name.lower())

    for column in expression.find_all(exp.Column):
        if column.table:
            columns.add(f"{column.table.lower()}.{column.name.lower()}")
        else:
            columns.add(column.name.lower())

    return tables, columns


def evaluate_sql_policy(
    sql: str,
    graph: SchemaGraph,
    policy: Optional[ConnectionPolicy],
    confidence: Optional[int] = None,
) -> PolicyEvaluationResult:
    if policy is None:
        return PolicyEvaluationResult(allowed=True)

    warnings: List[str] = []
    blocked_tables = {name.lower() for name in _parse_json_list(policy.blocked_tables_json)}
    blocked_columns = {name.lower() for name in _parse_json_list(policy.blocked_columns_json)}

    referenced_tables, referenced_columns = _extract_sql_references(sql)

    for table in referenced_tables:
        if table in blocked_tables:
            return PolicyEvaluationResult(
                allowed=False,
                message=f"Access to table '{table}' is blocked by connection policy.",
            )

    for column in referenced_columns:
        if column in blocked_columns:
            return PolicyEvaluationResult(
                allowed=False,
                message=f"Access to column '{column}' is blocked by connection policy.",
            )
        bare = column.split(".")[-1]
        if bare in blocked_columns:
            return PolicyEvaluationResult(
                allowed=False,
                message=f"Access to column '{bare}' is blocked by connection policy.",
            )

    if policy.require_high_confidence and confidence is not None:
        threshold = policy.min_confidence_threshold or 50
        if confidence < threshold:
            return PolicyEvaluationResult(
                allowed=False,
                message=f"Query confidence {confidence} is below policy threshold {threshold}.",
            )

    if policy.block_pii_access:
        for table_name in referenced_tables:
            table_key = graph._resolve_table_key(table_name)
            if not table_key:
                continue
            for col in graph.tables.get(table_key, []):
                if col.is_pii and col.name.lower() in referenced_columns.union(
                    {c.split(".")[-1] for c in referenced_columns}
                ):
                    return PolicyEvaluationResult(
                        allowed=False,
                        message=f"Access to PII column '{table_key}.{col.name}' is blocked by connection policy.",
                    )

    if blocked_tables or blocked_columns:
        warnings.append("Query evaluated against configured connection access policy.")

    return PolicyEvaluationResult(allowed=True, warnings=warnings)
