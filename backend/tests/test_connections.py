import os
import io
from fastapi import status
from app.core.connections.encryptor import encrypt_password, decrypt_password
from app.models.connection import DatabaseConnection, QueryAuditLog

def test_credentials_encryption_decryption():
    """
    Verifies that credentials encryption and decryption functions symmetrically.
    """
    secret = "SuperSecretPassword123"
    encrypted = encrypt_password(secret)
    assert encrypted != secret
    assert len(encrypted) > 0
    
    decrypted = decrypt_password(encrypted)
    assert decrypted == secret

def test_connection_create_validation_server(client):
    """
    Verifies that connection creation schemas enforce required fields for server-based databases.
    """
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    # Missing Host
    payload = {
        "name": "Invalid Postgres",
        "db_type": "postgresql",
        "port": 5432,
        "username": "user",
        "password": "password",
        "database_name": "db"
    }
    response = client.post("/api/v1/connections/", json=payload, headers=headers)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

def test_connection_create_validation_sqlite(client):
    """
    Verifies that SQLite connections do not require server network parameters.
    """
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    payload = {
        "name": "Valid SQLite",
        "db_type": "sqlite",
        "database_name": "my_local_file.db"
    }
    response = client.post("/api/v1/connections/", json=payload, headers=headers)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["name"] == "Valid SQLite"
    assert data["db_type"] == "sqlite"
    assert data["host"] is None

def test_test_connection_endpoint(client, monkeypatch):
    """
    Verifies the connection test route returns successful and failed status mappings.
    """
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    # Mock connector engine to bypass actual database connection calls
    def mock_test_connection_success(**kwargs):
        return True, ""
        
    def mock_test_connection_fail(**kwargs):
        return False, "Access denied for user 'root'@'localhost'"

    payload = {
        "db_type": "postgresql",
        "host": "localhost",
        "port": 5432,
        "username": "postgres",
        "password": "password",
        "database_name": "test_db"
    }

    # Test Successful connection case
    monkeypatch.setattr("app.api.routes.connections.test_connection", mock_test_connection_success)
    res_success = client.post("/api/v1/connections/test", json=payload, headers=headers)
    assert res_success.status_code == status.HTTP_200_OK
    assert res_success.json()["message"] == "Database connection test succeeded"

    # Test Failed connection case
    monkeypatch.setattr("app.api.routes.connections.test_connection", mock_test_connection_fail)
    res_fail = client.post("/api/v1/connections/test", json=payload, headers=headers)
    assert res_fail.status_code == status.HTTP_400_BAD_REQUEST
    assert "Connection test failed" in res_fail.json()["detail"]

