from __future__ import annotations

import json
from collections import deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class ColumnInfo:
    name: str
    data_type: str
    is_primary_key: bool = False
    is_foreign_key: bool = False
    fk_references: Optional[str] = None
    is_nullable: Optional[bool] = None
    null_ratio: Optional[float] = None
    distinct_count: Optional[int] = None
    sample_values: Optional[List[str]] = None
    is_pii: bool = False


@dataclass
class JoinEdge:
    from_table: str
    from_column: str
    to_table: str
    to_column: str


@dataclass
class SchemaGraph:
    """In-memory schema graph built from cached introspection metadata."""

    tables: Dict[str, List[ColumnInfo]] = field(default_factory=dict)
    table_row_counts: Dict[str, int] = field(default_factory=dict)

    @classmethod
    def from_schema_metadata(
        cls,
        metadata: List[dict],
        table_stats: Optional[List[dict]] = None,
    ) -> "SchemaGraph":
        graph = cls()
        if table_stats:
            for stat in table_stats:
                if stat.get("row_count") is not None:
                    graph.table_row_counts[stat["table_name"]] = stat["row_count"]

        for entry in metadata:
            table_name = entry["table_name"]
            column_name = entry["column_name"]
            raw_type = entry.get("data_type", "UNKNOWN")

            is_pk = "PRIMARY KEY" in raw_type
            is_fk = "FOREIGN KEY ->" in raw_type
            fk_ref = None
            if is_fk:
                fk_ref = raw_type.split("FOREIGN KEY -> ", 1)[1].strip()

            base_type = raw_type.split(" | ")[0].strip()
            sample_values = entry.get("sample_values")
            if isinstance(sample_values, str):
                try:
                    sample_values = json.loads(sample_values)
                except json.JSONDecodeError:
                    sample_values = None

            if table_name not in graph.tables:
                graph.tables[table_name] = []

            graph.tables[table_name].append(
                ColumnInfo(
                    name=column_name,
                    data_type=base_type,
                    is_primary_key=is_pk,
                    is_foreign_key=is_fk,
                    fk_references=fk_ref,
                    is_nullable=entry.get("is_nullable"),
                    null_ratio=entry.get("null_ratio"),
                    distinct_count=entry.get("distinct_count"),
                    sample_values=sample_values,
                    is_pii=bool(entry.get("is_pii", False)),
                )
            )
        return graph

    def _resolve_table_key(self, name: str) -> Optional[str]:
        lowered = name.lower()
        for table in self.tables:
            if table.lower() == lowered:
                return table
        return None

    def table_exists(self, name: str) -> bool:
        return self._resolve_table_key(name) is not None

    def column_exists(self, table: str, column: str) -> bool:
        table_key = self._resolve_table_key(table)
        if not table_key:
            return False
        col_lower = column.lower()
        return any(col.name.lower() == col_lower for col in self.tables[table_key])

    def get_column(self, table: str, column: str) -> Optional[ColumnInfo]:
        table_key = self._resolve_table_key(table)
        if not table_key:
            return None
        col_lower = column.lower()
        for col in self.tables[table_key]:
            if col.name.lower() == col_lower:
                return col
        return None

    def column_exists_in_any_table(self, column: str) -> bool:
        col_lower = column.lower()
        for columns in self.tables.values():
            if any(col.name.lower() == col_lower for col in columns):
                return True
        return False

    def foreign_key_edges(self) -> List[JoinEdge]:
        edges: List[JoinEdge] = []
        for table_name, columns in self.tables.items():
            for col in columns:
                if not col.fk_references or "." not in col.fk_references:
                    continue
                ref_table, ref_col = col.fk_references.split(".", 1)
                edges.append(
                    JoinEdge(
                        from_table=table_name,
                        from_column=col.name,
                        to_table=ref_table,
                        to_column=ref_col,
                    )
                )
        return edges

    def join_path(self, from_table: str, to_table: str) -> Optional[List[JoinEdge]]:
        start = self._resolve_table_key(from_table)
        end = self._resolve_table_key(to_table)
        if not start or not end:
            return None
        if start == end:
            return []

        adjacency: Dict[str, List[JoinEdge]] = {table: [] for table in self.tables}
        for edge in self.foreign_key_edges():
            adjacency[edge.from_table].append(edge)
            adjacency[edge.to_table].append(
                JoinEdge(
                    from_table=edge.to_table,
                    from_column=edge.to_column,
                    to_table=edge.from_table,
                    to_column=edge.from_column,
                )
            )

        queue = deque([(start, [])])
        visited = {start}

        while queue:
            current, path = queue.popleft()
            for edge in adjacency.get(current, []):
                next_table = edge.to_table
                next_path = path + [edge]
                if next_table == end:
                    return next_path
                if next_table not in visited:
                    visited.add(next_table)
                    queue.append((next_table, next_path))
        return None

    def to_tree(self) -> List[dict]:
        tables = []
        for table_name in sorted(self.tables.keys()):
            columns = []
            for col in self.tables[table_name]:
                columns.append(
                    {
                        "name": col.name,
                        "data_type": col.data_type,
                        "is_primary_key": col.is_primary_key,
                        "is_foreign_key": col.is_foreign_key,
                        "fk_references": col.fk_references,
                        "is_nullable": col.is_nullable,
                        "null_ratio": col.null_ratio,
                        "distinct_count": col.distinct_count,
                        "sample_values": col.sample_values,
                        "is_pii": col.is_pii,
                    }
                )
            tables.append(
                {
                    "name": table_name,
                    "row_count": self.table_row_counts.get(table_name),
                    "columns": columns,
                }
            )
        return tables
