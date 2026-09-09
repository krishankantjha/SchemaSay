import os
import uuid

from fastapi import status
from sqlalchemy import create_engine, text

from app.core.schema.graph import SchemaGraph
from app.core.grounding.validator import validate_sql_grounding
from app.core.explanation.confidence import compute_confidence_score
from app.core.explanation.builder import build_query_explanation


SAMPLE_SCHEMA = [
    {"table_name": "orders", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "orders", "column_name": "user_id", "data_type": "INTEGER | FOREIGN KEY -> users.id"},
    {"table_name": "orders", "column_name": "price", "data_type": "FLOAT"},
    {"table_name": "users", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "users", "column_name": "name", "data_type": "TEXT"},
]


def _auth_token(client) -> str:
    email = f"pipeline_user_{uuid.uuid4().hex}@example.com"
    password = "Password123!"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Pipeline Tester"},
    )
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return login_res.json()["access_token"]


def test_schema_graph_builds_tree_and_join_path():
    graph = SchemaGraph.from_schema_metadata(SAMPLE_SCHEMA)

    assert graph.table_exists("orders")
    assert graph.column_exists("orders", "price")
    assert graph.column_exists("users", "name") is True

    path = graph.join_path("orders", "users")
    assert path is not None
    assert path[0].from_table == "orders"
    assert path[0].to_table == "users"

    tree = graph.to_tree()
    assert len(tree) == 2
    orders = next(item for item in tree if item["name"] == "orders")
    assert any(col["name"] == "price" for col in orders["columns"])


def test_grounding_rejects_unknown_schema_objects():
    graph = SchemaGraph.from_schema_metadata(SAMPLE_SCHEMA)

    valid = validate_sql_grounding("SELECT price FROM orders", graph)
    assert valid.valid is True
    assert "orders" in valid.tables_referenced

    invalid = validate_sql_grounding("SELECT ghost_col FROM orders", graph)
    assert invalid.valid is False
    assert any("ghost_col" in col for col in invalid.unknown_columns)

    missing_table = validate_sql_grounding("SELECT * FROM invoices", graph)
    assert missing_table.valid is False
    assert "invoices" in missing_table.unknown_tables


def test_grounding_skips_when_schema_cache_empty():
    graph = SchemaGraph.from_schema_metadata([])
    result = validate_sql_grounding("SELECT 1", graph)
    assert result.valid is True
    assert any("skipped" in warning.lower() for warning in result.warnings)


def test_explanation_and_confidence_payload():
    graph = SchemaGraph.from_schema_metadata(SAMPLE_SCHEMA)
    sql = "SELECT SUM(price) FROM orders"
    grounding = validate_sql_grounding(sql, graph)
    confidence = compute_confidence_score(
        question="total price amount for orders",
        sql=sql,
        graph=graph,
        grounding=grounding,
        used_llm=False,
    )
    explanation = build_query_explanation(
        question="total price amount for orders",
        sql=sql,
        graph=graph,
        grounding=grounding,
        confidence=confidence,
        used_llm=False,
    )

    assert explanation["grounded"] is True
    assert explanation["confidence"] >= 50
    assert "orders" in explanation["tables_used"]
    assert any("SUM" in item for item in explanation["assumptions"])


def test_assistant_response_includes_explanation(client):
    token = _auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    temp_db_path = os.path.abspath(f"temp_pipeline_{uuid.uuid4().hex}.db")
    engine = create_engine(f"sqlite:///{temp_db_path}")
    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE items (id INTEGER PRIMARY KEY, item_name TEXT)"))
        conn.execute(text("INSERT INTO items (item_name) VALUES ('Widget')"))
        conn.commit()
    engine.dispose()

    create_res = client.post(
        "/api/v1/connections/",
        json={"name": "Pipeline DB", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    assert create_res.status_code == status.HTTP_201_CREATED
    connection_id = create_res.json()["id"]

    raw_res = client.post(
        "/api/v1/assistant/execute-raw",
        json={"connection_id": connection_id, "sql_query": "SELECT item_name FROM items"},
        headers=headers,
    )
    assert raw_res.status_code == status.HTTP_200_OK
    payload = raw_res.json()
    assert payload["success"] is True
    assert payload["explanation"] is not None
    assert payload["explanation"]["grounded"] is True
    assert payload["correlation_id"]

    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)


def test_confidence_threshold_blocks_low_confidence_queries(client, monkeypatch):
    monkeypatch.setattr("app.config.settings.MIN_CONFIDENCE_TO_EXECUTE", 50)

    token = _auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    temp_db_path = os.path.abspath(f"temp_confidence_{uuid.uuid4().hex}.db")
    create_res = client.post(
        "/api/v1/connections/",
        json={"name": "Confidence DB", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    connection_id = create_res.json()["id"]

    blocked = client.post(
        "/api/v1/assistant/execute-raw",
        json={"connection_id": connection_id, "sql_query": "SELECT 1"},
        headers=headers,
    )
    assert blocked.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "below minimum threshold" in blocked.json()["detail"].lower()

    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)


def test_schema_tree_endpoint(client, monkeypatch):
    token = _auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    create_res = client.post(
        "/api/v1/connections/",
        json={"name": "Tree DB", "db_type": "sqlite", "database_name": "tree_test.db"},
        headers=headers,
    )
    connection_id = create_res.json()["id"]

    mock_schema = [
        {"table_name": "orders", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
        {"table_name": "orders", "column_name": "amount", "data_type": "FLOAT"},
    ]
    monkeypatch.setattr("app.core.schema.sync_service.reflect_database_schema", lambda eng: mock_schema)

    sync_res = client.post(f"/api/v1/schema/{connection_id}/sync", headers=headers)
    assert sync_res.status_code == status.HTTP_200_OK

    tree_res = client.get(f"/api/v1/schema/{connection_id}/tree", headers=headers)
    assert tree_res.status_code == status.HTTP_200_OK
    data = tree_res.json()
    assert data["connection_id"] == connection_id
    assert len(data["tables"]) == 1
    assert data["tables"][0]["name"] == "orders"
    assert len(data["tables"][0]["columns"]) == 2

    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)


def test_grounding_blocks_unknown_table_on_assistant_raw(client):
    token = _auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    temp_db_path = os.path.abspath(f"temp_ground_block_{uuid.uuid4().hex}.db")
    engine = create_engine(f"sqlite:///{temp_db_path}")
    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE items (id INTEGER PRIMARY KEY, item_name TEXT)"))
        conn.commit()
    engine.dispose()

    create_res = client.post(
        "/api/v1/connections/",
        json={"name": "Grounding DB", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    connection_id = create_res.json()["id"]

    sync_res = client.post(f"/api/v1/schema/{connection_id}/sync", headers=headers)
    assert sync_res.status_code == status.HTTP_200_OK

    fail_res = client.post(
        "/api/v1/assistant/execute-raw",
        json={"connection_id": connection_id, "sql_query": "SELECT * FROM missing_table"},
        headers=headers,
    )
    assert fail_res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "unknown tables" in fail_res.json()["detail"].lower()

    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)
