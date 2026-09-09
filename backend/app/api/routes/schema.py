from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.connection import DatabaseConnection, DatabaseSchemaCache
from app.schemas.schema import SchemaCacheResponse
from app.schemas.schema_tree import SchemaTreeResponse, SchemaTableNode, SchemaColumnNode
from app.core.schema.loader import load_schema_graph
from app.api.routes.auth import get_current_user
from app.core.connections.connector import get_connection
from app.core.schema.sync_service import sync_connection_schema_cache

router = APIRouter(prefix="/schema", tags=["Database Schema Introspection"])
logger = logging.getLogger("schemasay.schema")


def _humanize_sync_error(exc: Exception) -> str:
    text = str(exc)
    if "unable to open database file" in text.lower() or "no such file" in text.lower():
        return (
            "Could not open the database file. Check that the file path in Connections "
            "still exists and is readable."
        )
    if "no such column" in text.lower() or "no column named" in text.lower():
        return (
            "SchemaSay's platform database is out of date. Run database migrations "
            "(`alembic upgrade head` in the backend folder), then try Sync again."
        )
    if "authentication failed" in text.lower() or "password authentication" in text.lower():
        return "Database login failed. Verify username and password in Connections."
    if "connection refused" in text.lower():
        return "Could not reach the database server. Check host, port, and that the server is running."
    # Strip SQLAlchemy parameter dumps for readability
    if "[SQL:" in text:
        text = text.split("[SQL:")[0].strip()
    if "(Background on this error" in text:
        text = text.split("(Background on this error")[0].strip()
    return f"Could not read schema from the connected database: {text}"


@router.post("/{connection_id}/sync", status_code=status.HTTP_200_OK)
def sync_connection_schema(
    connection_id: int,
    profile: bool = Query(False, description="Profile row counts and column statistics during sync"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reflects target database schema into the platform cache.
    Set profile=true to sample null ratios, distinct counts, and row counts.
    """
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == current_user.id,
    ).first()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found",
        )

    try:
        engine = get_connection(connection)
        result = sync_connection_schema_cache(
            db=db,
            connection=connection,
            engine=engine,
            profile=profile,
        )
    except Exception as exc:
        message = _humanize_sync_error(exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )

    return {
        "message": "Database schema successfully cached",
        **result,
    }


@router.get("/{connection_id}", response_model=List[SchemaCacheResponse])
def get_cached_schema(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == current_user.id,
    ).first()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found",
        )

    return (
        db.query(DatabaseSchemaCache)
        .filter(DatabaseSchemaCache.connection_id == connection_id)
        .order_by(DatabaseSchemaCache.table_name, DatabaseSchemaCache.column_name)
        .all()
    )


@router.get("/{connection_id}/tree", response_model=SchemaTreeResponse)
def get_cached_schema_tree(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == current_user.id,
    ).first()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found",
        )

    graph = load_schema_graph(db, connection_id)
    tree = graph.to_tree()

    return SchemaTreeResponse(
        connection_id=connection_id,
        tables=[SchemaTableNode(**table) for table in tree],
    )
