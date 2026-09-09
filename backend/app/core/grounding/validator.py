from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Set, Tuple

import sqlglot
from sqlglot import exp

from app.core.schema.graph import SchemaGraph


@dataclass
class GroundingResult:
    valid: bool
    unknown_tables: List[str] = field(default_factory=list)
    unknown_columns: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    tables_referenced: List[str] = field(default_factory=list)


def _build_alias_map(expression: exp.Expression) -> dict[str, str]:
    alias_map: dict[str, str] = {}
    for table in expression.find_all(exp.Table):
        physical_name = table.name
        alias = table.alias_or_name
        if alias:
            alias_map[alias.lower()] = physical_name
        alias_map[physical_name.lower()] = physical_name
    return alias_map


def _resolve_table_name(name: str, alias_map: dict[str, str], graph: SchemaGraph) -> Tuple[bool, str]:
    lowered = name.lower()
    physical = alias_map.get(lowered, name)
    if graph.table_exists(physical):
        return True, graph._resolve_table_key(physical) or physical
    return False, name


def validate_sql_grounding(raw_sql: str, graph: SchemaGraph) -> GroundingResult:
    """
    Verifies that tables and columns referenced in SQL exist in the cached schema graph.
    """
    if not graph.tables:
        return GroundingResult(
            valid=True,
            warnings=["No schema cache available. Grounding checks were skipped."],
        )

    try:
        expressions = sqlglot.parse(raw_sql)
    except Exception as exc:
        return GroundingResult(valid=False, warnings=[f"Unable to parse SQL for grounding: {exc}"])

    if not expressions:
        return GroundingResult(valid=False, warnings=["Empty SQL statement."])

    expression = expressions[0]
    alias_map = _build_alias_map(expression)

    unknown_tables: Set[str] = set()
    unknown_columns: Set[str] = set()
    tables_referenced: Set[str] = set()

    for table in expression.find_all(exp.Table):
        exists, resolved = _resolve_table_name(table.name, alias_map, graph)
        if exists:
            tables_referenced.add(resolved)
        else:
            unknown_tables.add(table.name)

    for column in expression.find_all(exp.Column):
        col_name = column.name
        table_ref = column.table

        if table_ref:
            exists, resolved_table = _resolve_table_name(table_ref, alias_map, graph)
            if not exists:
                unknown_tables.add(table_ref)
                continue
            if not graph.column_exists(resolved_table, col_name):
                unknown_columns.add(f"{resolved_table}.{col_name}")
            tables_referenced.add(resolved_table)
        elif len(tables_referenced) == 1:
            only_table = next(iter(tables_referenced))
            if not graph.column_exists(only_table, col_name):
                unknown_columns.add(f"{only_table}.{col_name}")
        elif tables_referenced:
            if not graph.column_exists_in_any_table(col_name):
                unknown_columns.add(col_name)
        elif not graph.column_exists_in_any_table(col_name):
            unknown_columns.add(col_name)

    warnings: List[str] = []
    if unknown_tables:
        warnings.append(
            "Unknown tables: " + ", ".join(sorted(unknown_tables))
        )
    if unknown_columns:
        warnings.append(
            "Unknown columns: " + ", ".join(sorted(unknown_columns))
        )

    return GroundingResult(
        valid=not unknown_tables and not unknown_columns,
        unknown_tables=sorted(unknown_tables),
        unknown_columns=sorted(unknown_columns),
        warnings=warnings,
        tables_referenced=sorted(tables_referenced),
    )
