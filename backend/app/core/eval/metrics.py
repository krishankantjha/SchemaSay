"""Aggregate evaluation metrics and reporting."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class EvalCaseResult:
    case_id: str
    category: str
    dialect: str
    passed: bool
    question: str
    paraphrase_group: Optional[str] = None
    sql: Optional[str] = None
    tier: Optional[str] = None
    compile_confidence: Optional[float] = None
    calibrated_confidence: Optional[float] = None
    routed_to_llm: bool = False
    escalated: bool = False
    execution_match: Optional[bool] = None
    false_confidence: bool = False
    issues: List[str] = field(default_factory=list)


@dataclass
class EvalMetrics:
    total: int = 0
    passed: int = 0
    failed: int = 0
    execution_accuracy: float = 0.0
    compile_accuracy: float = 0.0
    escalation_rate: float = 0.0
    llm_escalation_rate: float = 0.0
    false_confidence_rate: float = 0.0
    false_confidence_count: int = 0
    by_category: Dict[str, Dict[str, int]] = field(default_factory=dict)
    by_dialect: Dict[str, Dict[str, int]] = field(default_factory=dict)
    paraphrase_consistency: Dict[str, float] = field(default_factory=dict)

    @classmethod
    def from_results(cls, results: List[EvalCaseResult]) -> "EvalMetrics":
        metrics = cls()
        metrics.total = len(results)
        metrics.passed = sum(1 for r in results if r.passed)
        metrics.failed = metrics.total - metrics.passed

        exec_cases = [r for r in results if r.execution_match is not None]
        if exec_cases:
            metrics.execution_accuracy = sum(1 for r in exec_cases if r.execution_match) / len(exec_cases)

        compile_cases = [r for r in results if r.sql]
        if compile_cases:
            compile_pass = sum(1 for r in compile_cases if r.passed and not r.issues)
            metrics.compile_accuracy = compile_pass / len(compile_cases)

        escalated = [r for r in results if r.escalated]
        metrics.escalation_rate = len(escalated) / metrics.total if metrics.total else 0.0
        llm_routed = [r for r in results if r.routed_to_llm]
        metrics.llm_escalation_rate = len(llm_routed) / metrics.total if metrics.total else 0.0

        false_conf = [r for r in results if r.false_confidence]
        metrics.false_confidence_count = len(false_conf)
        metrics.false_confidence_rate = len(false_conf) / metrics.total if metrics.total else 0.0

        for result in results:
            cat = metrics.by_category.setdefault(result.category, {"passed": 0, "failed": 0})
            dia = metrics.by_dialect.setdefault(result.dialect, {"passed": 0, "failed": 0})
            bucket = cat if result.passed else cat
            if result.passed:
                cat["passed"] += 1
                dia["passed"] += 1
            else:
                cat["failed"] += 1
                dia["failed"] += 1

        groups: Dict[str, List[EvalCaseResult]] = {}
        for result in results:
            if result.category == "paraphrase":
                group_key = result.paraphrase_group or result.case_id.rsplit("_", 1)[0]
                groups.setdefault(group_key, []).append(result)
        for group, items in groups.items():
            if items:
                metrics.paraphrase_consistency[group] = sum(1 for i in items if i.passed) / len(items)

        return metrics


@dataclass
class EvalReport:
    metrics: EvalMetrics
    results: List[EvalCaseResult]
    improvement_hints: List[str] = field(default_factory=list)

    def summary_lines(self) -> List[str]:
        m = self.metrics
        lines = [
            f"Eval: {m.passed}/{m.total} passed ({100 * m.passed / m.total:.1f}%)" if m.total else "Eval: no cases",
            f"Execution accuracy: {100 * m.execution_accuracy:.1f}%",
            f"Escalation rate: {100 * m.escalation_rate:.1f}%",
            f"LLM escalation rate: {100 * m.llm_escalation_rate:.1f}%",
            f"False confidence: {m.false_confidence_count} ({100 * m.false_confidence_rate:.1f}%)",
        ]
        if m.paraphrase_consistency:
            for group, rate in sorted(m.paraphrase_consistency.items()):
                lines.append(f"Paraphrase {group}: {100 * rate:.1f}% consistent")
        if self.improvement_hints:
            lines.append("Improvement hints:")
            lines.extend(f"  - {hint}" for hint in self.improvement_hints[:5])
        return lines
