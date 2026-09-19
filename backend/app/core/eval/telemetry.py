"""Detailed audit telemetry for evaluation and production tracking."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class EvalTelemetry:
    routing_decision: Optional[str] = None
    validation_passed: Optional[bool] = None
    calibrated_confidence: Optional[int] = None
    heuristic_intent: Optional[str] = None
    used_llm: bool = False
    escalation_reason: Optional[str] = None
    false_confidence: bool = False
    execution_match: Optional[bool] = None
    validation_issues: List[str] = field(default_factory=list)
    component_confidence: Optional[Dict[str, float]] = None

    def to_json(self) -> str:
        return json.dumps({k: v for k, v in asdict(self).items() if v is not None})

    @classmethod
    def from_json(cls, raw: Optional[str]) -> Optional["EvalTelemetry"]:
        if not raw:
            return None
        try:
            data = json.loads(raw)
            return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
        except (json.JSONDecodeError, TypeError):
            return None


def detect_false_confidence(
    *,
    calibrated_confidence: Optional[float],
    validation_passed: Optional[bool],
    execution_match: Optional[bool],
    grounded: Optional[bool],
    threshold: float = 0.75,
) -> bool:
    """High confidence but validation or execution failed."""
    if calibrated_confidence is None:
        return False
    if calibrated_confidence < threshold:
        return False
    if validation_passed is False:
        return True
    if execution_match is False:
        return True
    if grounded is False:
        return True
    return False
