from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import List, Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.core.ai.executor import execute_assistant_query
from app.core.ai.query_generator import generate_sql
from app.core.audit.audit_service import log_audit_transaction, AuditMetadata
from app.core.explanation.builder import build_query_explanation
from app.core.explanation.confidence import compute_confidence_score
from app.core.governance.policies import evaluate_sql_policy
from app.core.grounding.validator import validate_sql_grounding
from app.core.schema.graph import SchemaGraph
from app.core.schema.loader import load_schema_graph, load_schema_metadata
from app.core.security.sql_validator import validate_sql_structure
from app.core.learning.retrieval import find_similar_examples, pick_high_confidence_example
from app.core.semantics.resolver import resolve_metric_question
from app.core.visualization.chart_service import select_chart_type, ChartConfig
from app.models.connection import DatabaseConnection
from app.models.governance import ConnectionPolicy
from app.models.metric import MetricDefinition


class PipelineError(Exception):
    """Raised when a pipeline stage fails before execution."""

    def __init__(self, message: str, status_code: int = 400, stage: str = "pipeline"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.stage = stage


@dataclass
class PipelineResult:
    sql: str
    success: bool
    error: Optional[str]
    results: Optional[List[dict]]
    execution_duration_ms: float
    chart_config: ChartConfig
    explanation: dict
    correlation_id: str
    used_llm: bool
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None


class QueryPipeline:
    """
    Orchestrates NL-to-SQL and raw SQL flows through grounding, explanation,
    validation, and execution stages.
    """

    def __init__(self, db: Session):
        self.db = db

    def _load_connection_policy(self, connection_id: int, user_id: int) -> Optional[ConnectionPolicy]:
        return (
            self.db.query(ConnectionPolicy)
            .filter(
                ConnectionPolicy.connection_id == connection_id,
                ConnectionPolicy.user_id == user_id,
            )
            .first()
        )

    def _audit_metadata(
        self,
        correlation_id: str,
        confidence: Optional[int],
        grounded: Optional[bool],
        tables_accessed: Optional[List[str]],
        resolution_source: Optional[str],
        metric_id: Optional[int],
    ) -> AuditMetadata:
        return AuditMetadata(
            correlation_id=correlation_id,
            confidence_score=confidence,
            grounded=grounded,
            tables_accessed=tables_accessed,
            resolution_source=resolution_source,
            metric_id=metric_id,
        )

    def run_natural_language(
        self,
        user_id: int,
        connection: DatabaseConnection,
        question: str,
    ) -> PipelineResult:
        correlation_id = str(uuid.uuid4())
        graph = load_schema_graph(self.db, connection.id)

        metrics = (
            self.db.query(MetricDefinition)
            .filter(
                MetricDefinition.connection_id == connection.id,
                MetricDefinition.user_id == user_id,
            )
            .all()
        )
        resolved = resolve_metric_question(
            question=question,
            metrics=metrics,
            graph=graph,
            db_type=connection.db_type,
            match_threshold=settings.SEMANTIC_METRIC_MATCH_THRESHOLD,
        )

        resolution_source = "llm"
        metric_id = None
        metric_name = None
        metric_label = None
        extra_assumptions = None
        used_llm = False
        llm_provider = None
        llm_model = None
        learning_examples_used = 0

        if resolved:
            generated_sql = resolved.sql
            resolution_source = "semantic_metric"
            metric_id = resolved.metric_id
            metric_name = resolved.metric_name
            metric_label = resolved.metric_label
            extra_assumptions = resolved.assumptions
        else:
            schema_metadata = load_schema_metadata(self.db, connection.id)
            examples = find_similar_examples(
                question=question,
                connection_id=connection.id,
                user_id=user_id,
                db=self.db,
            )
            learning_examples_used = len(examples)
            verified_payload = [
                {
                    "question": example.question,
                    "sql": example.sql,
                    "similarity": example.similarity,
                    "source": example.source,
                }
                for example in examples
            ]

            direct_example = pick_high_confidence_example(question, examples)
            if direct_example:
                generated_sql = direct_example.sql
                resolution_source = "learning_example"
            else:
                generation = generate_sql(
                    question=question,
                    db_type=connection.db_type,
                    schema_metadata=schema_metadata,
                    verified_examples=verified_payload,
                )
                generated_sql = generation.sql
                used_llm = generation.used_llm
                if generation.provider == "learning_example":
                    resolution_source = "learning_example"
                elif used_llm:
                    resolution_source = "llm"
                    llm_provider = generation.provider
                    llm_model = generation.model
                else:
                    resolution_source = "heuristic"

        return self._run_execution_path(
            user_id=user_id,
            connection=connection,
            question=question,
            sql=generated_sql,
            graph=graph,
            correlation_id=correlation_id,
            used_llm=used_llm,
            resolution_source=resolution_source,
            metric_id=metric_id,
            metric_name=metric_name,
            metric_label=metric_label,
            extra_assumptions=extra_assumptions,
            learning_examples_used=learning_examples_used,
            llm_provider=llm_provider,
            llm_model=llm_model,
        )

    def run_raw_sql(
        self,
        user_id: int,
        connection: DatabaseConnection,
        sql: str,
        question: str = "Manual SQL Editor Query",
    ) -> PipelineResult:
        correlation_id = str(uuid.uuid4())
        graph = load_schema_graph(self.db, connection.id)

        return self._run_execution_path(
            user_id=user_id,
            connection=connection,
            question=question,
            sql=sql,
            graph=graph,
            correlation_id=correlation_id,
            used_llm=False,
            resolution_source="raw_sql",
        )

    def _run_execution_path(
        self,
        user_id: int,
        connection: DatabaseConnection,
        question: str,
        sql: str,
        graph: SchemaGraph,
        correlation_id: str,
        used_llm: bool,
        resolution_source: str = "llm",
        metric_id: Optional[int] = None,
        metric_name: Optional[str] = None,
        metric_label: Optional[str] = None,
        extra_assumptions: Optional[List[str]] = None,
        learning_examples_used: int = 0,
        llm_provider: Optional[str] = None,
        llm_model: Optional[str] = None,
    ) -> PipelineResult:
        policy = self._load_connection_policy(connection.id, user_id)

        is_safe, safety_error = validate_sql_structure(sql)
        if not is_safe:
            log_audit_transaction(
                user_id=user_id,
                connection_id=connection.id,
                question=question,
                sql_query=sql,
                duration_ms=0.0,
                status="failed",
                error_message=safety_error,
                db=self.db,
                metadata=self._audit_metadata(
                    correlation_id=correlation_id,
                    confidence=None,
                    grounded=None,
                    tables_accessed=None,
                    resolution_source=resolution_source,
                    metric_id=metric_id,
                ),
            )
            raise PipelineError(
                message=safety_error,
                status_code=400,
                stage="security",
            )

        grounding = validate_sql_grounding(sql, graph)
        confidence = compute_confidence_score(
            question=question,
            sql=sql,
            graph=graph,
            grounding=grounding,
            used_llm=used_llm,
            semantic_metric=resolution_source == "semantic_metric",
        )

        policy_result = evaluate_sql_policy(sql, graph, policy, confidence=confidence)
        if not policy_result.allowed:
            log_audit_transaction(
                user_id=user_id,
                connection_id=connection.id,
                question=question,
                sql_query=sql,
                duration_ms=0.0,
                status="failed",
                error_message=policy_result.message,
                db=self.db,
                metadata=self._audit_metadata(
                    correlation_id=correlation_id,
                    confidence=confidence,
                    grounded=grounding.valid,
                    tables_accessed=grounding.tables_referenced,
                    resolution_source=resolution_source,
                    metric_id=metric_id,
                ),
            )
            raise PipelineError(
                message=policy_result.message or "Query blocked by connection policy.",
                status_code=403,
                stage="policy",
            )

        explanation = build_query_explanation(
            question=question,
            sql=sql,
            graph=graph,
            grounding=grounding,
            confidence=confidence,
            used_llm=used_llm,
            resolution_source=resolution_source,
            metric_id=metric_id,
            metric_name=metric_name,
            metric_label=metric_label,
            extra_assumptions=extra_assumptions,
            learning_examples_used=learning_examples_used,
            llm_provider=llm_provider,
            llm_model=llm_model,
        )
        explanation["warnings"].extend(policy_result.warnings)

        if settings.BLOCK_ON_GROUNDING_FAILURE and not grounding.valid:
            error_message = "; ".join(grounding.warnings) or "SQL is not grounded in the cached schema."
            log_audit_transaction(
                user_id=user_id,
                connection_id=connection.id,
                question=question,
                sql_query=sql,
                duration_ms=0.0,
                status="failed",
                error_message=error_message,
                db=self.db,
                metadata=self._audit_metadata(
                    correlation_id=correlation_id,
                    confidence=confidence,
                    grounded=grounding.valid,
                    tables_accessed=grounding.tables_referenced,
                    resolution_source=resolution_source,
                    metric_id=metric_id,
                ),
            )
            raise PipelineError(
                message=error_message,
                status_code=422,
                stage="grounding",
            )

        if settings.MIN_CONFIDENCE_TO_EXECUTE > 0 and confidence < settings.MIN_CONFIDENCE_TO_EXECUTE:
            error_message = (
                f"Query confidence {confidence} is below minimum threshold "
                f"{settings.MIN_CONFIDENCE_TO_EXECUTE}."
            )
            log_audit_transaction(
                user_id=user_id,
                connection_id=connection.id,
                question=question,
                sql_query=sql,
                duration_ms=0.0,
                status="failed",
                error_message=error_message,
                db=self.db,
                metadata=self._audit_metadata(
                    correlation_id=correlation_id,
                    confidence=confidence,
                    grounded=grounding.valid,
                    tables_accessed=grounding.tables_referenced,
                    resolution_source=resolution_source,
                    metric_id=metric_id,
                ),
            )
            raise PipelineError(
                message=error_message,
                status_code=422,
                stage="confidence",
            )

        audit_metadata = self._audit_metadata(
            correlation_id=correlation_id,
            confidence=confidence,
            grounded=grounding.valid,
            tables_accessed=grounding.tables_referenced,
            resolution_source=resolution_source,
            metric_id=metric_id,
        )

        success, error_or_sql, results, duration_ms = execute_assistant_query(
            user_id=user_id,
            connection=connection,
            question=question,
            raw_sql=sql,
            db=self.db,
            audit_metadata=audit_metadata,
        )

        chart_config = ChartConfig()
        if success and results:
            columns = list(results[0].keys()) if results else []
            chart_config = select_chart_type(columns, results, question)

        if not success:
            raise PipelineError(
                message=error_or_sql or "Query execution failed.",
                status_code=self._map_execution_error_status(error_or_sql),
                stage="execution",
            )

        return PipelineResult(
            sql=sql,
            success=True,
            error=None,
            results=results,
            execution_duration_ms=duration_ms,
            chart_config=chart_config,
            explanation=explanation,
            correlation_id=correlation_id,
            used_llm=used_llm,
            llm_provider=llm_provider,
            llm_model=llm_model,
        )

    @staticmethod
    def _map_execution_error_status(error_message: Optional[str]) -> int:
        if not error_message:
            return 502
        if "Access Denied" in error_message or "SQL Syntax Error" in error_message:
            return 400
        if "timeout" in error_message.lower() or "cancelled" in error_message.lower():
            return 408
        if "Database Error" in error_message or "syntax error" in error_message.lower():
            return 422
        return 502
