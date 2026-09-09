import time
import logging
from dataclasses import dataclass
from typing import Tuple, List, Dict, Optional
from sqlalchemy.orm import Session

from app.models.connection import DatabaseConnection
from app.core.connections.connector import get_connection
from app.core.execution.query_executor import execute_query
from app.core.execution.sql_wrapper import wrap_query_with_limit
from app.core.audit.audit_service import log_audit_transaction, AuditMetadata

@dataclass
class AssistantQueryResult:
    success: bool
    error_or_sql: Optional[str]
    results: Optional[List[Dict]]
    execution_time_ms: float

    def __iter__(self):
        return iter((self.success, self.error_or_sql, self.results, self.execution_time_ms))

logger = logging.getLogger("schemasay.executor")

def execute_assistant_query(
    user_id: int,
    connection: DatabaseConnection,
    question: str,
    raw_sql: str,
    db: Session,
    audit_metadata: Optional[AuditMetadata] = None,
) -> AssistantQueryResult:
    """
    Runs a pre-validated query wrapped inside a hard limit query wrapper,
    measures performance, and writes log metrics.
    """
    metadata = audit_metadata or AuditMetadata()

    wrapped_sql = wrap_query_with_limit(raw_sql, connection.db_type)

    start_time = time.perf_counter()
    try:
        engine = get_connection(connection)
        success, exec_error, cols, results_list, execution_duration_ms = execute_query(
            engine=engine,
            sql_query=wrapped_sql,
            db_type=connection.db_type
        )
        
        if not success:
            log_audit_transaction(
                user_id=user_id,
                connection_id=connection.id,
                question=question,
                sql_query=raw_sql,
                duration_ms=execution_duration_ms,
                status="failed",
                error_message=exec_error,
                db=db,
                metadata=metadata,
            )
            return AssistantQueryResult(
                success=False,
                error_or_sql=exec_error,
                results=None,
                execution_time_ms=execution_duration_ms
            )

        metadata.row_count = len(results_list or [])
        log_audit_transaction(
            user_id=user_id,
            connection_id=connection.id,
            question=question,
            sql_query=raw_sql,
            duration_ms=execution_duration_ms,
            status="success",
            error_message=None,
            db=db,
            metadata=metadata,
        )
        return AssistantQueryResult(
            success=True,
            error_or_sql=raw_sql,
            results=results_list,
            execution_time_ms=execution_duration_ms
        )
        
    except Exception as e:
        execution_duration_ms = (time.perf_counter() - start_time) * 1000.0
        error_msg = str(e)
        logger.error(f"SQL execution initialization failed: {error_msg}")
        
        log_audit_transaction(
            user_id=user_id,
            connection_id=connection.id,
            question=question,
            sql_query=raw_sql,
            duration_ms=execution_duration_ms,
            status="failed",
            error_message=error_msg,
            db=db,
            metadata=metadata,
        )
        return AssistantQueryResult(
            success=False,
            error_or_sql=error_msg,
            results=None,
            execution_time_ms=execution_duration_ms
        )
