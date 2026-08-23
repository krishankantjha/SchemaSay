from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class DatabaseConnection(Base):
    """
    SQLAlchemy database model representing the 'database_connections' table.
    Stores metadata and encrypted credentials for external database servers or flat files.
    """
    __tablename__ = "database_connections"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    db_type = Column(String, nullable=False)  # e.g., 'postgresql', 'mysql', 'mssql', 'sqlite', 'file_upload'
    
    # Connection parameters (nullable for SQLite or flat file uploads)
    host = Column(String, nullable=True)
    port = Column(Integer, nullable=True)
    username = Column(String, nullable=True)
    database_name = Column(String, nullable=False)  # Database name for server connections; local file path for SQLite/file uploads
    encrypted_password = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Establish relations with cascading deletion rules
    schemas = relationship("DatabaseSchemaCache", back_populates="connection", cascade="all, delete-orphan")
    audit_logs = relationship("QueryAuditLog", back_populates="connection")

class DatabaseSchemaCache(Base):
    """
    SQLAlchemy database model representing the 'database_schema_caches' table.
    Caches reflected tables, columns, and data types of connected databases for fast AI lookups.
    """
    __tablename__ = "database_schema_caches"

    id = Column(Integer, primary_key=True)
    connection_id = Column(Integer, ForeignKey("database_connections.id", ondelete="CASCADE"), nullable=False, index=True)
    table_name = Column(String, nullable=False, index=True)
    column_name = Column(String, nullable=False)
    data_type = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    connection = relationship("DatabaseConnection", back_populates="schemas")

class QueryAuditLog(Base):
    """
    SQLAlchemy database model representing the 'query_audit_logs' table.
    Records natural language searches, generated SQL code, execution metrics, and status.
    """
    __tablename__ = "query_audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    connection_id = Column(Integer, ForeignKey("database_connections.id", ondelete="SET NULL"), nullable=True, index=True)
    
    question = Column(String, nullable=False)
    sql_query = Column(String, nullable=False)
    execution_duration_ms = Column(Integer, nullable=True)
    status = Column(String, nullable=False)  # 'success' or 'failed'
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    connection = relationship("DatabaseConnection", back_populates="audit_logs")

    @property
    def connection_name(self):
        return self.connection.name if self.connection else None

    @property
    def query_type(self):
        return "direct_sql" if self.question == "Manual SQL Editor Query" else "assistant"
