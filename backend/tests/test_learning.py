import os
import uuid

from fastapi import status
from sqlalchemy import create_engine, text

from app.core.learning.retrieval import find_similar_examples, _similarity
from app.core.learning.service import create_query_feedback
from app.models.learning import QueryFeedback


def _auth_headers(client):
    email = f"learning_user_{uuid.uuid4().hex}@example.com"
    password = "Password123!"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Learning Tester"},
    )
    token = client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_orders_db():
    temp_db_path = os.path.abspath(f"temp_learning_{uuid.uuid4().hex}.db")
    engine = create_engine(f"sqlite:///{temp_db_path}")
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE orders (
                    id INTEGER PRIMARY KEY,
                    region TEXT,
                    total_amount REAL
                )
                """
            )
        )
        conn.execute(text("INSERT INTO orders (region, total_amount) VALUES ('North', 100.0)"))
        conn.execute(text("INSERT INTO orders (region, total_amount) VALUES ('South', 200.0)"))
        conn.commit()
    engine.dispose()
    return temp_db_path


def test_similarity_and_retrieval_scoring():
    assert _similarity("total revenue by region", "show total revenue grouped by region") > 0.2
    assert _similarity("abc", "xyz") == 0.0


def test_feedback_create_and_examples_api(client, db):
    headers = _auth_headers(client)
    temp_db_path = _create_orders_db()

    create_conn = client.post(
        "/api/v1/connections/",
        json={"name": "Learning DB", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    connection_id = create_conn.json()["id"]

    feedback_res = client.post(
        "/api/v1/feedback/",
        json={
            "connection_id": connection_id,
            "question": "Show total revenue by region",
            "generated_sql": "SELECT region, SUM(total_amount) FROM orders GROUP BY region",
            "rating": "thumbs_up",
        },
        headers=headers,
    )
    assert feedback_res.status_code == status.HTTP_201_CREATED

    examples_res = client.get(
        f"/api/v1/feedback/examples?connection_id={connection_id}&question=total revenue by region",
        headers=headers,
    )
    assert examples_res.status_code == status.HTTP_200_OK
    examples = examples_res.json()["examples"]
    assert len(examples) == 1
    assert "SUM(total_amount)" in examples[0]["sql"]

    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)


def test_learning_example_used_in_assistant_query(client, db, monkeypatch):
    headers = _auth_headers(client)
    temp_db_path = _create_orders_db()

    create_conn = client.post(
        "/api/v1/connections/",
        json={"name": "Learning Assistant DB", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    connection_id = create_conn.json()["id"]

    client.post(
        "/api/v1/feedback/",
        json={
            "connection_id": connection_id,
            "question": "Show total revenue by region",
            "corrected_sql": "SELECT region, SUM(total_amount) AS total_revenue FROM orders GROUP BY region",
            "rating": "corrected",
        },
        headers=headers,
    )

    monkeypatch.setattr(
        "app.core.pipeline.orchestrator.settings.LEARNING_DIRECT_MATCH_THRESHOLD",
        0.5,
    )

    assistant_res = client.post(
        "/api/v1/assistant/query",
        json={
            "connection_id": connection_id,
            "question": "Show total revenue grouped by region",
        },
        headers=headers,
    )
    assert assistant_res.status_code == status.HTTP_200_OK
    payload = assistant_res.json()
    assert payload["explanation"]["resolution_source"] == "learning_example"
    assert "SUM(total_amount)" in payload["sql"]

    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)


def test_corrected_sql_must_pass_safety_validation(client, db):
    headers = _auth_headers(client)
    temp_db_path = _create_orders_db()

    create_conn = client.post(
        "/api/v1/connections/",
        json={"name": "Unsafe Feedback DB", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    connection_id = create_conn.json()["id"]

    bad_feedback = client.post(
        "/api/v1/feedback/",
        json={
            "connection_id": connection_id,
            "question": "delete everything",
            "corrected_sql": "DROP TABLE orders",
            "rating": "corrected",
        },
        headers=headers,
    )
    assert bad_feedback.status_code == status.HTTP_400_BAD_REQUEST

    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)
