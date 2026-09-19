"""Failure-driven rule improvement hints from evaluation results."""

from __future__ import annotations

from collections import Counter
from typing import List

from app.core.eval.metrics import EvalCaseResult


def analyze_failures(results: List[EvalCaseResult]) -> List[str]:
    """Produce actionable hints from failed evaluation cases."""
    failed = [r for r in results if not r.passed]
    if not failed:
        return ["All cases passed — no rule gaps detected in this run."]

    hints: List[str] = []
    issue_counts: Counter[str] = Counter()
    for result in failed:
        for issue in result.issues:
            bucket = issue.split(":")[0]
            issue_counts[bucket] += 1

    for issue, count in issue_counts.most_common(5):
        if issue == "execution_mismatch":
            hints.append(f"{count} case(s) compiled SQL with wrong results — tighten semantic validation or column resolution.")
        elif issue == "expect_escalate":
            hints.append(f"{count} case(s) should escalate but did not — review confidence thresholds or ambiguity detection.")
        elif issue == "unexpected_escalate":
            hints.append(f"{count} case(s) escalated unexpectedly — add alias/rule coverage or lower ambiguity sensitivity.")
        elif issue == "expect_tier":
            hints.append(f"{count} case(s) wrong tier — review intent classification or tier computation.")
        elif issue == "sql_fragment":
            hints.append(f"{count} case(s) missing expected SQL fragments — extend compiler patterns.")
        elif issue == "unsafe_sql":
            hints.append(f"{count} case(s) produced unsafe SQL — review sanitizer and compiler output.")
        elif issue == "false_confidence":
            hints.append(f"{count} false-confidence case(s) — recalibrate confidence weights or add validation gates.")
        else:
            hints.append(f"{count} failure(s) tagged '{issue}' — inspect case details.")

    category_counts = Counter(r.category for r in failed)
    worst = category_counts.most_common(1)
    if worst:
        hints.append(f"Largest failure category: {worst[0][0]} ({worst[0][1]} cases).")

    return hints
