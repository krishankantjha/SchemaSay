from __future__ import annotations

from typing import List, Set

import sqlglot
from sqlglot import exp

from app.config import settings
from app.core.schema.graph import SchemaGraph


def _extract_referenced_columns(sql: str, tables_used: List[str]) -> Set[tuple[str, str]]:
    referenced: Set[tuple[str, str]] = set()
    try:
        expression = sqlglot.parse_one(sql)
    except Exception:
        return referenced

    alias_map = {}
    for table in expression.find_all(exp.Table):
        alias_map[table.alias_or_name.lower()] = table.name

    resolved_tables = set()
    for table in tables_used:
        resolved_tables.add(table)

    for column in expression.find_all(exp.Column):
        if not column.name or column.name == "*":
            continue
        if column.table:
            table_name = alias_map.get(column.table.lower(), column.table)
            referenced.add((table_name, column.name))
        elif len(resolved_tables) == 1:
            referenced.add((next(iter(resolved_tables)), column.name))

    return referenced


def build_data_quality_warnings(sql: str, graph: SchemaGraph, tables_used: List[str]) -> List[str]:
    warnings: List[str] = []
    threshold = settings.SCHEMA_PROFILE_NULL_WARNING_THRESHOLD

    for table_name in tables_used:
        row_count = graph.table_row_counts.get(table_name)
        if row_count == 0:
            warnings.append(f"Table '{table_name}' appears to be empty.")

    for table_name, column_name in _extract_referenced_columns(sql, tables_used):
        column = graph.get_column(table_name, column_name)
        if not column:
            continue
        if column.null_ratio is not None and column.null_ratio >= threshold:
            pct = round(column.null_ratio * 100, 1)
            warnings.append(
                f"Column '{table_name}.{column_name}' is {pct}% null in sampled data — results may be incomplete."
            )

    return warnings
