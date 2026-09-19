"""Evaluation runner: compile, validate, execute, and score heuristic cases."""

from __future__ import annotations

import logging
from typing import List, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.core.ai.heuristic_aliases import AliasContext
from app.core.ai.heuristic_compiler import compile_heuristic
from app.core.ai.heuristic_routing import RouteAction, decide_heuristic_route
from app.core.ai.heuristic_validation import validate_heuristic_sql
from app.core.eval.cases import EvalCase, load_eval_cases
from app.core.eval.compare import sql_contains_all
from app.core.eval.improvement import analyze_failures
from app.core.eval.metrics import EvalCaseResult, EvalMetrics, EvalReport
from app.core.eval.result_validation import execute_reference_and_candidate
from app.core.eval.telemetry import detect_false_confidence
from app.core.schema.graph import SchemaGraph

logger = logging.getLogger("schemasay.eval")


class EvalRunner:
    def __init__(
        self,
        schema_metadata: List[dict],
        seed_ddl: str,
        *,
        alias_context: Optional[AliasContext] = None,
    ):
        self.schema_metadata = schema_metadata
        self.seed_ddl = seed_ddl
        self.alias_context = alias_context or AliasContext.global_defaults()
        self.graph = SchemaGraph.from_schema_metadata(schema_metadata)
        self._engine: Optional[Engine] = None

    @property
    def engine(self) -> Engine:
        if self._engine is None:
            self._engine = create_engine("sqlite:///:memory:")
            with self._engine.begin() as conn:
                for statement in self.seed_ddl.split(";"):
                    stmt = statement.strip()
                    if stmt:
                        conn.execute(text(stmt))
        return self._engine

    def run_case(self, case: EvalCase, dialect: Optional[str] = None) -> EvalCaseResult:
        db_type = dialect or case.dialects[0]
        issues: List[str] = []

        compiled = compile_heuristic(
            case.question,
            db_type,
            self.schema_metadata,
            alias_context=self.alias_context,
        )
        route = decide_heuristic_route(compiled)
        routed_to_llm = route.action == RouteAction.LLM

        if case.expect_escalate is not None:
            if case.expect_escalate and not compiled.should_escalate and not routed_to_llm:
                issues.append("expect_escalate:should_have_escalated")
            if not case.expect_escalate and (compiled.should_escalate or routed_to_llm):
                issues.append("unexpected_escalate")

        if case.expect_tier and compiled.tier != case.expect_tier:
            issues.append(f"expect_tier:got_{compiled.tier}")

        sql = compiled.sql
        if not sql and not case.allow_no_sql:
            issues.append("no_sql_generated")
            return EvalCaseResult(
                case_id=case.id,
                category=case.category,
                dialect=db_type,
                passed=False,
                question=case.question,
                paraphrase_group=case.paraphrase_group,
                tier=compiled.tier,
                compile_confidence=compiled.confidence,
                routed_to_llm=routed_to_llm,
                escalated=compiled.should_escalate or routed_to_llm,
                issues=issues,
            )

        validation = None
        calibrated = None
        if sql:
            require_semantic = route.action == RouteAction.HEURISTIC_VALIDATE
            validation = validate_heuristic_sql(
                sql=sql,
                db_type=db_type,
                graph=self.graph,
                heuristic=compiled,
                require_semantic=require_semantic,
            )
            calibrated = validation.calibrated_confidence

            if case.must_be_safe and not validation.safety_valid:
                issues.append("unsafe_sql")

            if case.expect_sql_contains:
                ok, missing = sql_contains_all(sql, case.expect_sql_contains)
                if not ok:
                    issues.append(f"sql_fragment:{','.join(missing)}")

        execution_match = None
        can_execute_compare = db_type.lower() in {"sqlite", "file_upload"}
        if sql and case.reference_sql and can_execute_compare:
            match, reason, _, _ = execute_reference_and_candidate(
                self.engine, db_type, case.reference_sql, sql
            )
            execution_match = match
            if not match:
                issues.append(f"execution_mismatch:{reason}")

        false_confidence = detect_false_confidence(
            calibrated_confidence=calibrated,
            validation_passed=validation.can_execute if validation else None,
            execution_match=execution_match,
            grounded=validation.grounding_valid if validation else None,
        )
        if false_confidence:
            issues.append("false_confidence")

        passed = len(issues) == 0
        return EvalCaseResult(
            case_id=case.id,
            category=case.category,
            dialect=db_type,
            passed=passed,
            question=case.question,
            paraphrase_group=case.paraphrase_group,
            sql=sql,
            tier=compiled.tier,
            compile_confidence=compiled.confidence,
            calibrated_confidence=calibrated,
            routed_to_llm=routed_to_llm,
            escalated=compiled.should_escalate or routed_to_llm,
            execution_match=execution_match,
            false_confidence=false_confidence,
            issues=issues,
        )

    def run_all(
        self,
        cases: Optional[List[EvalCase]] = None,
        *,
        category: Optional[str] = None,
        regression_only: bool = False,
    ) -> EvalReport:
        if cases is None:
            cases = load_eval_cases()
        if category:
            cases = [c for c in cases if c.category == category]
        if regression_only:
            cases = [c for c in cases if c.regression]

        results: List[EvalCaseResult] = []
        for case in cases:
            for dialect in case.dialects:
                if category and case.category != category:
                    continue
                results.append(self.run_case(case, dialect))

        metrics = EvalMetrics.from_results(results)
        hints = analyze_failures(results)
        return EvalReport(metrics=metrics, results=results, improvement_hints=hints)
