import pytest

from app.core.ai.heuristic_compiler import HEURISTIC_CONFIDENCE_HIGH, compile_heuristic

SAMPLE_SCHEMA = [
    {"table_name": "orders", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "orders", "column_name": "user_id", "data_type": "INTEGER | FOREIGN KEY -> users.id"},
    {"table_name": "orders", "column_name": "price", "data_type": "FLOAT"},
    {"table_name": "orders", "column_name": "quantity", "data_type": "INTEGER"},
    {"table_name": "orders", "column_name": "status", "data_type": "TEXT"},
    {"table_name": "orders", "column_name": "created_at", "data_type": "TIMESTAMP"},
    {"table_name": "orders", "column_name": "notes", "data_type": "TEXT"},
    {"table_name": "users", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "users", "column_name": "name", "data_type": "TEXT"},
    {"table_name": "users", "column_name": "email", "data_type": "TEXT"},
]

PRODUCT_SCHEMA = SAMPLE_SCHEMA + [
    {"table_name": "order_items", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "order_items", "column_name": "order_id", "data_type": "INTEGER | FOREIGN KEY -> orders.id"},
    {"table_name": "order_items", "column_name": "product_id", "data_type": "INTEGER | FOREIGN KEY -> products.id"},
    {"table_name": "order_items", "column_name": "price", "data_type": "FLOAT"},
    {"table_name": "order_items", "column_name": "quantity", "data_type": "INTEGER"},
    {"table_name": "products", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "products", "column_name": "name", "data_type": "TEXT"},
    {"table_name": "products", "column_name": "category", "data_type": "TEXT"},
]


# --- Advanced aggregations ---


def test_min_aggregation():
    result = compile_heuristic("minimum price for orders", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "MIN(price)" in result.sql


def test_max_aggregation():
    result = compile_heuristic("maximum price for orders", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "MAX(price)" in result.sql


def test_count_distinct_users():
    result = compile_heuristic("count distinct user_id for orders", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "COUNT(DISTINCT user_id)" in result.sql


def test_percentage_active_orders():
    result = compile_heuristic("percentage of active orders", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "CASE WHEN" in result.sql
    assert "100.0" in result.sql


# --- Advanced filters ---


def test_filter_greater_than():
    result = compile_heuristic("orders where price greater than 100", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "WHERE" in result.sql
    assert "price > 100" in result.sql


def test_filter_less_than():
    result = compile_heuristic("orders with price less than 50", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "price < 50" in result.sql


def test_filter_between():
    result = compile_heuristic("orders where price between 10 and 50", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "price BETWEEN 10 AND 50" in result.sql


def test_filter_in_list():
    result = compile_heuristic("orders where status in (active, pending)", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "status IN" in result.sql
    assert "'active'" in result.sql


def test_filter_is_null():
    result = compile_heuristic("orders where notes is null", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "notes IS NULL" in result.sql


def test_filter_like_contains():
    result = compile_heuristic("orders where notes contains urgent", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "notes LIKE" in result.sql


def test_filter_or_status():
    result = compile_heuristic("active or pending orders", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert " OR " in result.sql


# --- Date intelligence ---


def test_date_today():
    result = compile_heuristic("orders from today", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "WHERE" in result.sql
    assert "created_at" in result.sql


def test_date_last_month():
    result = compile_heuristic("orders from last month", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "WHERE" in result.sql
    assert "created_at" in result.sql


def test_date_between():
    result = compile_heuristic("orders between 2024-01-01 and 2024-12-31", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "BETWEEN '2024-01-01' AND '2024-12-31'" in result.sql


def test_date_this_year():
    result = compile_heuristic("orders this year", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "WHERE" in result.sql


# --- Multi-column GROUP BY ---


def test_group_by_two_columns():
    result = compile_heuristic("count orders by status and user_id", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "GROUP BY" in result.sql
    assert "status" in result.sql
    assert "user_id" in result.sql


def test_group_by_month_and_category():
    schema = [e for e in PRODUCT_SCHEMA if e["table_name"] == "products"]
    schema += [e for e in SAMPLE_SCHEMA if e["table_name"] == "orders"]
    result = compile_heuristic("total revenue by month and category for products", "sqlite", schema)
    assert result.sql is not None
    assert "GROUP BY" in result.sql


# --- HAVING ---


def test_having_count_greater_than():
    result = compile_heuristic("count orders by status having more than 5", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "GROUP BY" in result.sql
    assert "HAVING" in result.sql
    assert "COUNT(*) > 5" in result.sql


def test_having_explicit():
    result = compile_heuristic("count orders by status having count > 10", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "HAVING" in result.sql


# --- Ranking / Top-N ---


def test_top_n_by_revenue():
    result = compile_heuristic("top 5 orders by revenue", "sqlite", SAMPLE_SCHEMA)
    assert result.sql is not None
    assert "ORDER BY" in result.sql
    assert "SUM(price)" in result.sql or "price" in result.sql
    assert "LIMIT 5" in result.sql


def test_top_products_by_revenue_grouped():
    result = compile_heuristic("top 5 products by revenue", "sqlite", PRODUCT_SCHEMA)
    assert result.sql is not None
    assert "products" in result.sql
    assert "ORDER BY" in result.sql
    assert "LIMIT 5" in result.sql


# --- Full composition ---


def test_full_composition_join_where_group_having_order_limit():
    result = compile_heuristic(
        "total revenue by status for orders in the last 30 days with more than 2",
        "sqlite",
        SAMPLE_SCHEMA,
    )
    assert result.sql is not None
    assert "SELECT" in result.sql
    assert "FROM orders" in result.sql
    assert "WHERE" in result.sql
    assert "GROUP BY" in result.sql
    assert "HAVING" in result.sql


def test_composition_where_and_group_by_month():
    result = compile_heuristic(
        "total revenue by month for active orders where price > 100",
        "sqlite",
        SAMPLE_SCHEMA,
    )
    assert result.sql is not None
    assert "WHERE" in result.sql
    assert "price > 100" in result.sql
    assert "GROUP BY" in result.sql
    assert "SUM" in result.sql
    assert result.confidence >= HEURISTIC_CONFIDENCE_HIGH


def test_tier_l3_for_complex_query():
    result = compile_heuristic(
        "count orders by status where price greater than 50",
        "sqlite",
        SAMPLE_SCHEMA,
    )
    assert result.tier == "L3"
