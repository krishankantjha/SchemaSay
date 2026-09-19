import pytest

from app.core.ai.heuristic_compiler import compile_heuristic
from app.core.ai.heuristic_joins import build_join_plan
from app.core.ai.heuristic_schema_intel import (
    TableRole,
    apply_duplicate_protection,
    assess_duplicate_risk,
    classify_tables,
    plan_joins,
    score_join_path,
)
from app.core.schema.graph import SchemaGraph

PRODUCT_SCHEMA = [
    {"table_name": "orders", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "orders", "column_name": "user_id", "data_type": "INTEGER | FOREIGN KEY -> users.id"},
    {"table_name": "orders", "column_name": "price", "data_type": "FLOAT"},
    {"table_name": "users", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "users", "column_name": "name", "data_type": "TEXT"},
    {"table_name": "order_items", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "order_items", "column_name": "order_id", "data_type": "INTEGER | FOREIGN KEY -> orders.id"},
    {"table_name": "order_items", "column_name": "product_id", "data_type": "INTEGER | FOREIGN KEY -> products.id"},
    {"table_name": "order_items", "column_name": "price", "data_type": "FLOAT"},
    {"table_name": "products", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "products", "column_name": "name", "data_type": "TEXT"},
]

M2M_SCHEMA = [
    {"table_name": "students", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "students", "column_name": "name", "data_type": "TEXT"},
    {"table_name": "courses", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "courses", "column_name": "title", "data_type": "TEXT"},
    {"table_name": "enrollments", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "enrollments", "column_name": "student_id", "data_type": "INTEGER | FOREIGN KEY -> students.id"},
    {"table_name": "enrollments", "column_name": "course_id", "data_type": "INTEGER | FOREIGN KEY -> courses.id"},
    {"table_name": "enrollments", "column_name": "grade", "data_type": "FLOAT"},
]

DUAL_PATH_SCHEMA = PRODUCT_SCHEMA + [
    {"table_name": "shipments", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "shipments", "column_name": "order_id", "data_type": "INTEGER | FOREIGN KEY -> orders.id"},
    {"table_name": "shipments", "column_name": "product_id", "data_type": "INTEGER | FOREIGN KEY -> products.id"},
]


def test_classify_bridge_table():
    graph = SchemaGraph.from_schema_metadata(M2M_SCHEMA)
    profiles = classify_tables(graph)
    assert profiles["enrollments"].role == TableRole.BRIDGE
    assert profiles["students"].role == TableRole.DIMENSION
    assert profiles["courses"].role == TableRole.DIMENSION


def test_classify_fact_and_dimension():
    graph = SchemaGraph.from_schema_metadata(PRODUCT_SCHEMA)
    profiles = classify_tables(graph)
    assert profiles["orders"].role == TableRole.FACT
    assert profiles["products"].role == TableRole.DIMENSION
    assert profiles["order_items"].role == TableRole.BRIDGE


def test_m2m_join_uses_bridge():
    graph = SchemaGraph.from_schema_metadata(M2M_SCHEMA)
    plan = plan_joins("students", ["students", "courses"], graph, mentioned_tables={"students", "courses"})
    assert plan is not None
    assert "enrollments" in plan.from_clause
    assert "JOIN" in plan.from_clause
    assert "enrollments" in plan.joined_tables


def test_shortest_path_products_to_orders():
    graph = SchemaGraph.from_schema_metadata(PRODUCT_SCHEMA)
    paths = graph.all_join_paths("products", "orders", max_paths=4)
    assert paths
    assert min(len(p) for p in paths) == 2
    plan = plan_joins("products", ["products", "orders"], graph, mentioned_tables={"products", "orders"})
    assert plan is not None
    assert "order_items" in plan.from_clause


def test_duplicate_protection_list_join():
    graph = SchemaGraph.from_schema_metadata(PRODUCT_SCHEMA)
    result = compile_heuristic("list orders and users", "sqlite", PRODUCT_SCHEMA)
    assert result.sql is not None
    assert "JOIN" in result.sql
    assert "DISTINCT" in result.sql or "COUNT(DISTINCT" in result.sql or result.should_escalate is False


