import os
import uuid
from fastapi import status
from sqlalchemy import create_engine, text
from app.models.connection import DatabaseConnection, QueryAuditLog
from app.core.ai.query_generator import heuristic_offline_compiler
from app.core.ai.executor import execute_assistant_query, validate_sql_structure

def test_heuristic_offline_compiler_rules():
    """
    Verifies that the offline compiler fallback correctly parses natural language
    questions, matches cached tables/columns, extracts limits, and generates SQL.
    """
    schema = [
        {"table_name": "orders", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
        {"table_name": "orders", "column_name": "user_id", "data_type": "INTEGER | FOREIGN KEY -> users.id"},
        {"table_name": "orders", "column_name": "price", "data_type": "FLOAT"},
        {"table_name": "orders", "column_name": "created_at", "data_type": "TIMESTAMP"},
        {"table_name": "users", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
        {"table_name": "users", "column_name": "name", "data_type": "TEXT"}
    ]

    # Test limit extraction
    sql_limit = heuristic_offline_compiler("show top 5 orders", "sqlite", schema)
    assert "LIMIT 5" in sql_limit
    assert "FROM orders" in sql_limit

    # Test columns projection matching
    sql_cols = heuristic_offline_compiler("get price from orders", "sqlite", schema)
    assert "SELECT price FROM orders" in sql_cols

    # Test count aggregation
    sql_count = heuristic_offline_compiler("how many orders exist", "sqlite", schema)
    assert "SELECT COUNT(*) FROM orders" in sql_count

    # Test sum aggregation
    sql_sum = heuristic_offline_compiler("total price amount for orders", "sqlite", schema)
    assert "SELECT SUM(price) FROM orders" in sql_sum

    # Test chronological sorting
    sql_chrono = heuristic_offline_compiler("get latest orders", "sqlite", schema)
    assert "ORDER BY created_at DESC" in sql_chrono

    # Test relationship auto-joins
    sql_join = heuristic_offline_compiler("list orders and users", "sqlite", schema)
    assert "JOIN users ON orders.user_id = users.id" in sql_join

    # Test MSSQL dialect limits TOP N
    sql_mssql = heuristic_offline_compiler("show top 5 orders", "mssql", schema)
    assert "SELECT TOP 5" in sql_mssql
    assert "LIMIT" not in sql_mssql

def test_ast_safety_filter_validation():
    """
    Verifies that the sqlglot AST verification blocks unsafe structures.
    """
    # Test valid select
    is_ok, err = validate_sql_structure("SELECT id, name FROM users WHERE id = 1")
    assert is_ok is True

    # Test blocked UNION SELECT
    is_ok, err = validate_sql_structure("SELECT id FROM orders UNION SELECT password FROM users")
    assert is_ok is False
    assert "UNION operations are blocked" in err

    # Test blocked stacked query semicolons
    is_ok, err = validate_sql_structure("SELECT * FROM users; DROP TABLE credentials")
    assert is_ok is False
    assert "stacked query statements containing semicolons are blocked" in err.lower()

    # Test blocked write operations
    mutations = [
        "DROP TABLE users",
        "INSERT INTO users (name) VALUES ('hacker')",
        "DELETE FROM orders WHERE id = 1",
        "UPDATE accounts SET balance = 0",
        "ALTER TABLE users ADD COLUMN age INT",
        "TRUNCATE TABLE logs",
        "MERGE INTO target USING source ON target.id = source.id WHEN MATCHED THEN UPDATE SET target.val = source.val",
        "WITH evil AS (INSERT INTO users (name) VALUES ('hacker') RETURNING id) SELECT * FROM evil",
        "WITH evil AS (DELETE FROM orders WHERE id = 1) SELECT * FROM evil",
        "SELECT * INTO new_table FROM users"
    ]
    for sql in mutations:
        is_ok, err = validate_sql_structure(sql)
        assert is_ok is False
        assert ("Access Denied" in err or "SQL Syntax Error" in err)

    # Test blocked procedures call
    is_ok, err = validate_sql_structure("CALL my_procedure()")
    assert is_ok is False
    assert "Stored procedure or utility query commands are blocked" in err

    # Test blocked timing attacks
    timing_attacks = [
        "SELECT pg_sleep(5)",
        "SELECT sleep(10)",
        "SELECT * FROM users WHERE id = 1 AND pg_sleep(5) = 1",
        "WAITFOR DELAY '00:00:05'"
    ]
    for sql in timing_attacks:
        is_ok, err = validate_sql_structure(sql)
        assert is_ok is False
        assert ("Timing" in err or "SQL Syntax Error" in err or "Access Denied" in err)

def test_query_execution_and_telemetry_logging(client, db):
    """
    Verifies that valid read-only SQL queries run correctly on the connection pool
    and log execution records into the Database QueryAuditLog schema.
    """
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    # Register test database file containing a valid table
    temp_db_path = os.path.abspath(f"temp_exec_test_{uuid.uuid4().hex}.db")
    temp_engine = create_engine(f"sqlite:///{temp_db_path}")
    with temp_engine.connect() as conn:
        conn.execute(text("CREATE TABLE test_items (id INTEGER PRIMARY KEY, item_name TEXT)"))
        conn.execute(text("INSERT INTO test_items (item_name) VALUES ('Widget A')"))
        conn.execute(text("INSERT INTO test_items (item_name) VALUES ('Widget B')"))
        conn.commit()
    temp_engine.dispose()

    # Create connection record in platform db
    payload = {
        "name": "Executor Test DB",
        "db_type": "sqlite",
        "database_name": temp_db_path
    }
    create_res = client.post("/api/v1/connections/", json=payload, headers=headers)
    assert create_res.status_code == status.HTTP_201_CREATED
    connection_id = create_res.json()["id"]
    
    # Retrieve model record
    conn_record = db.query(DatabaseConnection).filter(DatabaseConnection.id == connection_id).first()

    # Execute valid SELECT query
    success, error, results, duration_ms = execute_assistant_query(
        user_id=conn_record.user_id,
        connection=conn_record,
        question="Show my items list",
        raw_sql="SELECT * FROM test_items ORDER BY id ASC",
        db=db
    )
    assert success is True
    assert error == "SELECT * FROM test_items ORDER BY id ASC"
    assert len(results) == 2
    assert results[0]["item_name"] == "Widget A"
    assert duration_ms > 0.0

    # Query audit logs to verify database telemetry record
    audit_logs = db.query(QueryAuditLog).filter(QueryAuditLog.connection_id == connection_id).all()
    assert len(audit_logs) == 1
    assert audit_logs[0].question == "Show my items list"
    assert audit_logs[0].sql_query == "SELECT * FROM test_items ORDER BY id ASC"
    assert audit_logs[0].status == "success"
    assert audit_logs[0].error_message is None

    # Test audit history pagination
    history_res = client.get("/api/v1/connections/history?page=1&limit=1", headers=headers)
    assert history_res.status_code == status.HTTP_200_OK
    assert len(history_res.json()) == 1

    # Cleanup database connection and files
    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)

def test_assistant_api_endpoints_security(client, db):
    """
    Verifies that assistant query and raw query execution endpoints are protected by auth
    and reject unauthorized or unsafe actions with HTTP 400.
    """
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Register temporary db connection
    temp_db_path = os.path.abspath(f"temp_sec_test_{uuid.uuid4().hex}.db")
    payload = {
        "name": "Endpoint Sec DB",
        "db_type": "sqlite",
        "database_name": temp_db_path
    }
    create_res = client.post("/api/v1/connections/", json=payload, headers=headers)
    assert create_res.status_code == status.HTTP_201_CREATED
    connection_id = create_res.json()["id"]

    # 1. Test unauthorized query post
    unauth_res = client.post("/api/v1/assistant/query", json={"connection_id": connection_id, "question": "show me tables"})
    assert unauth_res.status_code == status.HTTP_401_UNAUTHORIZED

    # 2. Test safety failure response mapped to HTTP 400 Bad Request on execute-raw
    safety_fail_res = client.post(
        "/api/v1/assistant/execute-raw",
        json={"connection_id": connection_id, "sql_query": "DROP TABLE test_items"},
        headers=headers
    )
    assert safety_fail_res.status_code == status.HTTP_400_BAD_REQUEST
    assert "Unsafe mutating operation" in safety_fail_res.json()["detail"]

    # 3. Test safety failure response mapped to HTTP 400 Bad Request on query/execute
    safety_direct_fail_res = client.post(
        "/api/v1/query/execute",
        json={"connection_id": connection_id, "sql_query": "INSERT INTO users (name) VALUES ('hacker')"},
        headers=headers
    )
    assert safety_direct_fail_res.status_code == status.HTTP_400_BAD_REQUEST
    assert "Unsafe mutating operation" in safety_direct_fail_res.json()["detail"]

    # 4. Test structured error parsing mapped to HTTP 422 Unprocessable Entity for table absence
    err_res = client.post(
        "/api/v1/query/execute",
        json={"connection_id": connection_id, "sql_query": "SELECT * FROM non_existent_table"},
        headers=headers
    )
    assert err_res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "does not exist" in err_res.json()["detail"].lower()

    # 5. Test sanitized fallback error message for general database execution errors
    fallback_res = client.post(
        "/api/v1/query/execute",
        json={"connection_id": connection_id, "sql_query": "SELECT invalid_func()"},
        headers=headers
    )
    assert fallback_res.status_code == status.HTTP_502_BAD_GATEWAY
    assert "An unexpected database error occurred during query execution" in fallback_res.json()["detail"]

    # Cleanup connection
    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)

