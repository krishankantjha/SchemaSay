import os
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

logger = logging.getLogger("schemasay.connections")

from app.database import get_db
from app.models.user import User
from app.models.connection import DatabaseConnection, QueryAuditLog, DatabaseSchemaCache
from app.models.governance import ConnectionPolicy
from app.schemas.connection import ConnectionCreate, ConnectionResponse, ConnectionTest, AuditLogResponse
from app.schemas.governance import ConnectionPolicyResponse, ConnectionPolicyUpdate
from app.api.routes.auth import get_current_user
from app.core.connections.encryptor import encrypt_password
from app.core.connections.connector import test_connection, process_file_upload, dispose_connection_engine, get_connection
from app.core.schema.sync_service import sync_connection_schema_cache

router = APIRouter(prefix="/connections", tags=["Database Connections"])

@router.post("/test", status_code=status.HTTP_200_OK)
def test_db_connection(payload: ConnectionTest, current_user: User = Depends(get_current_user)):
    """
    Tests database connectivity using credentials before saving.
    Protected by JWT authentication.
    """
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
        
    # Encrypt raw passwords before saving
    encrypted_pw = encrypt_password(payload.password) if payload.password else None
    
    db_connection = DatabaseConnection(
        user_id=current_user.id,
        name=payload.name,
        db_type=payload.db_type,
        host=payload.host,
        port=payload.port,
        username=payload.username,
        database_name=payload.database_name,
        encrypted_password=encrypted_pw
    )
    
    db.add(db_connection)
    db.commit()
    db.refresh(db_connection)
    
    # Auto-sync schema cache on database connection registration
    try:
        engine = get_connection(db_connection)
        result = sync_connection_schema_cache(
            db=db,
            connection=db_connection,
            engine=engine,
            profile=False,
        )
        logger.info(
            "Auto-sync cached %s columns for connection ID: %s",
            result["columns_synced"],
            db_connection.id,
        )
        dispose_connection_engine(db_connection)
    except Exception as e:
        logger.error(f"Auto-sync failed on database connection registration: {str(e)}", exc_info=True)

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
        content = file.file.read()
        # Ingest file content using the connector engine
        sqlite_path, table_name = process_file_upload(file.filename, content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process file upload: {str(e)}"
        )

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
        sync_connection_schema_cache(
            db=db,
            connection=db_connection,
            engine=engine,
            profile=False,
        )
        dispose_connection_engine(db_connection)
    except Exception as e:
        logger.error(f"Auto-sync failed on file upload ingestion: {str(e)}", exc_info=True)

    return db_connection

@router.get("/", response_model=List[ConnectionResponse])
def list_connections(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Queries and lists all database connection metadata records configured by the active user.
    """
    return db.query(DatabaseConnection).filter(DatabaseConnection.user_id == current_user.id).all()

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

    upload_path = connection.database_name if connection.db_type == "file_upload" else None

    try:
        if connection.db_type in ["sqlite", "file_upload"]:
            dispose_connection_engine(connection)

        # Detach audit history before delete (FK uses SET NULL on connection_id).
        db.query(QueryAuditLog).filter(
            QueryAuditLog.connection_id == connection_id,
            QueryAuditLog.user_id == current_user.id,
        ).update({QueryAuditLog.connection_id: None}, synchronize_session=False)

        db.delete(connection)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Failed to delete connection %s: %s", connection_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not remove this connection. Restart the backend and try again.",
        ) from exc

    if upload_path and os.path.exists(upload_path):
        try:
            os.remove(upload_path)
        except Exception:
            pass

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


@router.get("/{connection_id}/policy", response_model=ConnectionPolicyResponse)
def get_connection_policy(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == current_user.id,
    ).first()
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database connection not found")

    policy = db.query(ConnectionPolicy).filter(
        ConnectionPolicy.connection_id == connection_id,
        ConnectionPolicy.user_id == current_user.id,
    ).first()

    if not policy:
        return ConnectionPolicyResponse(connection_id=connection_id)

    return ConnectionPolicyResponse(
        connection_id=connection_id,
        blocked_tables=policy.get_blocked_tables(),
        blocked_columns=policy.get_blocked_columns(),
        require_high_confidence=policy.require_high_confidence,
        min_confidence_threshold=policy.min_confidence_threshold,
        block_pii_access=policy.block_pii_access,
        updated_at=policy.updated_at,
    )


@router.put("/{connection_id}/policy", response_model=ConnectionPolicyResponse)
def upsert_connection_policy(
    connection_id: int,
    payload: ConnectionPolicyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == current_user.id,
    ).first()
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database connection not found")

    policy = db.query(ConnectionPolicy).filter(
        ConnectionPolicy.connection_id == connection_id,
        ConnectionPolicy.user_id == current_user.id,
    ).first()

    if not policy:
        policy = ConnectionPolicy(
            connection_id=connection_id,
            user_id=current_user.id,
        )
        db.add(policy)

    policy.set_blocked_tables(payload.blocked_tables)
    policy.set_blocked_columns(payload.blocked_columns)
    policy.require_high_confidence = payload.require_high_confidence
    policy.min_confidence_threshold = payload.min_confidence_threshold
    policy.block_pii_access = payload.block_pii_access

    db.commit()
    db.refresh(policy)

    return ConnectionPolicyResponse(
        connection_id=connection_id,
        blocked_tables=policy.get_blocked_tables(),
        blocked_columns=policy.get_blocked_columns(),
        require_high_confidence=policy.require_high_confidence,
        min_confidence_threshold=policy.min_confidence_threshold,
        block_pii_access=policy.block_pii_access,
        updated_at=policy.updated_at,
    )
