import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-0123456789-0123456789")
os.environ.setdefault("ENCRYPTION_KEY", "7c2w6QFqE7d3hK2x5uXvGmYwQ8rTnZpL0sA1bC2dE3f=")
os.environ["TESTING"] = "True"
os.environ["ALLOWED_SQLITE_ROOTS"] = os.getcwd()

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app

# Configure an isolated, in-memory SQLite engine for rapid, zero-dependency testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    """
    Sets up a clean database schema before each test function and tears it down afterwards.
    Ensures complete isolation between test executions.
    """
    Base.metadata.create_all(bind=engine)
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db):
    """
    FastAPI client fixture overriding the get_db dependency.
    """
    def override_get_db():
        try:
            yield db
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture(scope="function", autouse=True)
def clear_connection_registry():
    """
    Clears the global connection engine registry before each test function
    to prevent connection state leaks across tests.
    """
    from app.core.connections.pool import engine_registry
    engine_registry.clear()
