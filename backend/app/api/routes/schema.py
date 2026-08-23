from typing import List
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.connection import DatabaseConnection, DatabaseSchemaCache
from app.schemas.schema import SchemaCacheResponse
from app.api.routes.auth import get_current_user
from app.core.connections.connector import get_connection
from app.core.schema.introspector import reflect_database_schema

router = APIRouter(prefix="/schema", tags=["Database Schema Introspection"])
logger = logging.getLogger("schemasay.schema")

@router.post("/{connection_id}/sync", status_code=status.HTTP_200_OK)
def sync_connection_schema(connection_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Connects to the target database, reflects its structural layout and key metadata,
    and updates the local platform database schema cache.
    """
    # Verify connection belongs to the authenticated user
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
        
    try:
        # Obtain connection engine and reflect database schema structure
        engine = get_connection(connection)
        metadata_list = reflect_database_schema(engine)
    except Exception:
        logger.exception("Failed to connect and introspect database schema")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to connect and introspect database schema"
        ) from None
        
    # Clear old schema caches for this connection
    db.query(DatabaseSchemaCache).filter(
        DatabaseSchemaCache.connection_id == connection_id
    ).delete()
    
    # Bulk insert new schema caches
    cache_entries = [
        DatabaseSchemaCache(
            connection_id=connection_id,
            table_name=entry["table_name"],
            column_name=entry["column_name"],
            data_type=entry["data_type"]
        )
        for entry in metadata_list
    ]
    
    db.bulk_save_objects(cache_entries)
    db.commit()
    
    return {
        "message": "Database schema successfully cached",
        "columns_synced": len(cache_entries),
        "tables_synced": len(set(entry["table_name"] for entry in metadata_list))
    }

@router.get("/{connection_id}", response_model=List[SchemaCacheResponse])
def get_cached_schema(connection_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Retrieves the cached schema layout from local database storage for immediate frontend access.
    """
    # Verify connection belongs to the active user
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
        
    # Query cached entries sorted by table and column names
    return db.query(DatabaseSchemaCache).filter(
        DatabaseSchemaCache.connection_id == connection_id
    ).order_by(DatabaseSchemaCache.table_name, DatabaseSchemaCache.column_name).all()
