from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.connection import QueryAuditLog

logger = logging.getLogger("schemasay.audit")


@dataclass
class AuditMetadata:
    correlation_id: Optional[str] = None
    confidence_score: Optional[int] = None
    grounded: Optional[bool] = None
    tables_accessed: Optional[List[str]] = None
    row_count: Optional[int] = None
    resolution_source: Optional[str] = None
    metric_id: Optional[int] = None


def log_audit_transaction(
    user_id: int,
    connection_id: int,
    question: str,
    sql_query: str,
    duration_ms: float,
    status: str,
    error_message: Optional[str],
    db: Session,
    metadata: Optional[AuditMetadata] = None,
) -> Optional[int]:
    """
    Inserts a query execution record into the platform audit log table
    using an isolated session transaction block to prevent session corruption.
    """
    from sqlalchemy.orm import sessionmaker

    SessionLocal = sessionmaker(bind=db.get_bind())
    isolated_db = SessionLocal()
    audit_id = None
    try:
        audit_log = QueryAuditLog(
            user_id=user_id,
            connection_id=connection_id,
            question=question,
            sql_query=sql_query,
            execution_duration_ms=int(duration_ms),
            status=status,
            error_message=error_message,
        )
        if metadata:
            audit_log.correlation_id = metadata.correlation_id
            audit_log.confidence_score = metadata.confidence_score
            audit_log.grounded = metadata.grounded
            audit_log.row_count = metadata.row_count
            audit_log.resolution_source = metadata.resolution_source
            audit_log.metric_id = metadata.metric_id
            if metadata.tables_accessed is not None:
                audit_log.tables_accessed_json = json.dumps(metadata.tables_accessed)

        isolated_db.add(audit_log)
        isolated_db.commit()
        isolated_db.refresh(audit_log)
        audit_id = audit_log.id
    except Exception as exc:
        isolated_db.rollback()
        logger.error("Failed to save QueryAuditLog transaction metrics: %s", exc)
    finally:
        isolated_db.close()

    return audit_id
