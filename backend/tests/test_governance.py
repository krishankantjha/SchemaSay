import os
import uuid

from fastapi import status
from sqlalchemy import create_engine, text

from app.core.governance.pii import detect_pii_column
from app.core.governance.policies import evaluate_sql_policy
from app.core.schema.graph import SchemaGraph
from app.models.governance import ConnectionPolicy


def _auth_headers(client):
    email = f"governance_user_{uuid.uuid4().hex}@example.com"
    password = "Password123!"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Governance Tester"},
    )
    token = client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_db_with_users_table():
    temp_db_path = os.path.abspath(f"temp_governance_{uuid.uuid4().hex}.db")
    engine = create_engine(f"sqlite:///{temp_db_path}")
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY,
                    email TEXT,
                    name TEXT
                )
                """
            )
        )
        conn.execute(text("INSERT INTO users (email, name) VALUES ('alice@example.com', 'Alice')"))
        conn.commit()
    engine.dispose()
    return temp_db_path


def test_detect_pii_column_by_name_and_sample():
    assert detect_pii_column("users", "email", "TEXT", '["alice@example.com"]') is True
    assert detect_pii_column("users", "name", "TEXT", '["Alice"]') is False


def test_policy_blocks_table_access():
    policy = ConnectionPolicy(
        connection_id=1,
        user_id=1,
        blocked_tables_json='["users"]',
        blocked_columns_json="[]",
    )
    graph = SchemaGraph.from_schema_metadata(
        [
            {"table_name": "users", "column_name": "email", "data_type": "TEXT"},
            {"table_name": "orders", "column_name": "id", "data_type": "INTEGER"},
        ]
    )
    result = evaluate_sql_policy("SELECT email FROM users", graph, policy)
    assert result.allowed is False
    assert "blocked" in (result.message or "").lower()


def test_connection_policy_api_and_enforcement(client, db):
    headers = _auth_headers(client)
    temp_db_path = _create_db_with_users_table()

    create_conn = client.post(
        "/api/v1/connections/",
        json={"name": "Governance DB", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    connection_id = create_conn.json()["id"]

    sync_res = client.post(f"/api/v1/schema/{connection_id}/sync", headers=headers)
    assert sync_res.status_code == status.HTTP_200_OK

    tree_res = client.get(f"/api/v1/schema/{connection_id}/tree", headers=headers)
    email_col = next(
        col
        for col in tree_res.json()["tables"][0]["columns"]
        if col["name"] == "email"
    )
    assert email_col["is_pii"] is True

    policy_res = client.put(
        f"/api/v1/connections/{connection_id}/policy",
        json={"blocked_tables": ["users"], "blocked_columns": [], "block_pii_access": False},
        headers=headers,
    )
    assert policy_res.status_code == status.HTTP_200_OK

    blocked = client.post(
        "/api/v1/assistant/execute-raw",
        json={"connection_id": connection_id, "sql_query": "SELECT email FROM users"},
        headers=headers,
    )
    assert blocked.status_code == status.HTTP_403_FORBIDDEN

    blocked_via_query_execute = client.post(
        "/api/v1/query/execute",
        json={"connection_id": connection_id, "sql_query": "SELECT email FROM users"},
        headers=headers,
    )
    assert blocked_via_query_execute.status_code == status.HTTP_403_FORBIDDEN

    allowed = client.post(
        "/api/v1/assistant/execute-raw",
        json={"connection_id": connection_id, "sql_query": "SELECT 1"},
        headers=headers,
    )
    assert allowed.status_code == status.HTTP_200_OK

    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)


def test_audit_list_detail_and_replay(client, db):
    headers = _auth_headers(client)
    temp_db_path = _create_db_with_users_table()

    create_conn = client.post(
        "/api/v1/connections/",
        json={"name": "Audit DB", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    connection_id = create_conn.json()["id"]

    exec_res = client.post(
        "/api/v1/assistant/execute-raw",
        json={"connection_id": connection_id, "sql_query": "SELECT name FROM users"},
        headers=headers,
    )
    assert exec_res.status_code == status.HTTP_200_OK
    correlation_id = exec_res.json()["correlation_id"]
    assert correlation_id

    list_res = client.get("/api/v1/audit/?limit=10", headers=headers)
    assert list_res.status_code == status.HTTP_200_OK
    logs = list_res.json()
    assert len(logs) >= 1
    audit_id = logs[0]["id"]
    assert logs[0]["correlation_id"] == correlation_id

    detail_res = client.get(f"/api/v1/audit/{audit_id}", headers=headers)
    assert detail_res.status_code == status.HTTP_200_OK
    assert detail_res.json()["sql_query"] == "SELECT name FROM users"

    replay_res = client.post(f"/api/v1/audit/{audit_id}/replay", headers=headers)
    assert replay_res.status_code == status.HTTP_200_OK
    assert replay_res.json()["success"] is True

    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)
