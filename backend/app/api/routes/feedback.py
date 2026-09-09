from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.core.learning.retrieval import find_similar_examples
from app.core.learning.service import create_query_feedback
from app.database import get_db
from app.models.connection import DatabaseConnection
from app.models.user import User
from app.schemas.feedback import (
    FeedbackCreate,
    FeedbackExampleResponse,
    FeedbackExamplesResponse,
    FeedbackResponse,
)

router = APIRouter(prefix="/feedback", tags=["Query Learning Loop"])


def _get_owned_connection(connection_id: int, user_id: int, db: Session) -> DatabaseConnection:
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == user_id,
    ).first()
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database connection not found")
    return connection


@router.post("/", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_connection(payload.connection_id, current_user.id, db)

    if not payload.audit_log_id and not payload.question:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Either audit_log_id or question must be provided.",
        )

    try:
        feedback = create_query_feedback(
            db=db,
            user_id=current_user.id,
            connection_id=payload.connection_id,
            question=payload.question or "",
            rating=payload.rating,
            generated_sql=payload.generated_sql,
            corrected_sql=payload.corrected_sql,
            comment=payload.comment,
            audit_log_id=payload.audit_log_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return feedback


@router.get("/examples", response_model=FeedbackExamplesResponse)
def get_feedback_examples(
    connection_id: int = Query(..., gt=0),
    question: str = Query(..., min_length=1, max_length=2000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_connection(connection_id, current_user.id, db)
    examples = find_similar_examples(
        question=question,
        connection_id=connection_id,
        user_id=current_user.id,
        db=db,
    )

    return FeedbackExamplesResponse(
        connection_id=connection_id,
        question=question,
        examples=[
            FeedbackExampleResponse(
                question=example.question,
                sql=example.sql,
                similarity=round(example.similarity, 4),
                source=example.source,
            )
            for example in examples
        ],
    )
