import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.core.pipeline import PipelineError, QueryPipeline
from app.database import get_db
from app.models.connection import DatabaseConnection, QueryAuditLog
from app.models.user import User
from app.schemas.governance import AuditLogDetailResponse, AuditReplayResponse

router = APIRouter(prefix="/audit", tags=["Query Audit & Governance"])


def _audit_to_response(log: QueryAuditLog) -> AuditLogDetailResponse:
    tables_accessed: List[str] = []
    if log.tables_accessed_json:
        try:
            tables_accessed = json.loads(log.tables_accessed_json)
        except json.JSONDecodeError:
            tables_accessed = []

    return AuditLogDetailResponse(
        id=log.id,
        user_id=log.user_id,
        connection_id=log.connection_id,
        question=log.question,
        sql_query=log.sql_query,
        execution_duration_ms=log.execution_duration_ms,
        status=log.status,
        error_message=log.error_message,
        correlation_id=log.correlation_id,
        confidence_score=log.confidence_score,
        grounded=log.grounded,
        tables_accessed=tables_accessed,
        row_count=log.row_count,
        resolution_source=log.resolution_source,
        metric_id=log.metric_id,
        created_at=log.created_at,
    )


@router.get("/", response_model=List[AuditLogDetailResponse])
def list_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    connection_id: Optional[int] = Query(None, gt=0),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(QueryAuditLog).filter(QueryAuditLog.user_id == current_user.id)

    if connection_id is not None:
        query = query.filter(QueryAuditLog.connection_id == connection_id)
    if status_filter:
        query = query.filter(QueryAuditLog.status == status_filter)

    logs = (
        query.order_by(QueryAuditLog.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return [_audit_to_response(log) for log in logs]


@router.get("/{audit_id}", response_model=AuditLogDetailResponse)
def get_audit_log(
    audit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.query(QueryAuditLog).filter(
        QueryAuditLog.id == audit_id,
        QueryAuditLog.user_id == current_user.id,
    ).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit log not found")
    return _audit_to_response(log)


@router.post("/{audit_id}/replay", response_model=AuditReplayResponse)
def replay_audit_log(
    audit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.query(QueryAuditLog).filter(
        QueryAuditLog.id == audit_id,
        QueryAuditLog.user_id == current_user.id,
    ).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit log not found")
    if not log.connection_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audit log is not associated with an active connection.",
        )

    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == log.connection_id,
        DatabaseConnection.user_id == current_user.id,
    ).first()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection for this audit log no longer exists.",
        )

    pipeline = QueryPipeline(db)
    try:
        result = pipeline.run_raw_sql(
            user_id=current_user.id,
            connection=connection,
            sql=log.sql_query,
            question=f"Replay of audit #{audit_id}: {log.question}",
        )
    except PipelineError as exc:
        return AuditReplayResponse(
            audit_id=audit_id,
            sql=log.sql_query,
            success=False,
            error=exc.message,
        )

    return AuditReplayResponse(
        audit_id=audit_id,
        sql=result.sql,
        success=True,
        results=result.results,
        execution_duration_ms=result.execution_duration_ms,
    )
