from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class SchemaCacheResponse(BaseModel):
    """
    Output serialization schema for returning cached database metadata layouts.
    """
    id: int
    connection_id: int
    table_name: str
    column_name: str
    data_type: str
    is_nullable: Optional[bool] = None
    null_ratio: Optional[float] = None
    distinct_count: Optional[int] = None
    sample_values: Optional[str] = None
    is_pii: bool = False
    created_at: datetime

    class Config:
        from_attributes = True
