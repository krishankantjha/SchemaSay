import os
import uuid
import threading
from unittest.mock import patch
from fastapi import status
from app.core.connections.pool import engine_registry
from app.models.connection import DatabaseConnection
from tests.test_assistant import get_auth_token

def test_rate_limiting_enforcement(client, db):
    """
    Verifies that the rate limiter restricts queries when the limit is exceeded.
    Toggles the TESTING environment variable temporarily to activate checks.
    """
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Register temporary db connection
    temp_db_path = os.path.abspath(f"temp_rate_test_{uuid.uuid4().hex}.db")
    payload = {
        "name": "Rate Limit DB",
        "db_type": "sqlite",
        "database_name": temp_db_path
    }
    create_res = client.post("/api/v1/connections/", json=payload, headers=headers)
    assert create_res.status_code == status.HTTP_201_CREATED
    connection_id = create_res.json()["id"]

    # Temporarily activate rate limiter checks by toggling TESTING environment variable
    old_testing = os.environ.get("TESTING", "True")
    os.environ["TESTING"] = "False"
    
    try:
        # Submit 30 valid queries (within limit)
        for _ in range(30):
            res = client.post(
                "/api/v1/query/execute",
                json={"connection_id": connection_id, "sql_query": "SELECT 1"},
                headers=headers
            )
            assert res.status_code == status.HTTP_200_OK

        # The 31st query must exceed the rate limit and return 429 Too Many Requests
        rate_limit_res = client.post(
            "/api/v1/query/execute",
            json={"connection_id": connection_id, "sql_query": "SELECT 1"},
            headers=headers
        )
        assert rate_limit_res.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert "Too many query execution requests" in rate_limit_res.json()["detail"]
    finally:
        os.environ["TESTING"] = old_testing
        client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)

def test_engine_registry_lru_eviction(db):
    """
    Verifies that EngineRegistry maintains a maximum capacity of 50 active engines
    and evicts the oldest (least recently used) connection engine.
    """
    engine_registry.clear()
    assert len(engine_registry._engines) == 0

    # Create and cache 55 dummy SQLite database connections
    records = []
    temp_db_paths = []
    
    try:
        for i in range(55):
            db_path = os.path.abspath(f"temp_lru_test_{i}_{uuid.uuid4().hex}.db")
            temp_db_paths.append(db_path)
            
            record = DatabaseConnection(
                id=i + 1000,  # Offset to prevent conflict
                user_id=1,
                name=f"LRU DB {i}",
                db_type="sqlite",
                database_name=db_path
            )
            records.append(record)
            
            # Cache the engine
            engine_registry.get_engine(record)

        # Assert engine registry enforces the upper limit of 50
        assert len(engine_registry._engines) == 50
        
        # Verify the first 5 engines (IDs 1000-1004) were evicted
        for i in range(5):
            assert (i + 1000) not in engine_registry._engines

        # Verify the last 5 engines (IDs 1050-1054) are present in the cache
        for i in range(50, 55):
            assert (i + 1000) in engine_registry._engines
    finally:
        engine_registry.clear()
        for path in temp_db_paths:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except Exception:
                    pass

def test_query_concurrency_load(client, db):
    """
    Spawns multiple concurrent threads running SQL queries to ensure thread-safety
    and verify the connection pool functions correctly under parallel load.
    """
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Register temporary db connection
    temp_db_path = os.path.abspath(f"temp_con_test_{uuid.uuid4().hex}.db")
    payload = {
        "name": "Concurrency DB",
        "db_type": "sqlite",
        "database_name": temp_db_path
    }
    create_res = client.post("/api/v1/connections/", json=payload, headers=headers)
    assert create_res.status_code == status.HTTP_201_CREATED
    connection_id = create_res.json()["id"]

    # Retrieve database connection record and pool engine
    conn_record = db.query(DatabaseConnection).filter(DatabaseConnection.id == connection_id).first()
    engine = engine_registry.get_engine(conn_record)

    from app.core.execution.query_executor import execute_query
    failures = []

    def run_worker_query():
        try:
            res = execute_query(engine, "SELECT 1", "sqlite")
            if not res.success:
                failures.append(res.error_message)
        except Exception as e:
            failures.append(str(e))

    # Spawn 10 concurrent threads running database queries against the pool
    threads = [threading.Thread(target=run_worker_query) for _ in range(10)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert len(failures) == 0, f"Concurrent worker query executions failed: {failures}"

    # Cleanup
    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)

@patch("app.core.audit.audit_service.log_audit_transaction")
def test_audit_failure_isolation(mock_log, client, db):
    """
    Verifies that a telemetry audit logging failure (e.g. platform DB transaction rollback)
    is completely isolated and does not cause query execution endpoints to fail.
    """
    # Mock log_audit_transaction to raise an exception, simulating database failure
    mock_log.side_effect = Exception("Audit Database Connection Timeout Failure")

    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Register temporary db connection
    temp_db_path = os.path.abspath(f"temp_audit_test_{uuid.uuid4().hex}.db")
    payload = {
        "name": "Audit Isolation DB",
        "db_type": "sqlite",
        "database_name": temp_db_path
    }
    create_res = client.post("/api/v1/connections/", json=payload, headers=headers)
    assert create_res.status_code == status.HTTP_201_CREATED
    connection_id = create_res.json()["id"]

    # Execute a query; despite audit logging throwing exceptions, the HTTP status must be 200 OK
    res = client.post(
        "/api/v1/query/execute",
        json={"connection_id": connection_id, "sql_query": "SELECT 1"},
        headers=headers
    )
    assert res.status_code == status.HTTP_200_OK
    assert "rows" in res.json()

    # Cleanup
    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)
