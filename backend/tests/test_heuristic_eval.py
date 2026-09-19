"""Phase 5: heuristic compiler evaluation benchmark and regression tests."""

import pytest

from app.core.eval.cases import load_eval_cases
from app.core.eval.compare import compare_results, rows_to_multiset
from app.core.eval.metrics import EvalMetrics
from app.core.eval.runner import EvalRunner
from app.core.eval.telemetry import detect_false_confidence
from tests.fixtures.eval_schema_metadata import EVAL_SCHEMA_METADATA, EVAL_SEED_DDL


@pytest.fixture
def eval_runner():
    return EvalRunner(EVAL_SCHEMA_METADATA, EVAL_SEED_DDL)


def test_compare_results_order_independent():
    a = [{"x": 1, "y": 2}, {"x": 3, "y": 4}]
    b = [{"y": 4, "x": 3}, {"x": 1, "y": 2}]
    ok, _ = compare_results(a, b)
    assert ok is True
    assert rows_to_multiset(a) == rows_to_multiset(b)


def test_detect_false_confidence():
    assert detect_false_confidence(
        calibrated_confidence=0.9,
        validation_passed=False,
        execution_match=None,
        grounded=True,
    )
    assert not detect_false_confidence(
        calibrated_confidence=0.5,
        validation_passed=False,
        execution_match=None,
        grounded=True,
    )


def test_load_eval_cases():
    cases = load_eval_cases()
    assert len(cases) >= 15
    categories = {c.category for c in cases}
    assert "core" in categories
    assert "paraphrase" in categories
    assert "adversarial" in categories


def test_eval_runner_core_cases(eval_runner):
    report = eval_runner.run_all(category="core")
    assert report.metrics.total >= 8
    assert report.metrics.execution_accuracy >= 0.7
    assert report.metrics.passed / report.metrics.total >= 0.75


def test_eval_regression_cases(eval_runner):
    report = eval_runner.run_all(regression_only=True)
    failures = [r for r in report.results if not r.passed]
    assert not failures, f"Regression failures: {[f.case_id + ':' + ','.join(f.issues) for f in failures]}"


def test_eval_adversarial_escalates(eval_runner):
    report = eval_runner.run_all(category="adversarial")
    for result in report.results:
        if result.case_id in ("adversarial_l4_trends", "adversarial_ambiguous", "adversarial_empty_schema_question"):
            assert result.escalated or result.routed_to_llm, result.case_id


def test_eval_paraphrase_consistency(eval_runner):
    report = eval_runner.run_all(category="paraphrase")
    assert report.metrics.total >= 4
    assert report.metrics.passed / report.metrics.total >= 0.75


def test_eval_dialect_specific(eval_runner):
    report = eval_runner.run_all(category="dialect")
    sqlite = next(r for r in report.results if r.dialect == "sqlite")
    mssql = next(r for r in report.results if r.dialect == "mssql")
    assert "LIMIT" in (sqlite.sql or "")
    assert "TOP" in (mssql.sql or "")


def test_eval_metrics_summary(eval_runner):
    report = eval_runner.run_all()
    lines = report.summary_lines()
    assert any("Eval:" in line for line in lines)
    assert report.improvement_hints is not None


def test_eval_false_confidence_tracking(eval_runner):
    report = eval_runner.run_all()
    assert report.metrics.false_confidence_count >= 0
    assert 0.0 <= report.metrics.false_confidence_rate <= 1.0


def test_eval_full_benchmark_passes(eval_runner):
    report = eval_runner.run_all()
    assert report.metrics.failed == 0
    assert report.metrics.execution_accuracy >= 0.9
