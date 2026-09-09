from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field

from app.core.visualization.chart_service import ChartConfig


class JoinInfo(BaseModel):
    from_column: str
    to_column: str


class QueryExplanation(BaseModel):
    summary: str
    assumptions: List[str] = Field(default_factory=list)
    tables_used: List[str] = Field(default_factory=list)
    joins: List[JoinInfo] = Field(default_factory=list)
    confidence: int = 0
    warnings: List[str] = Field(default_factory=list)
    grounded: bool = True
    unknown_tables: List[str] = Field(default_factory=list)
    unknown_columns: List[str] = Field(default_factory=list)
    resolution_source: Optional[str] = None
    metric_id: Optional[int] = None
    metric_name: Optional[str] = None
    metric_label: Optional[str] = None
    learning_examples_used: int = 0
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None


class QueryRequest(BaseModel):
    connection_id: int = Field(..., gt=0)
    question: str = Field(..., min_length=1, max_length=2000)


class RawQueryRequest(BaseModel):
    connection_id: int = Field(..., gt=0)
    sql_query: str = Field(..., min_length=1, max_length=10000)


class QueryResponse(BaseModel):
    sql: str
    success: bool
    error: Optional[str] = None
    results: Optional[List[Dict[str, Any]]] = None
    execution_duration_ms: float = 0.0
    chart_config: ChartConfig = Field(default_factory=ChartConfig)
    explanation: Optional[QueryExplanation] = None
    correlation_id: Optional[str] = None
