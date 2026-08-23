import os
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

logger = logging.getLogger("schemasay.connections")

from app.database import get_db
from app.models.user import User
from app.models.connection import DatabaseConnection, QueryAuditLog, DatabaseSchemaCache
from app.schemas.connection import (
    ConnectionCreate,
    ConnectionResponse,
    ConnectionTest,
    ConnectionTestResponse,
    ConnectionUpdate,
    AuditLogResponse,
)
from app.api.routes.auth import get_current_user
from app.core.connections.encryptor import decrypt_password, encrypt_password
from app.core.connections.connector import test_connection, process_file_upload, dispose_connection_engine, get_connection
from app.core.schema.introspector import reflect_database_schema
from app.core.security.connection_policy import validate_database_target, validate_remote_host
from app.config import settings

router = APIRouter(prefix="/connections", tags=["Database Connections"])

@router.post("/test", status_code=status.HTTP_200_OK)
def test_db_connection(payload: ConnectionTest, current_user: User = Depends(get_current_user)):
    """
    Tests database connectivity using credentials before saving.
    Protected by JWT authentication.
    """
    try:
        if payload.db_type.lower() in {"postgresql", "mysql", "mssql"}:
            validate_remote_host(payload.host or "")
        else:
            validate_database_target(payload.db_type, payload.host, payload.database_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    success, error_message = test_connection(
        db_type=payload.db_type,
        host=payload.host or "",
        port=payload.port or 0,
        username=payload.username or "",
        password=payload.password or "",
        database_name=payload.database_name
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connection test failed: {error_message}"
        )
        
    return {"message": "Database connection test succeeded"}

@router.post("/", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
def create_connection(payload: ConnectionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Encrypts connection credentials and registers a database metadata record.
    """
    # Verify uniqueness of the connection name for the user
    existing = db.query(DatabaseConnection).filter(
        DatabaseConnection.user_id == current_user.id,
        DatabaseConnection.name == payload.name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A connection with this name already exists"
        )
        
    try:
        canonical_database_name = validate_database_target(
            payload.db_type, payload.host, payload.database_name
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Encrypt raw passwords before saving
    encrypted_pw = encrypt_password(payload.password) if payload.password else None
    
    db_connection = DatabaseConnection(
        user_id=current_user.id,
        name=payload.name,
        db_type=payload.db_type,
        host=payload.host,
        port=payload.port,
        username=payload.username,
        database_name=canonical_database_name,
        encrypted_password=encrypted_pw
    )
    
    db.add(db_connection)
    db.commit()
    db.refresh(db_connection)
    
    # Auto-sync schema cache on database connection registration
    try:
        engine = get_connection(db_connection)
        metadata_list = reflect_database_schema(engine)
        cache_entries = [
            DatabaseSchemaCache(
                connection_id=db_connection.id,
                table_name=entry["table_name"],
                column_name=entry["column_name"],
                data_type=entry["data_type"]
            )
            for entry in metadata_list
        ]
        logger.info(f"Auto-sync cached {len(cache_entries)} columns for connection ID: {db_connection.id}")
        db.bulk_save_objects(cache_entries)
        db.commit()
        dispose_connection_engine(db_connection)
    except Exception:
        logger.exception("Auto-sync failed on database connection registration")

    return db_connection

@router.post("/upload", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
def upload_file_connection(
    name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ingests an uploaded CSV/Excel spreadsheet, loads it into a local SQLite table,
    and registers a SQLite database connection record.
    """
    # Verify name uniqueness
    existing = db.query(DatabaseConnection).filter(
        DatabaseConnection.user_id == current_user.id,
        DatabaseConnection.name == name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A connection with this name already exists"
        )

    try:
        chunks = []
        total_bytes = 0
        while True:
            chunk = file.file.read(min(1024 * 1024, settings.MAX_UPLOAD_BYTES + 1 - total_bytes))
            if not chunk:
                break
            chunks.append(chunk)
            total_bytes += len(chunk)
            if total_bytes > settings.MAX_UPLOAD_BYTES:
                raise ValueError(f"Uploaded files must be at most {settings.MAX_UPLOAD_BYTES} bytes")
        content = b"".join(chunks)
        sqlite_path, table_name = process_file_upload(file.filename or "", content)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception:
        logger.exception("Failed to process file upload")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to process file upload"
        ) from None

    db_connection = DatabaseConnection(
        user_id=current_user.id,
        name=name,
        db_type="file_upload",
        database_name=sqlite_path  # The SQLite file path acts as the database name
    )
    
    db.add(db_connection)
    db.commit()
    db.refresh(db_connection)
    
    # Auto-sync schema cache on spreadsheet file uploads ingestion
    try:
        engine = get_connection(db_connection)
        metadata_list = reflect_database_schema(engine)
        cache_entries = [
            DatabaseSchemaCache(
                connection_id=db_connection.id,
                table_name=entry["table_name"],
                column_name=entry["column_name"],
                data_type=entry["data_type"]
            )
            for entry in metadata_list
        ]
        db.bulk_save_objects(cache_entries)
        db.commit()
        dispose_connection_engine(db_connection)
    except Exception:
        logger.exception("Auto-sync failed on file upload ingestion")

    return db_connection

@router.get("/", response_model=List[ConnectionResponse])
def list_connections(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Queries and lists all database connection metadata records configured by the active user.
    """
    return db.query(DatabaseConnection).filter(DatabaseConnection.user_id == current_user.id).all()

@router.post("/{connection_id}/test", response_model=ConnectionTestResponse, status_code=status.HTTP_200_OK)
def test_saved_connection(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tests a saved connection without sending its encrypted credential to the browser."""
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == current_user.id,
    ).first()
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database connection not found")

    try:
        password = decrypt_password(connection.encrypted_password) if connection.encrypted_password else ""
        healthy, error_message = test_connection(
            db_type=connection.db_type,
            host=connection.host or "",
            port=connection.port or 0,
            username=connection.username or "",
            password=password,
            database_name=connection.database_name,
        )
    except Exception:
        logger.exception("Saved connection test failed for connection ID %s", connection_id)
        healthy, error_message = False, "Database connection test failed"

    if healthy:
        return ConnectionTestResponse(
            success=True,
            healthy=True,
            message="Database connection test succeeded",
        )

    return ConnectionTestResponse(
        success=False,
        healthy=False,
        message=error_message or "Database connection test failed",
    )


@router.put("/{connection_id}", response_model=ConnectionResponse, status_code=status.HTTP_200_OK)
def update_connection(
    connection_id: int,
    payload: ConnectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Updates saved connection metadata and optionally replaces its encrypted password."""
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == current_user.id,
    ).first()
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database connection not found")

    duplicate = db.query(DatabaseConnection).filter(
        DatabaseConnection.user_id == current_user.id,
        DatabaseConnection.name == payload.name,
        DatabaseConnection.id != connection_id,
    ).first()
    if duplicate:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A connection with this name already exists")

    try:
        if payload.db_type in {"postgresql", "mysql", "mssql"}:
            validate_remote_host(payload.host or "")
        canonical_database_name = validate_database_target(
            payload.db_type,
            payload.host,
            payload.database_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if payload.db_type in {"postgresql", "mysql", "mssql"}:
        if not payload.password and not connection.encrypted_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is required for this connection")
    else:
        connection.encrypted_password = None

    connection.name = payload.name
    connection.db_type = payload.db_type
    connection.host = payload.host
    connection.port = payload.port
    connection.username = payload.username
    connection.database_name = canonical_database_name
    if payload.password:
        connection.encrypted_password = encrypt_password(payload.password)

    db.query(DatabaseSchemaCache).filter(
        DatabaseSchemaCache.connection_id == connection.id,
    ).delete(synchronize_session=False)
    db.commit()
    db.refresh(connection)
    dispose_connection_engine(connection)
    return connection


@router.delete("/{connection_id}", status_code=status.HTTP_200_OK)
def delete_connection(connection_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Deletes the target connection record and cleanses any local spreadsheet files from disk.
    """
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
        
    # Cleanse local disk files if connection type was a spreadsheet upload
    if connection.db_type in ["sqlite", "file_upload"]:
        # Dispose of connection engine to release file locks on Windows
        dispose_connection_engine(connection)
        if connection.db_type == "file_upload" and os.path.exists(connection.database_name):
            try:
                os.remove(connection.database_name)
            except Exception:
                pass  # Fail silently on file system cleanup
            
    db.delete(connection)
    db.commit()
    return {"message": "Database connection successfully deleted"}

@router.get("/history", response_model=List[AuditLogResponse])
def get_query_history(
    page: int = 1,
    limit: int = 100,
    connection_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the paginated query execution history logs for the active user.
    Optionally filters history logs to a specific connection source connection_id.
    """
    page_val = max(1, page)
    limit_val = max(1, min(100, limit))  # Enforce client request caps
    
    query = db.query(QueryAuditLog).filter(
        QueryAuditLog.user_id == current_user.id
    )
    
    if connection_id is not None:
        query = query.filter(QueryAuditLog.connection_id == connection_id)
        
    return query.order_by(
        QueryAuditLog.created_at.desc()
    ).offset((page_val - 1) * limit_val).limit(limit_val).all()
