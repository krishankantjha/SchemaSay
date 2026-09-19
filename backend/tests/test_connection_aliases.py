import os
import uuid

from fastapi import status
from sqlalchemy import create_engine, text

from app.models.connection import ConnectionSchemaAlias, DatabaseConnection, DatabaseSchemaCache


def _auth_headers(client):
    email = f"alias_user_{uuid.uuid4().hex}@example.com"
    password = "Password123!"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Alias Tester"},
    )
    token = client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_db_with_orders():
    temp_db_path = os.path.abspath(f"temp_aliases_{uuid.uuid4().hex}.db")
    engine = create_engine(f"sqlite:///{temp_db_path}")
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY,
                    name TEXT
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE orders (
                    id INTEGER PRIMARY KEY,
                    price REAL
                )
                """
            )
        )
        conn.commit()
    engine.dispose()
    return temp_db_path


def _seed_schema_cache(db, connection_id: int):
    db.add_all(
        [
            DatabaseSchemaCache(
                connection_id=connection_id,
                table_name="users",
                column_name="id",
                data_type="INTEGER",
            ),
            DatabaseSchemaCache(
                connection_id=connection_id,
                table_name="users",
                column_name="name",
                data_type="TEXT",
            ),
            DatabaseSchemaCache(
                connection_id=connection_id,
                table_name="orders",
                column_name="id",
                data_type="INTEGER",
            ),
            DatabaseSchemaCache(
                connection_id=connection_id,
                table_name="orders",
                column_name="price",
                data_type="REAL",
            ),
        ]
    )
    db.commit()


def test_alias_crud_flow(client, db):
    headers = _auth_headers(client)
    temp_db_path = _create_db_with_orders()

    create_conn = client.post(
        "/api/v1/connections/",
        json={"name": "Alias DB", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    connection_id = create_conn.json()["id"]
    _seed_schema_cache(db, connection_id)

    table_alias = client.post(
        f"/api/v1/connections/{connection_id}/aliases",
        json={
            "alias_type": "table",
            "alias_token": "buyer",
            "target_table": "users",
        },
        headers=headers,
    )
    assert table_alias.status_code == status.HTTP_201_CREATED
    table_alias_id = table_alias.json()["id"]
    assert table_alias.json()["alias_token"] == "buyer"
    assert table_alias.json()["target_table"] == "users"

    column_alias = client.post(
        f"/api/v1/connections/{connection_id}/aliases",
        json={
            "alias_type": "column",
            "alias_token": "income",
            "target_table": "orders",
            "target_column": "price",
        },
        headers=headers,
    )
    assert column_alias.status_code == status.HTTP_201_CREATED

    list_res = client.get(f"/api/v1/connections/{connection_id}/aliases", headers=headers)
    assert list_res.status_code == status.HTTP_200_OK
    assert len(list_res.json()) == 2

    update_res = client.put(
        f"/api/v1/connections/{connection_id}/aliases/{table_alias_id}",
        json={
            "alias_token": "customer",
            "target_table": "Users",
        },
        headers=headers,
    )
    assert update_res.status_code == status.HTTP_200_OK
    assert update_res.json()["alias_token"] == "customer"
    assert update_res.json()["target_table"] == "users"

    delete_res = client.delete(
        f"/api/v1/connections/{connection_id}/aliases/{table_alias_id}",
        headers=headers,
    )
    assert delete_res.status_code == status.HTTP_200_OK

    remaining = client.get(f"/api/v1/connections/{connection_id}/aliases", headers=headers).json()
    assert len(remaining) == 1
    assert remaining[0]["alias_token"] == "income"


def test_alias_rejects_unknown_table(client, db):
    headers = _auth_headers(client)
    temp_db_path = _create_db_with_orders()
    create_conn = client.post(
        "/api/v1/connections/",
        json={"name": "Alias DB 2", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    connection_id = create_conn.json()["id"]
    _seed_schema_cache(db, connection_id)

    response = client.post(
        f"/api/v1/connections/{connection_id}/aliases",
        json={
            "alias_type": "table",
            "alias_token": "buyer",
            "target_table": "accounts",
        },
        headers=headers,
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "not found" in response.json()["detail"].lower()


def test_alias_rejects_duplicate_token(client, db):
    headers = _auth_headers(client)
    temp_db_path = _create_db_with_orders()
    create_conn = client.post(
        "/api/v1/connections/",
        json={"name": "Alias DB 3", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    connection_id = create_conn.json()["id"]
    _seed_schema_cache(db, connection_id)

    payload = {
        "alias_type": "table",
        "alias_token": "buyer",
        "target_table": "users",
    }
    first = client.post(f"/api/v1/connections/{connection_id}/aliases", json=payload, headers=headers)
    assert first.status_code == status.HTTP_201_CREATED

    duplicate = client.post(f"/api/v1/connections/{connection_id}/aliases", json=payload, headers=headers)
    assert duplicate.status_code == status.HTTP_400_BAD_REQUEST
    assert "already exists" in duplicate.json()["detail"].lower()


def test_alias_requires_synced_schema(client, db):
    headers = _auth_headers(client)
    user_id = client.get("/api/v1/auth/me", headers=headers).json()["id"]
    temp_db_path = _create_db_with_orders()
    connection = DatabaseConnection(
        user_id=user_id,
        name="Alias DB 4",
        db_type="sqlite",
        database_name=temp_db_path,
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    connection_id = connection.id

    response = client.post(
        f"/api/v1/connections/{connection_id}/aliases",
        json={
            "alias_type": "table",
            "alias_token": "buyer",
            "target_table": "users",
        },
        headers=headers,
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "sync schema" in response.json()["detail"].lower()


def test_connection_delete_cascades_aliases(client, db):
    headers = _auth_headers(client)
    temp_db_path = _create_db_with_orders()
    create_conn = client.post(
        "/api/v1/connections/",
        json={"name": "Alias DB 5", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    connection_id = create_conn.json()["id"]
    _seed_schema_cache(db, connection_id)

    client.post(
        f"/api/v1/connections/{connection_id}/aliases",
        json={"alias_type": "table", "alias_token": "buyer", "target_table": "users"},
        headers=headers,
    )

    delete_res = client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    assert delete_res.status_code == status.HTTP_200_OK
    assert db.query(ConnectionSchemaAlias).count() == 0
