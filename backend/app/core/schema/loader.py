from __future__ import annotations

from typing import List, Tuple

from sqlalchemy.orm import Session

from app.core.schema.graph import SchemaGraph
from app.core.schema.memory_cache import schema_memory_cache
from app.models.connection import DatabaseSchemaCache, SchemaTableStats


def _fetch_schema_metadata(db: Session, connection_id: int) -> List[dict]:
    cache_rows = (
        db.query(DatabaseSchemaCache)
        .filter(DatabaseSchemaCache.connection_id == connection_id)
        .order_by(DatabaseSchemaCache.table_name, DatabaseSchemaCache.column_name)
        .all()
    )
    return [
        {
            "table_name": row.table_name,
            "column_name": row.column_name,
            "data_type": row.data_type,
            "is_nullable": row.is_nullable,
            "null_ratio": row.null_ratio,
            "distinct_count": row.distinct_count,
            "sample_values": row.sample_values,
            "is_pii": row.is_pii,
        }
        for row in cache_rows
    ]


def _build_schema_graph(db: Session, connection_id: int, metadata: List[dict]) -> SchemaGraph:
    stats_rows = (
        db.query(SchemaTableStats)
        .filter(SchemaTableStats.connection_id == connection_id)
        .all()
    )
    table_stats = [
        {"table_name": row.table_name, "row_count": row.row_count}
        for row in stats_rows
    ]
    return SchemaGraph.from_schema_metadata(metadata, table_stats=table_stats)


def load_schema_metadata(db: Session, connection_id: int) -> List[dict]:
    """Load cached column metadata for a connection as graph-ready dicts."""
    cached = schema_memory_cache.get(connection_id)
    if cached is not None:
        return cached[0]

    metadata = _fetch_schema_metadata(db, connection_id)
    graph = _build_schema_graph(db, connection_id, metadata)
    schema_memory_cache.set(connection_id, metadata, graph)
    return metadata


def load_schema_graph(db: Session, connection_id: int) -> SchemaGraph:
    """Build a SchemaGraph from cached schema and table statistics."""
    cached = schema_memory_cache.get(connection_id)
    if cached is not None:
        return cached[1]

    metadata = _fetch_schema_metadata(db, connection_id)
    graph = _build_schema_graph(db, connection_id, metadata)
    schema_memory_cache.set(connection_id, metadata, graph)
    return graph


def load_schema_bundle(db: Session, connection_id: int) -> Tuple[List[dict], SchemaGraph]:
    """Load metadata and graph together (single cache/db round-trip when cold)."""
    cached = schema_memory_cache.get(connection_id)
    if cached is not None:
        return cached

    metadata = _fetch_schema_metadata(db, connection_id)
    graph = _build_schema_graph(db, connection_id, metadata)
    schema_memory_cache.set(connection_id, metadata, graph)
    return metadata, graph
