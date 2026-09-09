import os
import uuid

from sqlalchemy import create_engine, text

from app.core.schema.introspector import reflect_database_schema
from app.core.schema.profiler import profile_schema_metadata
from app.core.schema.graph import SchemaGraph
from app.core.explanation.quality import build_data_quality_warnings
from app.core.explanation.builder import build_query_explanation
from app.core.grounding.validator import validate_sql_grounding


def test_profile_schema_metadata_collects_null_ratio_and_row_count():
    temp_db_path = os.path.abspath(f"temp_profile_{uuid.uuid4().hex}.db")
    engine = create_engine(f"sqlite:///{temp_db_path}")
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE orders (
                    id INTEGER PRIMARY KEY,
                    amount REAL,
                    note TEXT
                )
                """
            )
        )
        conn.execute(text("INSERT INTO orders (amount, note) VALUES (10.5, 'paid')"))
        conn.execute(text("INSERT INTO orders (amount, note) VALUES (20.0, NULL)"))
        conn.execute(text("INSERT INTO orders (amount, note) VALUES (NULL, NULL)"))
        conn.commit()
    engine.dispose()

    engine = create_engine(f"sqlite:///{temp_db_path}")
    metadata = reflect_database_schema(engine)
    enriched, table_stats = profile_schema_metadata(engine, metadata, max_tables=5, sample_rows=100)

    amount = next(item for item in enriched if item["column_name"] == "amount")
    note = next(item for item in enriched if item["column_name"] == "note")

    assert table_stats[0]["table_name"] == "orders"
    assert table_stats[0]["row_count"] == 3
    assert amount["null_ratio"] is not None
    assert note["null_ratio"] is not None
    assert note["null_ratio"] > amount["null_ratio"]
    assert note["distinct_count"] == 1

    engine.dispose()
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)


def test_quality_warnings_surface_high_null_columns():
    metadata = [
        {
            "table_name": "orders",
            "column_name": "note",
            "data_type": "TEXT",
            "null_ratio": 0.67,
        },
        {
            "table_name": "orders",
            "column_name": "amount",
            "data_type": "REAL",
            "null_ratio": 0.0,
        },
    ]
    graph = SchemaGraph.from_schema_metadata(
        metadata,
        table_stats=[{"table_name": "orders", "row_count": 3}],
    )
    sql = "SELECT note, amount FROM orders"
    grounding = validate_sql_grounding(sql, graph)
    explanation = build_query_explanation(
        question="show order notes",
        sql=sql,
        graph=graph,
        grounding=grounding,
        confidence=80,
        used_llm=False,
    )

    assert any("note" in warning and "null" in warning.lower() for warning in explanation["warnings"])


def test_sync_with_profile_persists_stats(client):
    import uuid
    from fastapi import status

    email = f"profiler_user_{uuid.uuid4().hex}@example.com"
    password = "Password123!"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Profiler Tester"},
    )
    token = client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    temp_db_path = os.path.abspath(f"temp_sync_profile_{uuid.uuid4().hex}.db")
    engine = create_engine(f"sqlite:///{temp_db_path}")
    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE items (id INTEGER PRIMARY KEY, label TEXT)"))
        conn.execute(text("INSERT INTO items (label) VALUES ('alpha')"))
        conn.execute(text("INSERT INTO items (label) VALUES (NULL)"))
        conn.commit()
    engine.dispose()

    create_res = client.post(
        "/api/v1/connections/",
        json={"name": "Profile Sync DB", "db_type": "sqlite", "database_name": temp_db_path},
        headers=headers,
    )
    connection_id = create_res.json()["id"]

    sync_res = client.post(
        f"/api/v1/schema/{connection_id}/sync?profile=true",
        headers=headers,
    )
    assert sync_res.status_code == status.HTTP_200_OK
    assert sync_res.json()["profiled_tables"] == 1

    tree_res = client.get(f"/api/v1/schema/{connection_id}/tree", headers=headers)
    assert tree_res.status_code == status.HTTP_200_OK
    table = tree_res.json()["tables"][0]
    assert table["row_count"] == 2
    label_col = next(col for col in table["columns"] if col["name"] == "label")
    assert label_col["null_ratio"] is not None
    assert label_col["null_ratio"] > 0

    client.delete(f"/api/v1/connections/{connection_id}", headers=headers)
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)
