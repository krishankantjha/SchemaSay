from __future__ import annotations

import json
from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.security.sql_validator import validate_sql_structure
from app.models.connection import QueryAuditLog
from app.models.learning import QueryFeedback


ALLOWED_RATINGS = {"thumbs_up", "thumbs_down", "corrected"}


def _resolve_audit_log_id(
    db: Session,
    user_id: int,
    connection_id: int,
    audit_log_id: Optional[int],
    correlation_id: Optional[str],
) -> Optional[int]:
    if audit_log_id is not None:
        audit_log = db.query(QueryAuditLog).filter(
            QueryAuditLog.id == audit_log_id,
            QueryAuditLog.user_id == user_id,
        ).first()
        if not audit_log:
            raise ValueError("Audit log not found for this user.")
        if audit_log.connection_id != connection_id:
            raise ValueError("Audit log does not belong to the provided connection.")
        return audit_log.id

    if not correlation_id:
        return None

    audit_log = (
        db.query(QueryAuditLog)
        .filter(
            QueryAuditLog.correlation_id == correlation_id,
            QueryAuditLog.user_id == user_id,
            QueryAuditLog.connection_id == connection_id,
        )
        .order_by(QueryAuditLog.created_at.desc())
        .first()
    )
    return audit_log.id if audit_log else None


def create_query_feedback(
    db: Session,
    user_id: int,
    connection_id: int,
    question: str,
    rating: str,
    generated_sql: Optional[str] = None,
    corrected_sql: Optional[str] = None,
    comment: Optional[str] = None,
    audit_log_id: Optional[int] = None,
    correlation_id: Optional[str] = None,
    feedback_categories: Optional[List[str]] = None,
    result_row_count: Optional[int] = None,
    result_columns: Optional[List[str]] = None,
) -> QueryFeedback:
    if rating not in ALLOWED_RATINGS:
        raise ValueError(f"Invalid rating '{rating}'. Allowed values: {', '.join(sorted(ALLOWED_RATINGS))}")

    categories = feedback_categories or []
    normalized_comment = (comment or "").strip()

    if rating == "thumbs_down" and not categories and not normalized_comment:
        raise ValueError("Select at least one reason or add a short note for negative feedback.")

    if rating == "thumbs_up":
        learning_sql = (corrected_sql or generated_sql or "").strip()
        if not learning_sql:
            raise ValueError(
                "generated_sql is required for positive feedback so verified answers can improve future queries."
            )

    if rating == "corrected":
        if not corrected_sql or not corrected_sql.strip():
            raise ValueError("corrected_sql is required when rating is 'corrected'.")
        is_safe, error = validate_sql_structure(corrected_sql)
        if not is_safe:
            raise ValueError(f"Corrected SQL failed safety validation: {error}")

    resolved_audit_id = _resolve_audit_log_id(
        db=db,
        user_id=user_id,
        connection_id=connection_id,
        audit_log_id=audit_log_id,
        correlation_id=correlation_id,
    )

    if resolved_audit_id is not None:
        audit_log = db.query(QueryAuditLog).filter(QueryAuditLog.id == resolved_audit_id).first()
        if audit_log:
            question = audit_log.question
            generated_sql = generated_sql or audit_log.sql_query

    feedback = QueryFeedback(
        user_id=user_id,
        connection_id=connection_id,
        audit_log_id=resolved_audit_id,
        correlation_id=correlation_id,
        question=question,
        generated_sql=generated_sql,
        corrected_sql=corrected_sql,
        rating=rating,
        comment=normalized_comment or None,
        feedback_categories_json=json.dumps(categories) if categories else None,
        result_row_count=result_row_count,
        result_columns_json=json.dumps(result_columns) if result_columns else None,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback
