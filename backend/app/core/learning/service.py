from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.core.security.sql_validator import validate_sql_structure
from app.models.connection import QueryAuditLog
from app.models.learning import QueryFeedback


ALLOWED_RATINGS = {"thumbs_up", "thumbs_down", "corrected"}


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
) -> QueryFeedback:
    if rating not in ALLOWED_RATINGS:
        raise ValueError(f"Invalid rating '{rating}'. Allowed values: {', '.join(sorted(ALLOWED_RATINGS))}")

    if rating == "corrected":
        if not corrected_sql or not corrected_sql.strip():
            raise ValueError("corrected_sql is required when rating is 'corrected'.")
        is_safe, error = validate_sql_structure(corrected_sql)
        if not is_safe:
            raise ValueError(f"Corrected SQL failed safety validation: {error}")

    if audit_log_id is not None:
        audit_log = db.query(QueryAuditLog).filter(
            QueryAuditLog.id == audit_log_id,
            QueryAuditLog.user_id == user_id,
        ).first()
        if not audit_log:
            raise ValueError("Audit log not found for this user.")
        if audit_log.connection_id != connection_id:
            raise ValueError("Audit log does not belong to the provided connection.")
        question = audit_log.question
        generated_sql = generated_sql or audit_log.sql_query

    feedback = QueryFeedback(
        user_id=user_id,
        connection_id=connection_id,
        audit_log_id=audit_log_id,
        question=question,
        generated_sql=generated_sql,
        corrected_sql=corrected_sql,
        rating=rating,
        comment=comment,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback
