import pytest

from app.core.ai.heuristic_aliases import AliasContext
from app.core.ai.heuristic_compiler import compile_heuristic
from app.core.ai.heuristic_intent import QueryIntent, detect_intent
from app.core.ai.heuristic_resolution import score_tables
from app.core.schema.graph import SchemaGraph

SAMPLE_SCHEMA = [
    {"table_name": "orders", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "orders", "column_name": "user_id", "data_type": "INTEGER | FOREIGN KEY -> users.id"},
    {"table_name": "orders", "column_name": "price", "data_type": "FLOAT"},
    {"table_name": "orders", "column_name": "created_at", "data_type": "TIMESTAMP"},
    {"table_name": "users", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "users", "column_name": "name", "data_type": "TEXT"},
    {"table_name": "users", "column_name": "email", "data_type": "TEXT"},
]

THREE_TABLE_SCHEMA = SAMPLE_SCHEMA + [
    {"table_name": "order_items", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "order_items", "column_name": "order_id", "data_type": "INTEGER | FOREIGN KEY -> orders.id"},
    {"table_name": "order_items", "column_name": "product_id", "data_type": "INTEGER | FOREIGN KEY -> products.id"},
    {"table_name": "products", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "products", "column_name": "name", "data_type": "TEXT"},
]


def _tables_columns(schema):
    tables = {}
    for entry in schema:
        tables.setdefault(entry["table_name"], []).append(entry["column_name"])
    return tables


def test_detect_intent_aggregation():
    result = detect_intent("how many orders exist")
    assert result.primary == QueryIntent.AGGREGATION
    assert result.aggregation == "count"


def test_detect_intent_ranking():
    result = detect_intent("show top 10 orders by revenue")
    assert result.primary in (QueryIntent.RANKING, QueryIntent.AGGREGATION, QueryIntent.GROUPING)


def test_detect_intent_filtering():
    result = detect_intent("orders in the last 30 days")
    assert QueryIntent.FILTERING in (result.primary,) or "filtering" in result.signals


def test_hub_table_prefers_orders_for_three_table_list():
    result = compile_heuristic("list orders order_items and products", "sqlite", THREE_TABLE_SCHEMA)
    assert result.sql is not None
    assert result.sql.startswith("SELECT") and "FROM orders" in result.sql


def test_per_connection_table_alias():
    ctx = AliasContext.global_defaults()
    ctx.table_aliases["buyer"] = "users"
    result = compile_heuristic("how many buyers exist", "sqlite", SAMPLE_SCHEMA, alias_context=ctx)
    assert result.sql is not None
    assert "FROM users" in result.sql
    assert "COUNT(*)" in result.sql


def test_per_connection_column_alias():
    ctx = AliasContext.global_defaults()
    ctx.column_aliases["income"] = "price"
    schema = [e for e in SAMPLE_SCHEMA if e["table_name"] == "orders"]
    result = compile_heuristic("total income for orders", "sqlite", schema, alias_context=ctx)
    assert result.sql is not None
    assert "SUM(price)" in result.sql


def test_column_alias_matches_spaced_phrase_in_question():
    ctx = AliasContext.global_defaults()
    ctx.column_aliases["created_date"] = "created_at"
    schema = [e for e in SAMPLE_SCHEMA if e["table_name"] == "orders"]
    result = compile_heuristic("total revenue by created date", "sqlite", schema, alias_context=ctx)
    assert result.sql is not None
    assert "created_at" in result.sql


def test_fuzzy_token_matches_table():
    graph = SchemaGraph.from_schema_metadata(SAMPLE_SCHEMA)
    tables = _tables_columns(SAMPLE_SCHEMA)
    resolution = score_tables("show ordes", tables, graph, AliasContext.global_defaults())
    assert resolution.primary == "orders"


def test_compile_includes_intent_metadata():
    result = compile_heuristic("how many orders exist", "sqlite", SAMPLE_SCHEMA)
    assert result.intent == QueryIntent.AGGREGATION.value


def test_ambiguous_tables_escalate():
    schema = [
        {"table_name": "foo", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
        {"table_name": "bar", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    ]
    result = compile_heuristic("show foo and bar records", "sqlite", schema)
    assert result.should_escalate is True
    assert result.sql is None
