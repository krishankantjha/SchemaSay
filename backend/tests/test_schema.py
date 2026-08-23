import os
import io
from fastapi import status
from sqlalchemy import create_engine, text
from app.core.schema.introspector import reflect_database_schema
from app.models.connection import DatabaseSchemaCache

def test_reflect_database_schema_keys_mapping():
    """
    Verifies that reflect_database_schema correctly inspects tables, columns,
    and encodes primary and foreign key constraints.
    """
    # Create an in-memory SQLite database containing mock tables and foreign keys
    engine = create_engine("sqlite:///:memory:")
    with engine.connect() as conn:
        conn.execute(text(
            "CREATE TABLE users_test ("
            "  id INTEGER PRIMARY KEY,"
            "  email TEXT NOT NULL UNIQUE"
            ")"
        ))
        conn.execute(text(
            "CREATE TABLE profiles_test ("
            "  user_id INTEGER,"
            "  bio TEXT,"
            "  FOREIGN KEY(user_id) REFERENCES users_test(id)"
            ")"
        ))
        conn.commit()

    schema = reflect_database_schema(engine)
    
    # Locate column descriptors
    user_id_col = next(col for col in schema if col["table_name"] == "users_test" and col["column_name"] == "id")
    user_email_col = next(col for col in schema if col["table_name"] == "users_test" and col["column_name"] == "email")
    profile_uid_col = next(col for col in schema if col["table_name"] == "profiles_test" and col["column_name"] == "user_id")

    # Assert correct type mapping and key constraints encoding
    assert "INTEGER | PRIMARY KEY" in user_id_col["data_type"]
    assert "TEXT" in user_email_col["data_type"]
    assert "PRIMARY KEY" not in user_email_col["data_type"]
    assert "INTEGER | FOREIGN KEY -> users_test.id" in profile_uid_col["data_type"]

def test_sync_schema_api_endpoint(client, monkeypatch):
    """
    Verifies that POST /schema/{connection_id}/sync reflecting and bulk saving.
    """
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Register a SQLite Connection
    payload = {
        "name": "Sync Test DB",
        "db_type": "sqlite",
        "database_name": "sync_test.db"
    }
    create_res = client.post("/api/v1/connections/", json=payload, headers=headers)
    assert create_res.status_code == status.HTTP_201_CREATED
    connection_id = create_res.json()["id"]

    # 2. Mock introspector reflecting returns mock schema entries
    mock_schema = [
        {"table_name": "orders", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
        {"table_name": "orders", "column_name": "amount", "data_type": "FLOAT"}
    ]
    monkeypatch.setattr("app.api.routes.schema.reflect_database_schema", lambda eng: mock_schema)

    # 3. Trigger manual Sync API call
    sync_res = client.post(f"/api/v1/schema/{connection_id}/sync", headers=headers)
    assert sync_res.status_code == status.HTTP_200_OK
    data = sync_res.json()
    assert data["columns_synced"] == 2
    assert data["tables_synced"] == 1

    # 4. Fetch cached schema items
    get_res = client.get(f"/api/v1/schema/{connection_id}", headers=headers)
    assert get_res.status_code == status.HTTP_200_OK
    schema_list = get_res.json()
    assert len(schema_list) == 2
    assert schema_list[0]["table_name"] == "orders"
    assert schema_list[0]["column_name"] == "amount"
    assert schema_list[1]["column_name"] == "id"

def test_auto_sync_on_connection_creation(client, db):
    """
    Verifies that creating a new SQLite connection automatically triggers schema caching.
    """
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    import uuid
    # Create a temporary SQLite database file containing a dummy table
    temp_db_path = os.path.abspath(f"temp_auto_sync_{uuid.uuid4().hex}.db")
    temp_engine = create_engine(f"sqlite:///{temp_db_path}")
    with temp_engine.connect() as conn:
        conn.execute(text("CREATE TABLE test_auto_sync_table (id INTEGER PRIMARY KEY, info TEXT)"))
        conn.commit()
    temp_engine.dispose()
    
    payload = {
        "name": "Auto Sync Test",
        "db_type": "sqlite",
        "database_name": temp_db_path
    }
    
    response = client.post("/api/v1/connections/", json=payload, headers=headers)
    assert response.status_code == status.HTTP_201_CREATED
    connection_id = response.json()["id"]

    # Clear transaction caching isolation state
    db.commit()

    # Query DB to check if DatabaseSchemaCache rows were populated automatically
    cache_entries = db.query(DatabaseSchemaCache).filter(
        DatabaseSchemaCache.connection_id == connection_id
    ).all()
    
    assert len(cache_entries) == 2  # id and info columns
    cols = sorted([entry.column_name for entry in cache_entries])
    assert cols == ["id", "info"]
    assert cache_entries[0].table_name == "test_auto_sync_table"

    # Cleanup connection
    del_res = client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    assert del_res.status_code == status.HTTP_200_OK
    
    # Clean up the file manually since it was a standard "sqlite" connection, not a "file_upload"
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)
    assert os.path.exists(temp_db_path) is False

def test_auto_sync_on_file_upload(client, db):
    """
    Verifies that uploading a CSV file automatically creates the connection and syncs the schema.
    """
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    csv_data = b"product_id,price,stock\n101,15.99,50\n102,9.99,100\n"
    file_payload = {
        "file": ("products_upload.csv", io.BytesIO(csv_data), "text/csv")
    }
    data_payload = {
        "name": "Auto Sync Upload"
    }

    response = client.post(
        "/api/v1/connections/upload",
        files=file_payload,
        data=data_payload,
        headers=headers
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    connection_id = data["id"]
    sqlite_filepath = data["database_name"]

    # Clear transaction caching isolation state
    db.commit()

    # Query DB to check if DatabaseSchemaCache rows were populated automatically
    cache_entries = db.query(DatabaseSchemaCache).filter(
        DatabaseSchemaCache.connection_id == connection_id
    ).all()

    # The CSV table schema (products_upload table) should be cached automatically
    assert len(cache_entries) == 3
    cols = sorted([entry.column_name for entry in cache_entries])
    assert cols == ["price", "product_id", "stock"]
    
    # Cleanup disk file
    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    assert os.path.exists(sqlite_filepath) is False

# --- Helper Utility to generate active auth token ---
def get_auth_token(client) -> str:
    """
    Utility creating a test user and returning a valid login token.
    """
    email = "test_user_schema@example.com"
    password = "Password123!"
    
    client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Schema Tester"
    })
    
    login_res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": password
    })
    return login_res.json()["access_token"]
