from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional

class InsightRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    sql_query: str = Field(..., min_length=1, max_length=10000)
    columns: List[str] = Field(default_factory=list)
    rows: List[Dict[str, Any]] = Field(default_factory=list)

    @validator("rows")
    def limit_rows_size(cls, v):
        """
        Enforces a hard limit of 5000 records on incoming rows payload size to prevent
        resource exhaustion.
        """
        if len(v) > 5000:
            raise ValueError("Dataset payload exceeds the maximum limit of 5000 rows.")
        return v

class LLMUsageStats(BaseModel):
    prompt_tokens: int = Field(default=0, description="Tokens consumed by the input prompt context.")
    completion_tokens: int = Field(default=0, description="Tokens consumed by the generated output completions.")
    total_tokens: int = Field(default=0, description="Total tokens consumed.")
    estimated_cost_usd: float = Field(default=0.0, description="Estimated LLM API usage cost in USD.")
    execution_time_ms: float = Field(default=0.0, description="LLM execution duration in milliseconds.")
    provider: Optional[str] = Field(default=None, description="LLM provider used for this insight.")
    model: Optional[str] = Field(default=None, description="Model identifier used for this insight.")

class InsightResponse(BaseModel):
    insight: str
    success: bool
    error: Optional[str] = None
    correlation_id: Optional[str] = None
    usage_stats: Optional[LLMUsageStats] = None
