import logging
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

logger = logging.getLogger("schemasay.query")

from app.database import get_db
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.api.routes.assistant import get_user_connection_or_404
from app.core.pipeline import QueryPipeline, PipelineError
from app.core.visualization.chart_service import ChartConfig
from app.utils.rate_limiter import query_limiter

router = APIRouter(prefix="/query", tags=["SQL Execution Engine"])


class DirectQueryRequest(BaseModel):
    """Request payload representing manual raw SQL statement input options."""
    connection_id: int = Field(..., gt=0)
    sql_query: str = Field(..., min_length=1, max_length=10000)


class DirectQueryResponse(BaseModel):
    """Standardized response structure containing DataFrame rows and columns metrics."""
    columns: List[str] = Field(default_factory=list)
    rows: List[Dict[str, Any]] = Field(default_factory=list)
    row_count: int
    execution_time_ms: float
    truncated: bool = False
    query_id: str
    chart_config: ChartConfig = Field(default_factory=ChartConfig)


def _pipeline_error_to_http(exc: PipelineError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.post("/execute", response_model=DirectQueryResponse, status_code=status.HTTP_200_OK)
async def execute_raw_query(
    payload: DirectQueryRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Executes SQL through the shared query pipeline (security, grounding,
    governance policy, audit) before running against the target database.
    """
    client_ip = request.client.host if request.client else "unknown"
    limiter_key = f"user:{current_user.id}:ip:{client_ip}"
    if query_limiter.check_rate_limit(limiter_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many query execution requests. Please wait before trying again.",
        )

    connection = get_user_connection_or_404(payload.connection_id, current_user.id, db)
    pipeline = QueryPipeline(db)

    try:
        result = await run_in_threadpool(
            pipeline.run_raw_sql,
            user_id=current_user.id,
            connection=connection,
            sql=payload.sql_query,
            question="Manual SQL Editor Query",
        )
    except PipelineError as exc:
        raise _pipeline_error_to_http(exc)

    rows = result.results or []
    columns = list(rows[0].keys()) if rows else []

    logger.info(
        "[%s] SQL query executed on connection ID: %s",
        result.correlation_id,
        connection.id,
    )

    return DirectQueryResponse(
        columns=columns,
        rows=rows,
        row_count=len(rows),
        execution_time_ms=result.execution_duration_ms,
        truncated=len(rows) >= 10000,
        query_id=result.correlation_id,
        chart_config=result.chart_config,
    )


class FormatQueryRequest(BaseModel):
    """Request payload containing the SQL query to beautify."""
    sql_query: str = Field(..., min_length=1, max_length=10000)


class FormatQueryResponse(BaseModel):
    """Response payload containing the beautified SQL query."""
    formatted_sql: str


@router.post("/format", response_model=FormatQueryResponse, status_code=status.HTTP_200_OK)
def format_query(
    payload: FormatQueryRequest,
    current_user: User = Depends(get_current_user),
):
    """Beautifies manual SQL statement using sqlglot."""
    try:
        import sqlglot
        formatted = sqlglot.transpile(payload.sql_query, pretty=True)[0]
        return FormatQueryResponse(formatted_sql=formatted)
    except Exception as e:
        logger.warning("SQL Formatting parsing error: %s. Returning original SQL.", e)
        return FormatQueryResponse(formatted_sql=payload.sql_query)
