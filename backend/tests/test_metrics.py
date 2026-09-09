import os
import uuid

from fastapi import status
from sqlalchemy import create_engine, text

from app.core.semantics.resolver import build_metric_sql, resolve_metric_question
from app.core.schema.graph import SchemaGraph
from app.models.metric import MetricDefinition


def _auth_headers(client):
    email = f"metrics_user_{uuid.uuid4().hex}@example.com"
    password = "Password123!"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Metrics Tester"},
    )
    token = client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_orders_db():
    temp_db_path = os.path.abspath(f"temp_metrics_{uuid.uuid4().hex}.db")
    engine = create_engine(f"sqlite:///{temp_db_path}")
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE orders (
                    id INTEGER PRIMARY KEY,
                    region TEXT,
                    total_amount REAL,
                    order_date TEXT
                )
                """
            )
        )
        conn.execute(text("INSERT INTO orders (region, total_amount, order_date) VALUES ('North', 100.0, '2024-07-01')"))
        conn.execute(text("INSERT INTO orders (region, total_amount, order_date) VALUES ('South', 200.0, '2024-07-02')"))
        conn.execute(text("INSERT INTO orders (region, total_amount, order_date) VALUES ('North', 150.0, '2024-07-03')"))
        conn.commit()
    engine.dispose()
    return temp_db_path


def test_metric_crud_and_preview(client, db):
    headers = _auth_headers(client)
    temp_db_path = _create_orders_db()

    create_conn = client.post(
        "/api/v1/connections/",
        json={"name": "Metrics DB", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    connection_id = create_conn.json()["id"]

    metric_payload = {
        "connection_id": connection_id,
        "name": "total_revenue",
        "label": "Total Revenue",
        "description": "Sum of order amounts",
        "sql_expression": "SUM(total_amount)",
        "base_table": "orders",
        "dimensions": [
            {
                "name": "region",
                "label": "Region",
                "column_ref": "orders.region",
                "dimension_type": "category",
            }
        ],
    }
    create_metric = client.post("/api/v1/metrics/", json=metric_payload, headers=headers)
    assert create_metric.status_code == status.HTTP_201_CREATED
    metric_id = create_metric.json()["id"]

    list_res = client.get(f"/api/v1/metrics/?connection_id={connection_id}", headers=headers)
    assert list_res.status_code == status.HTTP_200_OK
    assert len(list_res.json()) == 1

    preview_res = client.post(
        f"/api/v1/metrics/{metric_id}/preview",
        json={"question": "Show total revenue by region", "execute": True},
        headers=headers,
    )
    assert preview_res.status_code == status.HTTP_200_OK
    preview = preview_res.json()
    assert "SUM(total_amount)" in preview["sql"]
    assert preview["results"] is not None
    assert len(preview["results"]) >= 1

    client.delete(f"/api/v1/metrics/{metric_id}", headers=headers)
    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)


def test_semantic_metric_resolution_in_assistant(client, db):
    headers = _auth_headers(client)
    temp_db_path = _create_orders_db()

    create_conn = client.post(
        "/api/v1/connections/",
        json={"name": "Semantic DB", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    connection_id = create_conn.json()["id"]

    metric_payload = {
        "connection_id": connection_id,
        "name": "total_revenue",
        "label": "Total Revenue",
        "description": "Revenue from all orders",
        "sql_expression": "SUM(total_amount)",
        "base_table": "orders",
        "dimensions": [
            {
                "name": "region",
                "label": "Region",
                "column_ref": "region",
                "dimension_type": "category",
            }
        ],
    }
    client.post("/api/v1/metrics/", json=metric_payload, headers=headers)

    assistant_res = client.post(
        "/api/v1/assistant/query",
        json={"connection_id": connection_id, "question": "What is the total revenue by region?"},
        headers=headers,
    )
    assert assistant_res.status_code == status.HTTP_200_OK
    payload = assistant_res.json()
    assert payload["explanation"]["resolution_source"] == "semantic_metric"
    assert payload["explanation"]["metric_name"] == "total_revenue"
    assert "SUM(total_amount)" in payload["sql"]
    assert payload["success"] is True

    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)


def test_resolver_scores_and_builds_sql():
    metric = MetricDefinition(
        connection_id=1,
        user_id=1,
        name="total_revenue",
        label="Total Revenue",
        description="Revenue from orders",
        sql_expression="SUM(total_amount)",
        base_table="orders",
    )
    metric.set_dimensions(
        [
            {
                "name": "region",
                "label": "Region",
                "column_ref": "orders.region",
                "dimension_type": "category",
            }
        ]
    )
    graph = SchemaGraph.from_schema_metadata(
        [
            {"table_name": "orders", "column_name": "region", "data_type": "TEXT"},
            {"table_name": "orders", "column_name": "total_amount", "data_type": "REAL"},
        ]
    )

    resolved = resolve_metric_question(
        question="Show total revenue by region",
        metrics=[metric],
        graph=graph,
        db_type="sqlite",
        match_threshold=3.0,
    )
    assert resolved is not None
    assert "GROUP BY" in resolved.sql
    assert resolved.metric_name == "total_revenue"

    sql, assumptions = build_metric_sql(metric, metric.get_dimensions(), "sqlite", "total revenue by region")
    assert "SUM(total_amount)" in sql
    assert assumptions


def test_postgres_time_filter_uses_native_syntax():
    from app.core.semantics.resolver import _infer_time_filter

    dimensions = [
        {
            "name": "created_at",
            "label": "Created At",
            "column_ref": "orders.created_at",
            "dimension_type": "time",
        }
    ]
    result = _infer_time_filter("total revenue last month", dimensions, "postgresql")
    assert result is not None
    assert "date_trunc" in result
    assert "date('now'" not in result


def test_sqlite_time_filter_uses_sqlite_syntax():
    from app.core.semantics.resolver import _infer_time_filter

    dimensions = [
        {
            "name": "created_at",
            "label": "Created At",
            "column_ref": "orders.created_at",
            "dimension_type": "time",
        }
    ]
    result = _infer_time_filter("total revenue last month", dimensions, "sqlite")
    assert result is not None
    assert "date('now'" in result
    assert "date_trunc" not in result
