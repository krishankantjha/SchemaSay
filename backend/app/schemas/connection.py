from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, model_validator

class ConnectionBase(BaseModel):
    """
    Base connection schema containing fields common across validation stages.
    """
    name: str = Field(..., min_length=1, max_length=128)
    db_type: Literal["postgresql", "mysql", "mssql", "sqlite", "file_upload"]

class ConnectionCreate(ConnectionBase):
    """
    Input validation schema for registering new database connections.
    Enforces conditional validation: server configurations require host/port/credentials,
    while local SQLite and uploads only require file names.
    """
    host: Optional[str] = Field(default=None, max_length=253)
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    username: Optional[str] = Field(default=None, max_length=256)
    password: Optional[str] = Field(default=None, max_length=1024)
    database_name: str = Field(..., min_length=1, max_length=4096)

    @model_validator(mode='before')
    @classmethod
    def validate_connection_parameters(cls, data: dict) -> dict:
        """
        Enforces conditional parameters check based on target database type.
        """
        db_type = data.get("db_type", "").lower()
        
        # Validate network connection parameters for server-based databases
        if db_type in ["postgresql", "mysql", "mssql"]:
            required_fields = ["host", "port", "username", "password"]
            for field in required_fields:
                val = data.get(field)
                if val is None or (isinstance(val, str) and not val.strip()):
                    raise ValueError(f"Field '{field}' is required for database type: {db_type}")
            
            # Port format sanity check
            port_val = data.get("port")
            try:
                port_int = int(port_val)
                if port_int <= 0 or port_int > 65535:
                    raise ValueError("Port must be a valid network port number (1-65535)")
            except (ValueError, TypeError):
                raise ValueError("Port must be a valid integer number")
                
        return data

class ConnectionUpdate(BaseModel):
    """
    Input schema for editing saved connection metadata and optional credentials.
    A blank password preserves the existing encrypted credential.
    """
    name: str = Field(..., min_length=1, max_length=128)
    db_type: Literal["postgresql", "mysql", "mssql", "sqlite", "file_upload"]
    host: Optional[str] = Field(default=None, max_length=253)
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    username: Optional[str] = Field(default=None, max_length=256)
    password: Optional[str] = Field(default=None, max_length=1024)
    database_name: str = Field(..., min_length=1, max_length=4096)

    @model_validator(mode='before')
    @classmethod
    def validate_connection_parameters(cls, data: dict) -> dict:
        db_type = data.get("db_type", "").lower()
        if db_type in {"postgresql", "mysql", "mssql"}:
            for field in ("host", "port", "username"):
                val = data.get(field)
                if val is None or (isinstance(val, str) and not val.strip()):
                    raise ValueError(f"Field '{field}' is required for database type: {db_type}")
        return data


class ConnectionResponse(ConnectionBase):
    """
    Output serialization schema for returning saved connection metadata.
    Completely excludes passwords to maintain credentials safety.
    """
    id: int
    user_id: int
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    database_name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ConnectionTest(BaseModel):
    """
    Input validation schema for testing connection credentials before saving.
    """
    db_type: Literal["postgresql", "mysql", "mssql", "sqlite", "file_upload"]
    host: Optional[str] = Field(default=None, max_length=253)
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    username: Optional[str] = Field(default=None, max_length=256)
    password: Optional[str] = Field(default=None, max_length=1024)
    database_name: str = Field(..., min_length=1, max_length=4096)

    @model_validator(mode='before')
    @classmethod
    def validate_test_parameters(cls, data: dict) -> dict:
        """
        Validates connection parameters before running connection test runs.
        """
        db_type = data.get("db_type", "").lower()
        if db_type in ["postgresql", "mysql", "mssql"]:
            required_fields = ["host", "port", "username", "password"]
            for field in required_fields:
                val = data.get(field)
                if val is None or (isinstance(val, str) and not val.strip()):
                    raise ValueError(f"Field '{field}' is required for database type: {db_type}")
        return data

class ConnectionTestResponse(BaseModel):
    """Result returned when the server tests an already saved connection."""
    success: bool
    healthy: bool
    message: str


class SchemaAliasCreate(BaseModel):
    """Input schema for creating a per-connection table or column alias."""
    alias_type: Literal["table", "column"]
    alias_token: str = Field(..., min_length=1, max_length=128)
    target_table: str = Field(..., min_length=1, max_length=256)
    target_column: Optional[str] = Field(default=None, max_length=256)

    @model_validator(mode="after")
    def validate_alias_shape(self) -> "SchemaAliasCreate":
        if self.alias_type == "column" and not (self.target_column and self.target_column.strip()):
            raise ValueError("target_column is required for column aliases")
        if self.alias_type == "table" and self.target_column:
            raise ValueError("target_column must be omitted for table aliases")
        return self


class SchemaAliasUpdate(BaseModel):
    """Input schema for updating an existing alias mapping."""
    alias_token: str = Field(..., min_length=1, max_length=128)
    target_table: str = Field(..., min_length=1, max_length=256)
    target_column: Optional[str] = Field(default=None, max_length=256)


class SchemaAliasResponse(BaseModel):
    """Serialized alias record returned by the connections API."""
    id: int
    connection_id: int
    alias_type: Literal["table", "column"]
    alias_token: str
    target_table: str
    target_column: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SchemaAliasSuggestionResponse(BaseModel):
    """Suggested alias mapping derived from synced schema metadata."""
    alias_type: Literal["table", "column"]
    alias_token: str
    target_table: str
    target_column: Optional[str] = None
    reason: str


class AuditLogResponse(BaseModel):
    """
    Output serialization schema for query execution logs and history records.
    """
    id: int
    user_id: int
    connection_id: Optional[int] = None
    connection_name: Optional[str] = None
    query_type: str = "assistant"
    question: str
    sql_query: str
    execution_duration_ms: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
