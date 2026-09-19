import os
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

logger = logging.getLogger("schemasay.connections")

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.connection import ConnectionSchemaAlias, DatabaseConnection, QueryAuditLog, DatabaseSchemaCache
from app.models.governance import ConnectionPolicy
from app.schemas.connection import (
    ConnectionCreate,
    ConnectionResponse,
    ConnectionTest,
    ConnectionTestResponse,
    ConnectionUpdate,
    AuditLogResponse,
    SchemaAliasCreate,
    SchemaAliasResponse,
    SchemaAliasUpdate,
)
from app.schemas.governance import ConnectionPolicyResponse, ConnectionPolicyUpdate
from app.api.routes.auth import get_current_user
from app.core.connections.encryptor import decrypt_password, encrypt_password
from app.core.connections.connector import test_connection, process_file_upload, dispose_connection_engine, get_connection
from app.core.schema.sync_service import sync_connection_schema_cache
from app.core.schema.alias_validation import (
    load_schema_index,
    normalize_alias_token,
    resolve_schema_target,
    validate_alias_token,
)
from app.core.security.connection_policy import validate_database_target, validate_remote_host

router = APIRouter(prefix="/connections", tags=["Database Connections"])


def _get_user_connection(db: Session, connection_id: int, user_id: int) -> DatabaseConnection:
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == user_id,
    ).first()
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database connection not found")
    return connection


def _get_user_alias(
    db: Session,
    connection_id: int,
    alias_id: int,
    user_id: int,
) -> ConnectionSchemaAlias:
    alias = (
        db.query(ConnectionSchemaAlias)
        .filter(
            ConnectionSchemaAlias.id == alias_id,
            ConnectionSchemaAlias.connection_id == connection_id,
        )
        .first()
    )
    if not alias:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema alias not found")
    _get_user_connection(db, connection_id, user_id)
    return alias


def _alias_to_response(alias: ConnectionSchemaAlias) -> SchemaAliasResponse:
    return SchemaAliasResponse(
        id=alias.id,
        connection_id=alias.connection_id,
        alias_type=alias.alias_type,
        alias_token=alias.alias_token,
        target_table=alias.target_table,
        target_column=alias.target_column,
        created_at=alias.created_at,
    )


def _validate_alias_payload(
    db: Session,
    connection_id: int,
    alias_type: str,
    alias_token: str,
    target_table: str,
    target_column: Optional[str],
    exclude_alias_id: Optional[int] = None,
) -> tuple[str, str, Optional[str]]:
    token_error = validate_alias_token(alias_token)
    if token_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=token_error)

    normalized_token = normalize_alias_token(alias_token)
    schema_index = load_schema_index(db, connection_id)
    canonical_table, canonical_column, target_error = resolve_schema_target(
        schema_index,
        target_table,
        target_column if alias_type == "column" else None,
    )
    if target_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=target_error)

    duplicate_query = db.query(ConnectionSchemaAlias).filter(
        ConnectionSchemaAlias.connection_id == connection_id,
        ConnectionSchemaAlias.alias_type == alias_type,
        ConnectionSchemaAlias.alias_token == normalized_token,
    )
    if exclude_alias_id is not None:
        duplicate_query = duplicate_query.filter(ConnectionSchemaAlias.id != exclude_alias_id)
    if duplicate_query.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Alias '{normalized_token}' already exists for this connection",
        )

    return normalized_token, canonical_table, canonical_column

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
        sync_connection_schema_cache(
            db=db,
            connection=db_connection,
            engine=engine,
            profile=False,
        )
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


@router.get("/{connection_id}/aliases", response_model=List[SchemaAliasResponse])
def list_connection_aliases(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_user_connection(db, connection_id, current_user.id)
    aliases = (
        db.query(ConnectionSchemaAlias)
        .filter(ConnectionSchemaAlias.connection_id == connection_id)
        .order_by(ConnectionSchemaAlias.alias_type, ConnectionSchemaAlias.alias_token)
        .all()
    )
    return [_alias_to_response(alias) for alias in aliases]


@router.post("/{connection_id}/aliases", response_model=SchemaAliasResponse, status_code=status.HTTP_201_CREATED)
def create_connection_alias(
    connection_id: int,
    payload: SchemaAliasCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_user_connection(db, connection_id, current_user.id)
    normalized_token, canonical_table, canonical_column = _validate_alias_payload(
        db=db,
        connection_id=connection_id,
        alias_type=payload.alias_type,
        alias_token=payload.alias_token,
        target_table=payload.target_table,
        target_column=payload.target_column,
    )

    alias = ConnectionSchemaAlias(
        connection_id=connection_id,
        alias_type=payload.alias_type,
        alias_token=normalized_token,
        target_table=canonical_table,
        target_column=canonical_column,
    )
    db.add(alias)
    db.commit()
    db.refresh(alias)
    return _alias_to_response(alias)


@router.put("/{connection_id}/aliases/{alias_id}", response_model=SchemaAliasResponse)
def update_connection_alias(
    connection_id: int,
    alias_id: int,
    payload: SchemaAliasUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alias = _get_user_alias(db, connection_id, alias_id, current_user.id)
    normalized_token, canonical_table, canonical_column = _validate_alias_payload(
        db=db,
        connection_id=connection_id,
        alias_type=alias.alias_type,
        alias_token=payload.alias_token,
        target_table=payload.target_table,
        target_column=payload.target_column if alias.alias_type == "column" else None,
        exclude_alias_id=alias.id,
    )

    alias.alias_token = normalized_token
    alias.target_table = canonical_table
    alias.target_column = canonical_column if alias.alias_type == "column" else None

    db.commit()
    db.refresh(alias)
    return _alias_to_response(alias)


@router.delete("/{connection_id}/aliases/{alias_id}", status_code=status.HTTP_200_OK)
def delete_connection_alias(
    connection_id: int,
    alias_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alias = _get_user_alias(db, connection_id, alias_id, current_user.id)
    db.delete(alias)
    db.commit()
    return {"message": "Schema alias deleted"}


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
