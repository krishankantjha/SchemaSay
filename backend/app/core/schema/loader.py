from __future__ import annotations

from typing import List

from sqlalchemy.orm import Session

from app.core.schema.graph import SchemaGraph
from app.models.connection import DatabaseSchemaCache, SchemaTableStats


def load_schema_metadata(db: Session, connection_id: int) -> List[dict]:
    """Load cached column metadata for a connection as graph-ready dicts."""
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


def load_schema_graph(db: Session, connection_id: int) -> SchemaGraph:
    """Build a SchemaGraph from cached schema and table statistics."""
    metadata = load_schema_metadata(db, connection_id)
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
