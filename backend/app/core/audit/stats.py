"""Aggregate routing and performance stats from query audit logs."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.core.eval.telemetry import EvalTelemetry
from app.models.connection import QueryAuditLog


@dataclass
class AuditRoutingStats:
    total_queries: int = 0
    success_count: int = 0
    failed_count: int = 0
    avg_duration_ms: int = 0
    heuristic_count: int = 0
    llm_count: int = 0
    metric_count: int = 0
    learning_count: int = 0
    other_count: int = 0
    heuristic_percent: float = 0.0
    llm_percent: float = 0.0
    escalation_reasons: Dict[str, int] = field(default_factory=dict)


def _resolution_bucket(source: Optional[str], used_llm: bool) -> str:
    if source == "semantic_metric":
        return "metric"
    if source == "learning_example":
        return "learning"
    if source == "heuristic" or (source and source.startswith("heuristic")):
        return "heuristic"
    if used_llm or source == "llm":
        return "llm"
    if source == "raw_sql":
        return "other"
    return "other"


def compute_audit_routing_stats(logs: List[QueryAuditLog]) -> AuditRoutingStats:
    stats = AuditRoutingStats()
    stats.total_queries = len(logs)
    if not logs:
        return stats

    duration_total = 0
    duration_count = 0
    escalation: Dict[str, int] = {}

    for log in logs:
        if log.status == "success":
            stats.success_count += 1
        elif log.status == "failed":
            stats.failed_count += 1

        if log.execution_duration_ms is not None:
            duration_total += log.execution_duration_ms
            duration_count += 1

        telemetry = EvalTelemetry.from_json(log.eval_telemetry_json)
        used_llm = telemetry.used_llm if telemetry else False
        bucket = _resolution_bucket(log.resolution_source, used_llm)

        if bucket == "heuristic":
            stats.heuristic_count += 1
        elif bucket == "llm":
            stats.llm_count += 1
        elif bucket == "metric":
            stats.metric_count += 1
        elif bucket == "learning":
            stats.learning_count += 1
        else:
            stats.other_count += 1

        reason = None
        if telemetry and telemetry.escalation_reason:
            reason = telemetry.escalation_reason
        elif bucket == "llm" and log.resolution_source == "llm":
            reason = telemetry.routing_decision if telemetry and telemetry.routing_decision else "llm"

        if reason:
            escalation[reason] = escalation.get(reason, 0) + 1

    if duration_count:
        stats.avg_duration_ms = int(round(duration_total / duration_count))

    routed_total = stats.heuristic_count + stats.llm_count + stats.metric_count + stats.learning_count
    if routed_total:
        stats.heuristic_percent = round(100.0 * stats.heuristic_count / routed_total, 1)
        stats.llm_percent = round(100.0 * stats.llm_count / routed_total, 1)

    stats.escalation_reasons = dict(sorted(escalation.items(), key=lambda item: item[1], reverse=True))
    return stats
