from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class FeedbackCreate(BaseModel):
    connection_id: int = Field(..., gt=0)
    audit_log_id: Optional[int] = Field(default=None, gt=0)
    question: Optional[str] = Field(default=None, max_length=2000)
    generated_sql: Optional[str] = Field(default=None, max_length=10000)
    rating: str = Field(..., min_length=1, max_length=32)
    corrected_sql: Optional[str] = Field(default=None, max_length=10000)
    comment: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, value: str) -> str:
        allowed = {"thumbs_up", "thumbs_down", "corrected"}
        cleaned = value.strip().lower()
        if cleaned not in allowed:
            raise ValueError(f"rating must be one of: {', '.join(sorted(allowed))}")
        return cleaned


class FeedbackResponse(BaseModel):
    id: int
    connection_id: int
    audit_log_id: Optional[int]
    question: str
    generated_sql: Optional[str]
    corrected_sql: Optional[str]
    rating: str
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class FeedbackExampleResponse(BaseModel):
    question: str
    sql: str
    similarity: float
    source: str


class FeedbackExamplesResponse(BaseModel):
    connection_id: int
    question: str
    examples: List[FeedbackExampleResponse] = Field(default_factory=list)
