import re
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class MetricDimensionSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    label: str = Field(..., min_length=1, max_length=128)
    column_ref: str = Field(..., min_length=1, max_length=256)
    dimension_type: str = Field(default="category", pattern="^(category|time)$")


class MetricCreate(BaseModel):
    connection_id: int = Field(..., gt=0)
    name: str = Field(..., min_length=1, max_length=64)
    label: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = Field(default=None, max_length=2000)
    sql_expression: str = Field(..., min_length=1, max_length=2000)
    base_table: str = Field(..., min_length=1, max_length=128)
    default_filters: Optional[str] = Field(default=None, max_length=2000)
    dimensions: List[MetricDimensionSchema] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def validate_name_slug(cls, value: str) -> str:
        cleaned = value.strip().lower().replace(" ", "_")
        if not re.fullmatch(r"[a-z][a-z0-9_]*", cleaned):
            raise ValueError("Metric name must be a lowercase slug (letters, numbers, underscores).")
        return cleaned


class MetricUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=128)
    description: Optional[str] = Field(default=None, max_length=2000)
    sql_expression: Optional[str] = Field(default=None, min_length=1, max_length=2000)
    base_table: Optional[str] = Field(default=None, min_length=1, max_length=128)
    default_filters: Optional[str] = Field(default=None, max_length=2000)
    dimensions: Optional[List[MetricDimensionSchema]] = None


class MetricResponse(BaseModel):
    id: int
    connection_id: int
    name: str
    label: str
    description: Optional[str]
    sql_expression: str
    base_table: str
    default_filters: Optional[str]
    dimensions: List[MetricDimensionSchema]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MetricPreviewRequest(BaseModel):
    question: Optional[str] = Field(default=None, max_length=2000)
    dimension_names: Optional[List[str]] = Field(default=None)
    execute: bool = Field(default=False)


class MetricPreviewResponse(BaseModel):
    metric_id: int
    metric_name: str
    sql: str
    match_score: float
    dimensions_used: List[str]
    assumptions: List[str]
    results: Optional[list] = None
    execution_duration_ms: Optional[float] = None
