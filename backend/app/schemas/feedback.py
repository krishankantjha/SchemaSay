from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


ALLOWED_FEEDBACK_CATEGORIES = {
    "incomplete",
    "not_what_i_meant",
    "need_change",
    "empty_or_too_much",
    "other",
}


class FeedbackCreate(BaseModel):
    connection_id: int = Field(..., gt=0)
    audit_log_id: Optional[int] = Field(default=None, gt=0)
    correlation_id: Optional[str] = Field(default=None, max_length=128)
    question: Optional[str] = Field(default=None, max_length=2000)
    generated_sql: Optional[str] = Field(default=None, max_length=10000)
    rating: str = Field(..., min_length=1, max_length=32)
    corrected_sql: Optional[str] = Field(default=None, max_length=10000)
    comment: Optional[str] = Field(default=None, max_length=2000)
    feedback_categories: List[str] = Field(default_factory=list)
    result_row_count: Optional[int] = Field(default=None, ge=0)
    result_columns: List[str] = Field(default_factory=list)

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, value: str) -> str:
        allowed = {"thumbs_up", "thumbs_down", "corrected"}
        cleaned = value.strip().lower()
        if cleaned not in allowed:
            raise ValueError(f"rating must be one of: {', '.join(sorted(allowed))}")
        return cleaned

    @field_validator("feedback_categories")
    @classmethod
    def validate_feedback_categories(cls, values: List[str]) -> List[str]:
        cleaned: List[str] = []
        for value in values:
            token = value.strip().lower()
            if token not in ALLOWED_FEEDBACK_CATEGORIES:
                raise ValueError(f"Invalid feedback category: {value}")
            if token not in cleaned:
                cleaned.append(token)
        return cleaned


class FeedbackResponse(BaseModel):
    id: int
    connection_id: int
    audit_log_id: Optional[int]
    correlation_id: Optional[str] = None
    question: str
    generated_sql: Optional[str]
    corrected_sql: Optional[str]
    rating: str
    comment: Optional[str]
    feedback_categories: List[str] = Field(default_factory=list)
    result_row_count: Optional[int] = None
    result_columns: List[str] = Field(default_factory=list)
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