# --- Helper Utility to generate active auth token ---
def get_auth_token(client) -> str:
    """
    Utility creating a test user and returning a valid login token.
    """
    email = f"test_user_assistant_{uuid.uuid4().hex}@example.com"
    password = "Password123!"
    
    client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Assistant Tester"
    })
    
    login_res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": password
    })
    return login_res.json()["access_token"]

def test_format_sql_query(client):
    """
    Verifies that the /query/format endpoint successfully formats SQL queries.
    """
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Clean query format test
    unformatted_sql = "SELECT id,name,email FROM users WHERE status='active' ORDER BY id desc"
    res = client.post("/api/v1/query/format", json={"sql_query": unformatted_sql}, headers=headers)
    assert res.status_code == status.HTTP_200_OK
    formatted_sql = res.json()["formatted_sql"]
    
    # Assert formatting was applied
    assert "SELECT" in formatted_sql
    assert "\n" in formatted_sql or "  " in formatted_sql

    # Invalid query format fallback verification
    invalid_sql = "SELECT id FROM FROM"
    fallback_res = client.post("/api/v1/query/format", json={"sql_query": invalid_sql}, headers=headers)
    assert fallback_res.status_code == status.HTTP_200_OK
    assert fallback_res.json()["formatted_sql"] == invalid_sql
