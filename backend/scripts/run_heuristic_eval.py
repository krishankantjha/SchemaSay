#!/usr/bin/env python3
"""Run the heuristic NL→SQL evaluation benchmark and print a summary report."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.eval.runner import EvalRunner  # noqa: E402
from tests.fixtures.eval_schema_metadata import EVAL_SCHEMA_METADATA, EVAL_SEED_DDL  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Run SchemaSay heuristic eval benchmark")
    parser.add_argument("--category", choices=["core", "paraphrase", "adversarial", "dialect"], default=None)
    parser.add_argument("--regression-only", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    runner = EvalRunner(EVAL_SCHEMA_METADATA, EVAL_SEED_DDL)
    report = runner.run_all(category=args.category, regression_only=args.regression_only)

    for line in report.summary_lines():
        print(line)

    if args.verbose:
        print("\nFailures:")
        for result in report.results:
            if not result.passed:
                print(f"  {result.case_id} [{result.dialect}]: {', '.join(result.issues)}")
                if result.sql:
                    print(f"    SQL: {result.sql[:120]}")

    return 0 if report.metrics.failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
