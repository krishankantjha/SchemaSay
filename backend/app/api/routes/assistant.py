from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.connection import DatabaseConnection, DatabaseSchemaCache
from app.api.routes.auth import get_current_user
from app.core.ai.query_generator import generate_sql_from_question
from app.core.ai.executor import execute_assistant_query
from app.core.visualization.chart_service import select_chart_type, ChartConfig
from app.utils.rate_limiter import query_limiter

router = APIRouter(prefix="/assistant", tags=["AI Copilot & SQL Workbench"])

# --- Pydantic Validation Schemas ---

class QueryRequest(BaseModel):
    """
    Request model for translating plain English questions to SQL.
    Includes input size limits to prevent injection amplification attacks.
    """
    connection_id: int = Field(..., gt=0)
    question: str = Field(..., min_length=1, max_length=2000)

class RawQueryRequest(BaseModel):
    """
    Request model for running manual raw SQL Workbench queries.
    Includes limits to check for bloated SQL string inputs.
    """
    connection_id: int = Field(..., gt=0)
    sql_query: str = Field(..., min_length=1, max_length=10000)

class QueryResponse(BaseModel):
    """
    Unified response serialization for both AI-generated and manual queries.
    """
    sql: str
    success: bool
    error: Optional[str]
    results: Optional[List[Dict]]
    execution_duration_ms: float
    truncated: bool = False
    chart_config: ChartConfig = Field(default_factory=ChartConfig)

# --- Helper Functions ---

def get_user_connection_or_404(connection_id: int, user_id: int, db: Session) -> DatabaseConnection:
    """
    Verifies database connection existence and ownership, preventing IDOR leaks.
    """
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == user_id
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
    return connection

# --- Endpoint Handlers ---

@router.post("/query", response_model=QueryResponse, status_code=status.HTTP_200_OK)
def query_database_with_assistant(
    payload: QueryRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Translates a user's natural language question into SQL using the active schema layout,
    executes it, and logs the execution transaction.
    """
    client_ip = request.client.host if request.client else "unknown"
    limiter_key = f"user:{current_user.id}:ip:{client_ip}"
    if query_limiter.check_rate_limit(limiter_key):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many query execution requests. Please wait before trying again.")

    # 1. Verify connection ownership
    connection = get_user_connection_or_404(payload.connection_id, current_user.id, db)
        
    # 2. Retrieve cached schema definitions to provide context for the query generator
    schema_cache = db.query(DatabaseSchemaCache).filter(
        DatabaseSchemaCache.connection_id == payload.connection_id
    ).all()
    
    schema_metadata = [
        {
            "table_name": entry.table_name,
            "column_name": entry.column_name,
            "data_type": entry.data_type
        }
        for entry in schema_cache
    ]

    # 3. Translate question to SQL
    generated_sql = generate_sql_from_question(
        question=payload.question,
        db_type=connection.db_type,
        schema_metadata=schema_metadata
    )

    # 4. Run the generated SQL safely against the target database
    assistant_result = execute_assistant_query(
        user_id=current_user.id,
        connection=connection,
        question=payload.question,
        raw_sql=generated_sql,
        db=db
    )
    success, error_or_sql, results, duration_ms = assistant_result

    if not success:
        # Map safety gate violations to 400 Bad Request
        if "Access Denied" in error_or_sql or "SQL Syntax Error" in error_or_sql:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_or_sql
            )
        # Map database cancellations/timeouts to 408 Request Timeout
        if "timeout" in error_or_sql.lower() or "cancelled" in error_or_sql.lower():
            raise HTTPException(
                status_code=status.HTTP_408_REQUEST_TIMEOUT,
                detail=error_or_sql
            )
        # Map user schema errors or SQL syntax invalid execution queries to 422 Unprocessable Content
        if "Database Error" in error_or_sql or "syntax error" in error_or_sql.lower():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=error_or_sql
            )
        # Map general database execution failures to 502 Bad Gateway
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_or_sql
        )

    rows = results or []
    columns = list(rows[0].keys()) if rows else []
    chart_config = select_chart_type(columns, rows, payload.question)

    return QueryResponse(
        sql=generated_sql,
        success=True,
        error=None,
        results=results,
        execution_duration_ms=duration_ms,
        truncated=assistant_result.truncated,
        chart_config=chart_config
    )

@router.post("/execute-raw", response_model=QueryResponse, status_code=status.HTTP_200_OK)
def execute_raw_sql_query(
    payload: RawQueryRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Directly validates and executes user-provided raw SQL queries in the SQL Workbench.
    """
    client_ip = request.client.host if request.client else "unknown"
    limiter_key = f"user:{current_user.id}:ip:{client_ip}"
    if query_limiter.check_rate_limit(limiter_key):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many query execution requests. Please wait before trying again.")

    # 1. Verify connection ownership
    connection = get_user_connection_or_404(payload.connection_id, current_user.id, db)

    # 2. Validate and execute user raw SQL
    assistant_result = execute_assistant_query(
        user_id=current_user.id,
        connection=connection,
        question="Manual SQL Editor Query",
        raw_sql=payload.sql_query,
        db=db
    )
    success, error_or_sql, results, duration_ms = assistant_result

    if not success:
        # Map safety gate violations to 400 Bad Request
        if "Access Denied" in error_or_sql or "SQL Syntax Error" in error_or_sql:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_or_sql
            )
        # Map database cancellations/timeouts to 408 Request Timeout
        if "timeout" in error_or_sql.lower() or "cancelled" in error_or_sql.lower():
            raise HTTPException(
                status_code=status.HTTP_408_REQUEST_TIMEOUT,
                detail=error_or_sql
            )
        # Map user schema errors or SQL syntax invalid execution queries to 422 Unprocessable Content
        if "Database Error" in error_or_sql or "syntax error" in error_or_sql.lower():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=error_or_sql
            )
        # Map general database execution failures to 502 Bad Gateway
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_or_sql
        )

    rows = results or []
    columns = list(rows[0].keys()) if rows else []
    chart_config = select_chart_type(columns, rows, payload.sql_query)

    return QueryResponse(
        sql=payload.sql_query,
        success=True,
        error=None,
        results=results,
        execution_duration_ms=duration_ms,
        truncated=assistant_result.truncated,
        chart_config=chart_config
    )
