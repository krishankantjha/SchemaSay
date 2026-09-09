from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.connection import DatabaseConnection
from app.schemas.assistant import QueryRequest, RawQueryRequest, QueryResponse, QueryExplanation
from app.api.routes.auth import get_current_user
from app.core.pipeline import QueryPipeline, PipelineError

router = APIRouter(prefix="/assistant", tags=["AI Copilot & SQL Workbench"])


def get_user_connection_or_404(connection_id: int, user_id: int, db: Session) -> DatabaseConnection:
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == user_id,
    ).first()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found",
        )
    return connection


def _pipeline_error_to_http(exc: PipelineError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


def _to_response(result) -> QueryResponse:
    return QueryResponse(
        sql=result.sql,
        success=result.success,
        error=result.error,
        results=result.results,
        execution_duration_ms=result.execution_duration_ms,
        chart_config=result.chart_config,
        explanation=QueryExplanation(**result.explanation),
        correlation_id=result.correlation_id,
    )


@router.post("/query", response_model=QueryResponse, status_code=status.HTTP_200_OK)
def query_database_with_assistant(
    payload: QueryRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connection = get_user_connection_or_404(payload.connection_id, current_user.id, db)
    pipeline = QueryPipeline(db)

    try:
        result = pipeline.run_natural_language(
            user_id=current_user.id,
            connection=connection,
            question=payload.question,
        )
    except PipelineError as exc:
        raise _pipeline_error_to_http(exc)

    return _to_response(result)


@router.post("/execute-raw", response_model=QueryResponse, status_code=status.HTTP_200_OK)
def execute_raw_sql_query(
    payload: RawQueryRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connection = get_user_connection_or_404(payload.connection_id, current_user.id, db)
    pipeline = QueryPipeline(db)

    try:
        result = pipeline.run_raw_sql(
            user_id=current_user.id,
            connection=connection,
            sql=payload.sql_query,
        )
    except PipelineError as exc:
        raise _pipeline_error_to_http(exc)

    return _to_response(result)
