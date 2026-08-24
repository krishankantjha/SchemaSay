import uuid
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
from app.core.connections.connector import get_connection
from app.core.execution.query_executor import execute_query
from app.core.execution.sql_wrapper import wrap_query_with_limit
from app.core.security.sql_validator import validate_sql_structure
from app.core.audit.audit_service import log_audit_transaction
from app.core.visualization.chart_service import select_chart_type, ChartConfig
from app.core.execution.error_mapping import raise_query_error
from app.utils.rate_limiter import query_limiter

router = APIRouter(prefix="/query", tags=["SQL Execution Engine"])

# --- Pydantic Validation Schemas ---

class DirectQueryRequest(BaseModel):
    """
    Request payload representing manual raw SQL statement input options.
    """
    connection_id: int = Field(..., gt=0)
    sql_query: str = Field(..., min_length=1, max_length=10000)

class DirectQueryResponse(BaseModel):
    """
    Standardized response structure containing DataFrame rows and columns metrics.
    """
    columns: List[str] = Field(default_factory=list)
    rows: List[Dict[str, Any]] = Field(default_factory=list)
    row_count: int
    execution_time_ms: float
    truncated: bool = False
    query_id: str
    chart_config: ChartConfig = Field(default_factory=ChartConfig)

# --- Endpoint Handlers ---

@router.post("/execute", response_model=DirectQueryResponse, status_code=status.HTTP_200_OK)
async def execute_raw_query(
    payload: DirectQueryRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verifies database connection, runs query safety filter validation checks,
    and runs the statements against the connection pool with timeout rules.
    """
    # Enforce request-scoped rate limiting to prevent Denial of Service (DoS)
    client_ip = request.client.host if request.client else "unknown"
    limiter_key = f"user:{current_user.id}:ip:{client_ip}"
    if query_limiter.check_rate_limit(limiter_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many query execution requests. Please wait before trying again."
        )

    # 1. Verify database ownership check to prevent IDOR leaks
    connection = get_user_connection_or_404(payload.connection_id, current_user.id, db)
    
    # 2. Check AST query statement security limits
    is_safe, safety_error = validate_sql_structure(payload.sql_query, connection.db_type)
    if not is_safe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=safety_error
        )

    # 3. Add dialect-aware hard row limitations wrapper
    wrapped_sql = wrap_query_with_limit(payload.sql_query, connection.db_type)

    # Generate query tracking UUID tracing ID
    query_id = str(uuid.uuid4())
    logger.info(f"[{query_id}] Initializing SQL query execution on connection ID: {connection.id}")

    # 4. Execute query using connection cache pools delegated asynchronously to worker thread pool
    engine = get_connection(connection)
    result = await run_in_threadpool(
        execute_query,
        engine=engine,
        sql_query=wrapped_sql,
        db_type=connection.db_type
    )

    if not result.success:
        # Save audit logs tracking failures
        log_audit_transaction(
            user_id=current_user.id,
            connection_id=connection.id,
            question="Manual SQL Editor Query",
            sql_query=payload.sql_query,
            duration_ms=result.execution_time_ms,
            status="failed",
            error_message=result.error_message,
            db=db
        )
        raise_query_error(result.error_message)

    # Save audit logs tracking success
    log_audit_transaction(
        user_id=current_user.id,
        connection_id=connection.id,
        question="Manual SQL Editor Query",
        sql_query=payload.sql_query,
        duration_ms=result.execution_time_ms,
        status="success",
        error_message=None,
        db=db
    )

    rows = result.rows or []
    columns = result.columns or []
    
    # Compute auto-visualization layout configurations
    chart_config = select_chart_type(columns, rows, payload.sql_query)

    return DirectQueryResponse(
        columns=columns,
        rows=rows,
        row_count=len(rows),
        execution_time_ms=result.execution_time_ms,
        truncated=result.truncated,
        query_id=query_id,
        chart_config=chart_config
    )

# --- SQL Format routes ---

class FormatQueryRequest(BaseModel):
    """
    Request payload containing the SQL query to beautify.
    """
    sql_query: str = Field(..., min_length=1, max_length=10000)

class FormatQueryResponse(BaseModel):
    """
    Response payload containing the beautified SQL query.
    """
    formatted_sql: str

@router.post("/format", response_model=FormatQueryResponse, status_code=status.HTTP_200_OK)
def format_query(
    payload: FormatQueryRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Beautifies manual SQL statement using sqlglot.
    """
    try:
        import sqlglot
        formatted = sqlglot.transpile(payload.sql_query, pretty=True)[0]
        return FormatQueryResponse(formatted_sql=formatted)
    except Exception as e:
        logger.warning(f"SQL Formatting parsing error: {str(e)}. Returning original SQL.")
        return FormatQueryResponse(formatted_sql=payload.sql_query)
