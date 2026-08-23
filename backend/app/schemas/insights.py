import json
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator

from app.config import settings


class InsightRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    sql_query: str = Field(..., min_length=1, max_length=10000)
    columns: List[str] = Field(default_factory=list, max_length=settings.MAX_QUERY_COLUMNS)
    rows: List[Dict[str, Any]] = Field(default_factory=list, max_length=5000)

    @model_validator(mode="after")
    def validate_payload(self):
        if any(len(column) > 256 for column in self.columns):
            raise ValueError("Column names must be at most 256 characters")
        payload_bytes = len(json.dumps(self.rows, default=str, ensure_ascii=False).encode("utf-8"))
        if payload_bytes > settings.MAX_UPLOAD_BYTES:
            raise ValueError("Dataset payload exceeds the maximum byte limit")
        return self


class LLMUsageStats(BaseModel):
    prompt_tokens: int = Field(default=0, ge=0)
    completion_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)
    estimated_cost_usd: float = Field(default=0.0, ge=0)
    execution_time_ms: float = Field(default=0.0, ge=0)


class InsightResponse(BaseModel):
    insight: str
    success: bool
    error: Optional[str] = None
    correlation_id: Optional[str] = None
    usage_stats: Optional[LLMUsageStats] = None
