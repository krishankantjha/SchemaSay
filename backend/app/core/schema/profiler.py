from __future__ import annotations

import json
import logging
from typing import Dict, List, Tuple

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.config import settings

logger = logging.getLogger("schemasay.profiler")


def _quote(engine: Engine, identifier: str) -> str:
    return engine.dialect.identifier_preparer.quote(identifier)


def _count_rows(engine: Engine, table_name: str) -> int | None:
    quoted_table = _quote(engine, table_name)
    try:
        with engine.connect() as conn:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {quoted_table}"))
            return int(result.scalar() or 0)
    except Exception as exc:
        logger.warning("Failed to count rows for table %s: %s", table_name, exc)
        return None


def _profile_column(
    engine: Engine,
    table_name: str,
    column_name: str,
    sample_rows: int,
) -> Dict[str, object]:
    quoted_table = _quote(engine, table_name)
    quoted_column = _quote(engine, column_name)

    stats: Dict[str, object] = {
        "null_ratio": None,
        "distinct_count": None,
        "sample_values": None,
    }

    try:
        with engine.connect() as conn:
            aggregate_sql = text(
                f"""
                SELECT
                    AVG(CASE WHEN {quoted_column} IS NULL THEN 1.0 ELSE 0.0 END) AS null_ratio,
                    COUNT(DISTINCT {quoted_column}) AS distinct_count
                FROM (
                    SELECT {quoted_column}
                    FROM {quoted_table}
                    LIMIT :sample_rows
                ) sampled
                """
            )
            row = conn.execute(aggregate_sql, {"sample_rows": sample_rows}).mappings().first()
            if row:
                stats["null_ratio"] = float(row["null_ratio"] or 0.0)
                stats["distinct_count"] = int(row["distinct_count"] or 0)

            sample_sql = text(
                f"""
                SELECT DISTINCT {quoted_column} AS value
                FROM {quoted_table}
                WHERE {quoted_column} IS NOT NULL
                LIMIT 3
                """
            )
            samples = [
                str(item["value"])
                for item in conn.execute(sample_sql).mappings().all()
            ]
            if samples:
                stats["sample_values"] = json.dumps(samples)
    except Exception as exc:
        logger.warning(
            "Failed to profile column %s.%s: %s",
            table_name,
            column_name,
            exc,
        )

    return stats


def profile_schema_metadata(
    engine: Engine,
    metadata_list: List[dict],
    max_tables: int | None = None,
    sample_rows: int | None = None,
) -> Tuple[List[dict], List[dict]]:
    """
    Enriches introspected schema metadata with sampled column statistics and table row counts.
    """
    max_tables = max_tables or settings.SCHEMA_PROFILE_MAX_TABLES
    sample_rows = sample_rows or settings.SCHEMA_PROFILE_SAMPLE_ROWS

    grouped: Dict[str, List[dict]] = {}
    for entry in metadata_list:
        grouped.setdefault(entry["table_name"], []).append(entry)

    enriched_metadata: List[dict] = []
    table_stats: List[dict] = []

    for index, table_name in enumerate(sorted(grouped.keys())):
        columns = grouped[table_name]
        if index >= max_tables:
            enriched_metadata.extend(columns)
            continue

        row_count = _count_rows(engine, table_name)
        table_stats.append({"table_name": table_name, "row_count": row_count})

        for column in columns:
            profile = _profile_column(
                engine=engine,
                table_name=table_name,
                column_name=column["column_name"],
                sample_rows=sample_rows,
            )
            enriched_metadata.append({**column, **profile})

    return enriched_metadata, table_stats
