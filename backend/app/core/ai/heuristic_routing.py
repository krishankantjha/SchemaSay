"""
Phase 4: Routing decisions for heuristic vs LLM SQL generation.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from app.core.ai.heuristic_compiler import HeuristicCompileResult
from app.core.ai.heuristic_validation import SqlValidationResult


class RouteAction(str, Enum):
    HEURISTIC_EXECUTE = "heuristic_execute"
    HEURISTIC_VALIDATE = "heuristic_validate"
    LLM = "llm"
    FALLBACK = "fallback"


@dataclass
class RouteDecision:
    action: RouteAction
    reason: str


def decide_heuristic_route(heuristic: HeuristicCompileResult) -> RouteDecision:
    """
    Decide whether to execute heuristic SQL directly, validate first, or escalate to LLM.

    L1/L2 → Execute (after safety + grounding)
    L3    → Validate → Execute
    Ambiguous / L4 / ungrounded compile → LLM
    """
    if heuristic.tier == "L4":
        return RouteDecision(RouteAction.LLM, "business_reasoning")

    if heuristic.should_escalate:
        return RouteDecision(RouteAction.LLM, "compile_escalate")

    if not heuristic.sql:
        return RouteDecision(RouteAction.LLM, "no_sql")

    if heuristic.tier == "escalate":
        return RouteDecision(RouteAction.LLM, "compile_tier_escalate")

    if any(r.startswith("join_paths_tied") for r in heuristic.reasons):
        return RouteDecision(RouteAction.LLM, "join_ambiguity")

    if any("tables_tied" in r or "columns_tied" in r for r in heuristic.reasons):
        return RouteDecision(RouteAction.LLM, "resolution_ambiguity")

    if heuristic.tier in ("L1", "L2"):
        return RouteDecision(RouteAction.HEURISTIC_EXECUTE, f"tier_{heuristic.tier.lower()}")

    if heuristic.tier == "L3":
        return RouteDecision(RouteAction.HEURISTIC_VALIDATE, "tier_l3")

    return RouteDecision(RouteAction.HEURISTIC_EXECUTE, "default")


def should_use_heuristic_result(
    route: RouteDecision,
    validation: Optional[SqlValidationResult],
) -> bool:
    """True when validation passes for the chosen route."""
    if route.action == RouteAction.LLM:
        return False
    if validation is None:
        return False
    return validation.can_execute
