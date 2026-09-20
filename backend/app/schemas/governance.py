from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class AuditTelemetryResponse(BaseModel):
    """Parsed eval telemetry attached to an audit log entry."""
    routing_decision: Optional[str] = None
    validation_passed: Optional[bool] = None
    calibrated_confidence: Optional[int] = None
    heuristic_intent: Optional[str] = None
    used_llm: bool = False
    escalation_reason: Optional[str] = None
    false_confidence: bool = False
    execution_match: Optional[bool] = None
    validation_issues: List[str] = Field(default_factory=list)
    component_confidence: Optional[Dict[str, float]] = None


class AuditLogDetailResponse(BaseModel):
    id: int
    user_id: int
    connection_id: Optional[int] = None
    question: str
    sql_query: str
    execution_duration_ms: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    correlation_id: Optional[str] = None
    confidence_score: Optional[int] = None
    grounded: Optional[bool] = None
    tables_accessed: List[str] = Field(default_factory=list)
    row_count: Optional[int] = None
    resolution_source: Optional[str] = None
    metric_id: Optional[int] = None
    heuristic_tier: Optional[str] = None
    heuristic_compile_confidence: Optional[int] = None
    eval_telemetry: Optional[AuditTelemetryResponse] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditStatsResponse(BaseModel):
    """Routing and performance summary for recent audit logs."""
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
    escalation_reasons: Dict[str, int] = Field(default_factory=dict)
    sample_size: int = 0


class AuditReplayResponse(BaseModel):
    audit_id: int
    sql: str
    success: bool
    results: Optional[list] = None
    execution_duration_ms: float = 0.0
    error: Optional[str] = None


class ConnectionPolicyResponse(BaseModel):
    connection_id: int
    blocked_tables: List[str] = Field(default_factory=list)
    blocked_columns: List[str] = Field(default_factory=list)
    require_high_confidence: bool = False
    min_confidence_threshold: int = 50
    block_pii_access: bool = False
    updated_at: Optional[datetime] = None


class ConnectionPolicyUpdate(BaseModel):
    blocked_tables: List[str] = Field(default_factory=list)
    blocked_columns: List[str] = Field(default_factory=list)
    require_high_confidence: bool = False
    min_confidence_threshold: int = Field(default=50, ge=0, le=100)
    block_pii_access: bool = False
