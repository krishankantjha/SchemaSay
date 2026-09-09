from typing import List, Optional

from pydantic import BaseModel


class SchemaColumnNode(BaseModel):
    name: str
    data_type: str
    is_primary_key: bool = False
    is_foreign_key: bool = False
    fk_references: Optional[str] = None
    is_nullable: Optional[bool] = None
    null_ratio: Optional[float] = None
    distinct_count: Optional[int] = None
    sample_values: Optional[List[str]] = None
    is_pii: bool = False


class SchemaTableNode(BaseModel):
    name: str
    row_count: Optional[int] = None
    columns: List[SchemaColumnNode]


class SchemaTreeResponse(BaseModel):
    connection_id: int
    tables: List[SchemaTableNode]
