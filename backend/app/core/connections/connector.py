import io
import logging
import re
import uuid
from pathlib import Path
from typing import Tuple

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, URL

from app.config import settings
from app.core.connections.pool import engine_registry
from app.core.security.connection_policy import validate_database_target, validate_sqlite_path
from app.models.connection import DatabaseConnection

logger = logging.getLogger("schemasay.connector")

DATA_DIR = Path(settings.SQLITE_DATA_DIR).expanduser().resolve(strict=False)


def sanitize_error_message(msg: str) -> str:
    """Mask credentials and connection URLs before an error is logged or returned."""
    pattern = r"[a-zA-Z0-9+\-_]+://[^/]+@"
    return re.sub(pattern, "***://***@", msg)


def get_connection_url(
    db_type: str,
    host: str | None,
    port: int | None,
    username: str | None,
    password: str | None,
    database_name: str,
) -> URL:
    """Construct a SQLAlchemy URL after validating the target boundary."""
    db_type = (db_type or "").strip().lower()
    database_name = validate_database_target(db_type, host, database_name)

    if db_type == "postgresql":
        return URL.create(
            drivername="postgresql",
            username=username,
            password=password,
            host=host,
            port=port,
            database=database_name,
        )
    if db_type == "mysql":
        return URL.create(
            drivername="mysql+pymysql",
            username=username,
            password=password,
            host=host,
            port=port,
            database=database_name,
        )
    if db_type == "mssql":
        return URL.create(
            drivername="mssql+pymssql",
            username=username,
            password=password,
            host=host,
            port=port,
            database=database_name,
        )
    if db_type in {"sqlite", "file_upload"}:
        return URL.create(drivername="sqlite", database=database_name)
    raise ValueError("Unsupported database connection type")


def get_connection_string(
    db_type: str,
    host: str,
    port: int,
    username: str,
    password: str,
    database_name: str,
) -> str:
    return str(get_connection_url(db_type, host, port, username, password, database_name))


def get_connection(record: DatabaseConnection) -> Engine:
    return engine_registry.get_engine(record)


def dispose_connection_engine(record: DatabaseConnection) -> None:
    engine_registry.remove_engine(record.id)


def test_connection(
    db_type: str,
    host: str,
    port: int,
    username: str,
    password: str,
    database_name: str,
) -> Tuple[bool, str]:
    """Attempt a bounded connection test and always dispose its temporary engine."""
    engine = None
    try:
        url = get_connection_url(db_type, host, port, username, password, database_name)
        connect_args = {}
        db_type_lower = db_type.lower()
        if db_type_lower in {"postgresql", "mysql"}:
            connect_args = {"connect_timeout": 10}
        elif db_type_lower == "mssql":
            connect_args = {"login_timeout": 10}

        if db_type_lower in {"sqlite", "file_upload"}:
            engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": 10})
        else:
            engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True)

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, ""
    except ValueError as exc:
        return False, str(exc)
    except Exception as exc:
        error_msg = sanitize_error_message(str(exc))
        logger.error("Database connection test failed for %s: %s", db_type, error_msg)
        return False, "Database connection test failed"
    finally:
        if engine is not None:
            engine.dispose()


def _read_upload_frame(file_name: str, file_content: bytes) -> pd.DataFrame:
    if len(file_content) > settings.MAX_UPLOAD_BYTES:
        raise ValueError(f"Uploaded files must be at most {settings.MAX_UPLOAD_BYTES} bytes")

    suffix = Path(file_name or "").suffix.lower()
    read_kwargs = {"nrows": settings.MAX_UPLOAD_ROWS + 1}
    if suffix == ".csv":
        frame = pd.read_csv(io.BytesIO(file_content), **read_kwargs)
    elif suffix in {".xlsx", ".xls"}:
        frame = pd.read_excel(io.BytesIO(file_content), **read_kwargs)
    else:
        raise ValueError("Unsupported file format. Only CSV and Excel files are supported.")

    if len(frame) > settings.MAX_UPLOAD_ROWS:
        raise ValueError(f"Uploaded files must contain at most {settings.MAX_UPLOAD_ROWS} rows")
    if len(frame.columns) > settings.MAX_UPLOAD_COLUMNS:
        raise ValueError(f"Uploaded files must contain at most {settings.MAX_UPLOAD_COLUMNS} columns")
    return frame


def process_file_upload(file_name: str, file_content: bytes) -> Tuple[str, str]:
    """Load a bounded CSV/Excel upload into an application-owned SQLite database."""
    if not file_name:
        raise ValueError("An uploaded file name is required")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    frame = _read_upload_frame(file_name, file_content)

    table_name = re.sub(r"[^a-zA-Z0-9_]", "_", Path(file_name).stem).strip("_").lower()
    table_name = table_name or "uploaded_table"
    db_path = validate_sqlite_path(str(DATA_DIR / f"{uuid.uuid4().hex}.db"))

    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    try:
        frame.to_sql(table_name, con=engine, index=False, if_exists="replace")
    except Exception:
        Path(db_path).unlink(missing_ok=True)
        raise
    finally:
        engine.dispose()
    return db_path, table_name
