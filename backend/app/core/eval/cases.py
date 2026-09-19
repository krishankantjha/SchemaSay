"""Load and validate evaluation case definitions."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class EvalCase:
    id: str
    category: str
    question: str
    dialects: List[str] = field(default_factory=lambda: ["sqlite"])
    reference_sql: Optional[str] = None
    expect_sql_contains: List[str] = field(default_factory=list)
    expect_escalate: Optional[bool] = None
    expect_tier: Optional[str] = None
    allow_no_sql: bool = False
    must_be_safe: bool = True
    paraphrase_group: Optional[str] = None
    regression: bool = False
    tags: List[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, raw: Dict[str, Any]) -> "EvalCase":
        return cls(
            id=raw["id"],
            category=raw.get("category", "core"),
            question=raw["question"],
            dialects=raw.get("dialects", ["sqlite"]),
            reference_sql=raw.get("reference_sql"),
            expect_sql_contains=raw.get("expect_sql_contains", []),
            expect_escalate=raw.get("expect_escalate"),
            expect_tier=raw.get("expect_tier"),
            allow_no_sql=raw.get("allow_no_sql", False),
            must_be_safe=raw.get("must_be_safe", True),
            paraphrase_group=raw.get("paraphrase_group"),
            regression=raw.get("regression", False),
            tags=raw.get("tags", []),
        )


def load_eval_cases(path: Optional[Path] = None) -> List[EvalCase]:
    if path is None:
        path = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "eval_cases.json"
    with open(path, encoding="utf-8") as handle:
        raw_cases = json.load(handle)
    return [EvalCase.from_dict(item) for item in raw_cases]


def filter_cases(
    cases: List[EvalCase],
    *,
    category: Optional[str] = None,
    regression_only: bool = False,
    dialect: Optional[str] = None,
) -> List[EvalCase]:
    filtered = cases
    if category:
        filtered = [c for c in filtered if c.category == category]
    if regression_only:
        filtered = [c for c in filtered if c.regression]
    if dialect:
        filtered = [c for c in filtered if dialect in c.dialects]
    return filtered
