import threading
import logging
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine, URL
from app.models.connection import DatabaseConnection
from app.core.connections.encryptor import decrypt_password
from app.core.security.connection_policy import validate_database_target

logger = logging.getLogger("schemasay.pool")

from collections import OrderedDict  # OrderedDict preserves insertion order for LRU eviction

class EngineRegistry:
    """
    Thread-safe registry caching database connection engines by connection ID.
    Reuses connection pools across requests to prevent pool exhaustion and latency.
    Enforces a Least Recently Used (LRU) eviction limit of 50 cached database pools.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if not cls._instance:
                cls._instance = super(EngineRegistry, cls).__new__(cls, *args, **kwargs)
                cls._instance._engines = OrderedDict()
                cls._instance._max_engines = 50
                cls._instance._registry_lock = threading.Lock()
            return cls._instance

    def get_connection_url(self, record: DatabaseConnection) -> URL:
        """
        Constructs a secure SQLAlchemy URL object, ensuring passwords are automatically
        masked in logs and output structures.
        """
        db_type = record.db_type.lower()
        database_name = validate_database_target(
            db_type, record.host, record.database_name, must_exist=db_type == "file_upload"
        )
        password = decrypt_password(record.encrypted_password) if record.encrypted_password else ""

        if db_type == "postgresql":
            return URL.create(
                drivername="postgresql",
                username=record.username,
                password=password,
                host=record.host,
                port=record.port,
                database=database_name
            )
        elif db_type == "mysql":
            return URL.create(
                drivername="mysql+pymysql",
                username=record.username,
                password=password,
                host=record.host,
                port=record.port,
                database=database_name
            )
        elif db_type == "mssql":
            return URL.create(
                drivername="mssql+pymssql",
                username=record.username,
                password=password,
                host=record.host,
                port=record.port,
                database=database_name
            )
        elif db_type in ["sqlite", "file_upload"]:
            return URL.create(
                drivername="sqlite",
                database=database_name
            )
        else:
            raise ValueError(f"Unsupported database connection type: {db_type}")

    def get_engine(self, record: DatabaseConnection) -> Engine:
        """
        Retrieves a cached Engine instance, or instantiates it with thread-safe locking
        and configured connection pool limits.
        """
        connection_id = record.id
        
        # All cache reads and mutations occur under the registry lock. This avoids
        # races between concurrent requests and keeps LRU ordering coherent.
        with self._registry_lock:
            if connection_id in self._engines:
                self._engines.move_to_end(connection_id)
                return self._engines[connection_id]

            url = self.get_connection_url(record)
            logger.info(f"Connection URL generated for connection ID: {connection_id}")
            db_type_lower = record.db_type.lower()

            try:
                if db_type_lower in ["sqlite", "file_upload"]:
                    # SQLite does not support connection pooling; use a simpler single-connection engine
                    engine = create_engine(
                        url,
                        connect_args={"check_same_thread": False, "timeout": 30}
                    )
                else:
                    # Configure driver-specific parameters and timeouts (30 seconds query timeout)
                    connect_args = {}
                    if db_type_lower == "postgresql":
                        connect_args = {"options": "-c statement_timeout=30000"}
                    elif db_type_lower == "mysql":
                        connect_args = {"connect_timeout": 10}
                    elif db_type_lower == "mssql":
                        connect_args = {"login_timeout": 10, "timeout": 30}

                    engine = create_engine(
                        url,
                        pool_size=10,
                        max_overflow=5,
                        pool_recycle=1800,
                        pool_pre_ping=True,
                        connect_args=connect_args
                    )
                
                # Enforce LRU eviction if capacity limit is reached
                if len(self._engines) >= self._max_engines:
                    evicted_id, evicted_engine = self._engines.popitem(last=False)
                    try:
                        evicted_engine.dispose()
                        logger.info(f"LRU Eviction: Disposed connection engine pool for connection ID: {evicted_id}")
                    except Exception as ex:
                        logger.error(f"Error disposing evicted connection pool for connection ID {evicted_id}: {str(ex)}")

                self._engines[connection_id] = engine
                logger.info(f"Successfully cached new connection engine pool for connection ID: {connection_id}")
                return engine
            except Exception as e:
                logger.error(f"Failed to instantiate connection engine pool for connection ID {connection_id}: {str(e)}")
                raise

    def remove_engine(self, connection_id: int) -> None:
        """
        Disposes of the cached connection pool and cleans the registry mapping.
        """
        with self._registry_lock:
            if connection_id in self._engines:
                try:
                    self._engines[connection_id].dispose()
                    logger.info(f"Successfully disposed cached connection engine pool for connection ID: {connection_id}")
                except Exception as e:
                    logger.error(f"Error disposing connection engine pool for connection ID {connection_id}: {str(e)}")
                finally:
                    del self._engines[connection_id]

    def clear(self) -> None:
        """
        Disposes of and clears all cached connection engine pools.
        """
        with self._registry_lock:
            for connection_id in list(self._engines.keys()):
                try:
                    self._engines[connection_id].dispose()
                    logger.info(f"Successfully cleared and disposed engine for connection ID: {connection_id}")
                except Exception:
                    pass
            self._engines.clear()

# Global singleton connection engine registry
engine_registry = EngineRegistry()

# Register event listener for query execution timeouts across SQLite engines
import time
from sqlalchemy import event

@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    dialect_name = conn.dialect.name
    if dialect_name == "sqlite":
        dbapi_conn = conn.connection.dbapi_connection
        if hasattr(dbapi_conn, "set_progress_handler"):
            start_time = time.time()
            def sqlite_progress_handler():
                # If execution runs longer than 30 seconds, abort execution (raises OperationalError)
                if time.time() - start_time > 30:
                    return 1
                return 0
            # Invoke the handler every 100 SQLite virtual machine instructions (low overhead frequency)
            dbapi_conn.set_progress_handler(sqlite_progress_handler, 100)
