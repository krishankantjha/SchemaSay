from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


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
    created_at: datetime

    class Config:
        from_attributes = True


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
