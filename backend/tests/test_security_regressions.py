from pathlib import Path

import pytest
from sqlalchemy import create_engine

from app.config import settings
from app.core.connections.connector import process_file_upload
from app.core.security.connection_policy import validate_database_target, validate_sqlite_path
from app.core.security.sql_validator import validate_sql_structure
from app.models.token import RefreshToken


def _login(client, email="regression@example.com"):
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword123!", "full_name": "Regression User"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "StrongPassword123!"},
    )
    assert response.status_code == 200
    return response.json()


def test_sql_policy_rejects_pragmas_and_row_locks():
    assert validate_sql_structure("PRAGMA journal_mode=WAL", "sqlite")[0] is False
    assert validate_sql_structure("SELECT * FROM users FOR UPDATE", "postgresql")[0] is False


def test_sqlite_path_is_confined_to_approved_roots():
    with pytest.raises(ValueError):
        validate_sqlite_path("/etc/passwd", must_exist=True)
    safe_path = validate_database_target("sqlite", None, "regression.db")
    assert Path(safe_path).suffix == ".db"


def test_upload_size_budget_is_enforced():
    with pytest.raises(ValueError, match="at most"):
        process_file_upload("large.csv", b"x" * (settings.MAX_UPLOAD_BYTES + 1))


def test_sqlite_metadata_engine_is_constructible():
    engine = create_engine("sqlite:///:memory:")
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT 1").scalar() == 1
    engine.dispose()


def test_refresh_tokens_are_hashed_at_rest(client, db):
    tokens = _login(client, "hashed-token@example.com")
    stored = db.query(RefreshToken).filter(RefreshToken.user_id.isnot(None)).all()
    assert stored
    assert all(len(token.token_hash) == 64 for token in stored)
    assert tokens["refresh_token"] not in {token.token_hash for token in stored}