def test_saved_connection_test_uses_server_side_credentials(client, db, monkeypatch):
    """Saved connection tests decrypt credentials server-side and never require browser secrets."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    user_id = client.get("/api/v1/auth/me", headers=headers).json()["id"]
    connection = DatabaseConnection(
        user_id=user_id,
        name="Saved PostgreSQL",
        db_type="postgresql",
        host="localhost",
        port=5432,
        username="reader",
        database_name="analytics",
        encrypted_password=encrypt_password("saved-secret"),
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)

    captured = {}

    def mock_saved_test(**kwargs):
        captured.update(kwargs)
        return True, ""

    monkeypatch.setattr("app.api.routes.connections.test_connection", mock_saved_test)
    response = client.post(f"/api/v1/connections/{connection.id}/test", headers=headers)

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "success": True,
        "healthy": True,
        "message": "Database connection test succeeded",
    }
    assert captured["password"] == "saved-secret"
    assert "password" not in response.json()


def test_connection_update_preserves_existing_password(client, db):
    """Updating metadata without a password keeps the encrypted credential unchanged."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    user_id = client.get("/api/v1/auth/me", headers=headers).json()["id"]
    connection = DatabaseConnection(
        user_id=user_id,
        name="Editable PostgreSQL",
        db_type="postgresql",
        host="localhost",
        port=5432,
        username="reader",
        database_name="analytics",
        encrypted_password=encrypt_password("keep-this-secret"),
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)

    response = client.put(
        f"/api/v1/connections/{connection.id}",
        json={
            "name": "Renamed PostgreSQL",
            "db_type": "postgresql",
            "host": "localhost",
            "port": 5432,
            "username": "reader",
            "database_name": "analytics",
            "password": None,
        },
        headers=headers,
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["name"] == "Renamed PostgreSQL"
    db.refresh(connection)
    assert decrypt_password(connection.encrypted_password) == "keep-this-secret"
    assert "encrypted_password" not in response.json()


def test_connection_crud_flow(client):
    """
    Verifies registering, listing, and deleting database connections.
    """
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Connection
    payload = {
        "name": "My Prod DB",
        "db_type": "postgresql",
        "host": "192.168.1.1",
        "port": 5432,
        "username": "root",
        "password": "secure_password_abc",
        "database_name": "production_sales"
    }
    create_res = client.post("/api/v1/connections/", json=payload, headers=headers)
    assert create_res.status_code == status.HTTP_201_CREATED
    connection_id = create_res.json()["id"]

    # 2. List Connections
    list_res = client.get("/api/v1/connections/", headers=headers)
    assert list_res.status_code == status.HTTP_200_OK
    connections = list_res.json()
    assert len(connections) == 1
    assert connections[0]["name"] == "My Prod DB"
    assert "encrypted_password" not in connections[0]  # Verify password sanitization

    # 3. Delete Connection
    del_res = client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    assert del_res.status_code == status.HTTP_200_OK
    
    # Verify deletion
    verify_res = client.get("/api/v1/connections/", headers=headers)
    assert len(verify_res.json()) == 0

def test_csv_upload_connection(client):
    """
    Verifies that a user can upload a CSV file and convert it into a database connection.
    """
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    csv_data = b"id,name,value\n1,item_a,100\n2,item_b,200\n"
    file_payload = {
        "file": ("test_sales.csv", io.BytesIO(csv_data), "text/csv")
    }
    data_payload = {
        "name": "Sales CSV Upload"
    }
    
    # Upload Spreadsheet file
    response = client.post(
        "/api/v1/connections/upload",
        files=file_payload,
        data=data_payload,
        headers=headers
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["name"] == "Sales CSV Upload"
    assert data["db_type"] == "file_upload"
    assert data["database_name"].endswith(".db")
    
    connection_id = data["id"]
    sqlite_filepath = data["database_name"]
    
    # Confirm local SQLite file is generated on disk
    assert os.path.exists(sqlite_filepath) is True

    # Delete connection
    del_response = client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    assert del_response.status_code == status.HTTP_200_OK
    
    # Verify local file is cleaned from disk
    assert os.path.exists(sqlite_filepath) is False

def test_query_history_endpoint(client, db):
    """
    Verifies query history listing logs for the active user.
    """
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    # Fetch user matching token email
    user_res = client.get("/api/v1/auth/me", headers=headers)
    user_id = user_res.json()["id"]
    import datetime
    
    # Add fake query logs directly to SQLite test database with distinct timestamps and connection IDs
    log1 = QueryAuditLog(
        user_id=user_id,
        connection_id=1,
        question="How many users registered?",
        sql_query="SELECT COUNT(*) FROM users",
        execution_duration_ms=12,
        status="success",
        created_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=10)
    )
    log2 = QueryAuditLog(
        user_id=user_id,
        connection_id=2,
        question="Select all products",
        sql_query="SELECT * FROM products",
        execution_duration_ms=5,
        status="success",
        created_at=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(log1)
    db.add(log2)
    db.commit()

    # Query history without filter
    history_res = client.get("/api/v1/connections/history", headers=headers)
    assert history_res.status_code == status.HTTP_200_OK
    logs = history_res.json()
    assert len(logs) == 2
    assert logs[0]["question"] == "Select all products"  # Sorted chronologically (descending)
    assert logs[1]["question"] == "How many users registered?"

    # Query history filtering by connection_id=1
    history_conn1_res = client.get("/api/v1/connections/history?connection_id=1", headers=headers)
    assert history_conn1_res.status_code == status.HTTP_200_OK
    logs_conn1 = history_conn1_res.json()
    assert len(logs_conn1) == 1
    assert logs_conn1[0]["question"] == "How many users registered?"

    # Query history filtering by connection_id=2
    history_conn2_res = client.get("/api/v1/connections/history?connection_id=2", headers=headers)
    assert history_conn2_res.status_code == status.HTTP_200_OK
    logs_conn2 = history_conn2_res.json()
    assert len(logs_conn2) == 1
    assert logs_conn2[0]["question"] == "Select all products"

# --- Helper Utility to generate active auth token ---
def get_auth_token(client) -> str:
    """
    Utility creating a test user and returning a valid login token.
    """
    email = "test_user_conn@example.com"
    password = "Password123!"
    
    client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Connection Tester"
    })
    
    login_res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": password
    })
    return login_res.json()["access_token"]
