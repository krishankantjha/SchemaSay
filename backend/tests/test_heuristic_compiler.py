import pytest

from app.core.ai.heuristic_compiler import (
    HEURISTIC_CONFIDENCE_HIGH,
    compile_heuristic,
    heuristic_offline_compiler,
)
from app.core.ai.query_generator import generate_sql

SAMPLE_SCHEMA = [
    {"table_name": "orders", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "orders", "column_name": "user_id", "data_type": "INTEGER | FOREIGN KEY -> users.id"},
    {"table_name": "orders", "column_name": "price", "data_type": "FLOAT"},
    {"table_name": "orders", "column_name": "status", "data_type": "TEXT"},
    {"table_name": "orders", "column_name": "created_at", "data_type": "TIMESTAMP"},
    {"table_name": "users", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "users", "column_name": "name", "data_type": "TEXT"},
]

THREE_TABLE_SCHEMA = SAMPLE_SCHEMA + [
    {"table_name": "order_items", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "order_items", "column_name": "order_id", "data_type": "INTEGER | FOREIGN KEY -> orders.id"},
    {"table_name": "order_items", "column_name": "product_id", "data_type": "INTEGER | FOREIGN KEY -> products.id"},
    {"table_name": "products", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "products", "column_name": "name", "data_type": "TEXT"},
]


def test_heuristic_offline_compiler_rules():
    schema = SAMPLE_SCHEMA

    sql_limit = heuristic_offline_compiler("show top 5 orders", "sqlite", schema)
    assert "LIMIT 5" in sql_limit
    assert "FROM orders" in sql_limit

    sql_cols = heuristic_offline_compiler("get price from orders", "sqlite", schema)
    assert "SELECT price FROM orders" in sql_cols

    sql_count = heuristic_offline_compiler("how many orders exist", "sqlite", schema)
    assert "SELECT COUNT(*) FROM orders" in sql_count

    sql_sum = heuristic_offline_compiler("total price amount for orders", "sqlite", schema)
    assert "SELECT SUM(price) FROM orders" in sql_sum

    sql_chrono = heuristic_offline_compiler("get latest orders", "sqlite", schema)
    assert "ORDER BY created_at DESC" in sql_chrono

    sql_join = heuristic_offline_compiler("list orders and users", "sqlite", schema)
    assert "orders" in sql_join and "users" in sql_join and "JOIN" in sql_join

    sql_mssql = heuristic_offline_compiler("show top 5 orders", "mssql", schema)
    assert "SELECT TOP 5" in sql_mssql
    assert "LIMIT" not in sql_mssql


def test_no_silent_default_table_without_match():
    result = compile_heuristic("show me everything", "sqlite", SAMPLE_SCHEMA)
    assert result.should_escalate is True
    assert result.sql is None


def test_l4_question_escalates():
    result = compile_heuristic("compare Q1 vs Q2 revenue trends", "sqlite", SAMPLE_SCHEMA)
    assert result.should_escalate is True
    assert result.tier == "L4"
    assert result.sql is None


def test_high_confidence_for_count_with_explicit_table():
    result = compile_heuristic("how many orders exist", "sqlite", SAMPLE_SCHEMA)
    assert result.confidence >= HEURISTIC_CONFIDENCE_HIGH
    assert result.should_escalate is False
    assert "COUNT(*)" in result.sql


def test_where_last_n_days():
    result = compile_heuristic("orders in the last 30 days", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "WHERE" in result.sql
    assert "created_at" in result.sql
    assert "30" in result.sql


def test_group_by_month():
    result = compile_heuristic("total revenue by month for orders", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "GROUP BY" in result.sql
    assert "SUM" in result.sql
    assert "strftime" in result.sql


def test_avg_aggregation():
    result = compile_heuristic("average price for orders", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "AVG(price)" in result.sql


def test_generate_sql_uses_heuristic_for_simple_count():
    from unittest.mock import patch

    schema = [{"table_name": "orders", "column_name": "id", "data_type": "INTEGER"}]
    with patch("app.core.ai.query_generator.list_llm_clients", return_value=[object()]), patch(
        "app.core.ai.query_generator.complete_chat_with_fallback",
    ) as mock_llm:
        result = generate_sql("how many orders exist", "sqlite", schema)

    assert result.used_llm is False
    assert result.provider == "heuristic"
    assert "COUNT(*)" in result.sql
    mock_llm.assert_not_called()


def test_generate_sql_uses_llm_for_l4_question():
    from unittest.mock import patch
    from app.core.ai.llm_client import LLMCompletion

    schema = [{"table_name": "orders", "column_name": "price", "data_type": "FLOAT"}]
    completion = LLMCompletion(
        content="SELECT SUM(price) FROM orders",
        prompt_tokens=10,
        completion_tokens=5,
        cost_usd=0.0,
        duration_ms=12.0,
        provider="gemini",
        model="gemini-3.6-flash",
    )
    with patch("app.core.ai.query_generator.list_llm_clients", return_value=[object()]), patch(
        "app.core.ai.query_generator.complete_chat_with_fallback",
        return_value=completion,
    ) as mock_llm:
        result = generate_sql("compare Q1 vs Q2 revenue trends for orders", "sqlite", schema)

    assert result.used_llm is True
    assert result.provider == "gemini"
    mock_llm.assert_called_once()


def test_table_alias_customers_maps_to_users():
    result = compile_heuristic("how many customers exist", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "FROM users" in result.sql
    assert "COUNT(*)" in result.sql
    assert result.confidence >= HEURISTIC_CONFIDENCE_HIGH


def test_column_alias_revenue_maps_to_price():
    result = compile_heuristic("total revenue for orders", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "SUM(price)" in result.sql


def test_three_table_fk_join_path():
    result = compile_heuristic("list orders order_items and products", "sqlite", THREE_TABLE_SCHEMA)
    assert result.sql is not None
    assert "orders" in result.sql
    assert "order_items" in result.sql
    assert "products" in result.sql
    assert result.sql.count("JOIN") >= 2


def test_grounding_gate_escalates_to_llm_when_not_grounded():
    from unittest.mock import patch
    from app.core.ai.query_generator import _is_heuristic_grounded, generate_sql
    from app.core.schema.graph import SchemaGraph

    schema = [{"table_name": "orders", "column_name": "id", "data_type": "INTEGER"}]
    graph = SchemaGraph.from_schema_metadata(schema)
    assert _is_heuristic_grounded("SELECT id FROM orders", graph) is True
    assert _is_heuristic_grounded("SELECT id FROM missing_table", graph) is False

    with patch("app.core.ai.query_generator.list_llm_clients", return_value=[object()]), patch(
        "app.core.ai.query_generator.compile_heuristic",
    ) as mock_compile, patch(
        "app.core.ai.query_generator.complete_chat_with_fallback",
    ) as mock_llm:
        from app.core.ai.heuristic_compiler import HeuristicCompileResult

        mock_compile.return_value = HeuristicCompileResult(
            sql="SELECT id FROM ghost_table",
            confidence=0.95,
            tier="L1",
            matched_tables=["ghost_table"],
            should_escalate=False,
            reasons=["test"],
        )
        from app.core.ai.llm_client import LLMCompletion

        mock_llm.return_value = LLMCompletion(
            content="SELECT id FROM orders",
            prompt_tokens=1,
            completion_tokens=1,
            cost_usd=0.0,
            duration_ms=1.0,
            provider="openai",
            model="gpt-4o-mini",
        )
        result = generate_sql("show orders", "sqlite", schema)

    assert result.used_llm is True
    mock_llm.assert_called_once()


def test_generate_sql_top_n_skips_llm():
    from unittest.mock import patch

    with patch("app.core.ai.query_generator.list_llm_clients", return_value=[object()]), patch(
        "app.core.ai.query_generator.complete_chat_with_fallback",
    ) as mock_llm:
        result = generate_sql("show top 5 orders", "sqlite", SAMPLE_SCHEMA)

    assert result.used_llm is False
    assert result.provider == "heuristic"
    assert "LIMIT 5" in result.sql
    mock_llm.assert_not_called()
