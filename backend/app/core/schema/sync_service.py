from __future__ import annotations

import json
from typing import List

from sqlalchemy.orm import Session

from app.core.governance.pii import detect_pii_column
from app.core.schema.introspector import reflect_database_schema
from app.core.schema.memory_cache import schema_memory_cache
from app.core.schema.profiler import profile_schema_metadata
from app.core.schema.alias_suggestions import suggest_aliases_from_metadata
from app.models.connection import (
    ConnectionSchemaAlias,
    DatabaseConnection,
    DatabaseSchemaCache,
    SchemaTableStats,
)


def _serialize_sample_values(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return json.dumps(value)


def sync_connection_schema_cache(
    db: Session,
    connection: DatabaseConnection,
    engine,
    profile: bool = False,
) -> dict:
    """
    Reflects target database schema into platform cache tables.
    Optionally profiles table/column statistics for quality warnings.
    """
    metadata_list = reflect_database_schema(engine)
    table_stats: List[dict] = []

    if profile and metadata_list:
        metadata_list, table_stats = profile_schema_metadata(engine, metadata_list)

    db.query(DatabaseSchemaCache).filter(
        DatabaseSchemaCache.connection_id == connection.id
    ).delete()
    db.query(SchemaTableStats).filter(
        SchemaTableStats.connection_id == connection.id
    ).delete()

    cache_entries = [
        DatabaseSchemaCache(
            connection_id=connection.id,
            table_name=entry["table_name"],
            column_name=entry["column_name"],
            data_type=entry["data_type"],
            is_nullable=entry.get("is_nullable"),
            null_ratio=entry.get("null_ratio"),
            distinct_count=entry.get("distinct_count"),
            sample_values=_serialize_sample_values(entry.get("sample_values")),
            is_pii=detect_pii_column(
                entry["table_name"],
                entry["column_name"],
                entry.get("data_type", ""),
                _serialize_sample_values(entry.get("sample_values")),
            ),
        )
        for entry in metadata_list
    ]
    db.bulk_save_objects(cache_entries)

    if table_stats:
        stats_entries = [
            SchemaTableStats(
                connection_id=connection.id,
                table_name=stat["table_name"],
                row_count=stat["row_count"],
            )
            for stat in table_stats
        ]
        db.bulk_save_objects(stats_entries)

    db.commit()
    schema_memory_cache.invalidate(connection.id)

    existing_aliases = (
        db.query(ConnectionSchemaAlias)
        .filter(ConnectionSchemaAlias.connection_id == connection.id)
        .all()
    )
    suggested = suggest_aliases_from_metadata(
        metadata_list,
        [{"alias_token": alias.alias_token} for alias in existing_aliases],
    )

    return {
        "columns_synced": len(cache_entries),
        "tables_synced": len({entry["table_name"] for entry in metadata_list}),
        "profiled_tables": len(table_stats),
        "suggested_aliases": [
            {
                "alias_type": item.alias_type,
                "alias_token": item.alias_token,
                "target_table": item.target_table,
                "target_column": item.target_column,
                "reason": item.reason,
            }
            for item in suggested
        ],
    }