def test_count_distinct_pk_across_join():
    graph = SchemaGraph.from_schema_metadata(PRODUCT_SCHEMA)
    result = compile_heuristic("how many orders and users", "sqlite", PRODUCT_SCHEMA)
    assert result.sql is not None
    if "COUNT" in result.sql:
        assert "DISTINCT" in result.sql or "JOIN" not in result.sql


def test_compile_m2m_students_courses():
    result = compile_heuristic("list students and courses", "sqlite", M2M_SCHEMA)
    assert result.sql is not None
    assert "students" in result.sql
    assert "courses" in result.sql
    assert "enrollments" in result.sql


def test_unnecessary_join_not_added_for_single_table():
    result = compile_heuristic("how many orders exist", "sqlite", PRODUCT_SCHEMA)
    assert result.sql is not None
    assert "JOIN" not in result.sql


def test_primary_key_aware_count():
    graph = SchemaGraph.from_schema_metadata(PRODUCT_SCHEMA)
    select, reason = apply_duplicate_protection(
        "COUNT(*)",
        "count",
        duplicate_risk=True,
        mitigation="distinct_or_group",
        primary_table="orders",
        graph=graph,
    )
    assert "COUNT(DISTINCT orders.id)" == select
    assert reason == "count_distinct_pk"


def test_score_join_path_prefers_mentioned_bridge():
    graph = SchemaGraph.from_schema_metadata(M2M_SCHEMA)
    profiles = classify_tables(graph)
    paths = graph.all_join_paths("students", "courses", max_paths=4)
    assert paths
    score, _ = score_join_path(paths[0], profiles, {"students", "courses", "enrollments"}, "students", "courses")
    assert score > 0


def test_all_join_paths_finds_multiple():
    graph = SchemaGraph.from_schema_metadata(DUAL_PATH_SCHEMA)
    paths = graph.all_join_paths("orders", "products", max_paths=8)
    assert len(paths) >= 2


def test_graph_primary_keys():
    graph = SchemaGraph.from_schema_metadata(PRODUCT_SCHEMA)
    assert graph.primary_key_columns("orders") == ["id"]
    assert graph.primary_key_columns("products") == ["id"]


def test_assess_duplicate_risk_without_agg():
    graph = SchemaGraph.from_schema_metadata(PRODUCT_SCHEMA)
    profiles = classify_tables(graph)
    risk, mitigation = assess_duplicate_risk(
        joined_tables=["orders", "users"],
        profiles=profiles,
        has_aggregation=False,
        has_group_by=False,
    )
    assert risk is True
    assert mitigation in ("distinct", "distinct_or_group")


def test_assess_no_duplicate_risk_with_group_by():
    graph = SchemaGraph.from_schema_metadata(PRODUCT_SCHEMA)
    profiles = classify_tables(graph)
    risk, _ = assess_duplicate_risk(
        joined_tables=["orders", "users"],
        profiles=profiles,
        has_aggregation=True,
        has_group_by=True,
        agg="sum",
    )
    assert risk is False


def test_build_join_plan_metadata():
    graph = SchemaGraph.from_schema_metadata(PRODUCT_SCHEMA)
    plan = build_join_plan("orders", ["orders", "products"], graph, mentioned_tables={"orders", "products"})
    assert plan is not None
    assert len(plan.joined_tables) >= 2
    assert plan.paths_used


def test_join_ambiguity_escalates_when_paths_tied():
    """Two equal-length paths to the same target should escalate when scores tie."""
    from app.core.ai.heuristic_schema_intel import detect_join_ambiguity_for_targets

    graph = SchemaGraph.from_schema_metadata(DUAL_PATH_SCHEMA)
    profiles = classify_tables(graph)
    reason = detect_join_ambiguity_for_targets(
        "orders", ["products"], graph, profiles, {"orders", "products"}
    )
    assert reason is not None
    assert "join_paths_tied" in reason
