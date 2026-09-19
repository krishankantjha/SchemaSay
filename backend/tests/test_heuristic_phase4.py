import pytest

from app.core.ai.heuristic_compiler import compile_heuristic
from app.core.ai.heuristic_routing import RouteAction, decide_heuristic_route
from app.core.ai.heuristic_validation import (
    calibrate_confidence,
    extract_component_confidence,
    validate_heuristic_sql,
    validate_join_grounding,
    validate_semantic_intent,
)
from app.core.ai.query_generator import SqlGenerationResult, _is_heuristic_grounded, generate_sql
from app.core.schema.graph import SchemaGraph

SAMPLE_SCHEMA = [
    {"table_name": "orders", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "orders", "column_name": "user_id", "data_type": "INTEGER | FOREIGN KEY -> users.id"},
    {"table_name": "orders", "column_name": "price", "data_type": "FLOAT"},
    {"table_name": "orders", "column_name": "created_at", "data_type": "TIMESTAMP"},
    {"table_name": "users", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "users", "column_name": "name", "data_type": "TEXT"},
]

PRODUCT_SCHEMA = SAMPLE_SCHEMA + [
    {"table_name": "order_items", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "order_items", "column_name": "order_id", "data_type": "INTEGER | FOREIGN KEY -> orders.id"},
    {"table_name": "order_items", "column_name": "product_id", "data_type": "INTEGER | FOREIGN KEY -> products.id"},
    {"table_name": "products", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "products", "column_name": "name", "data_type": "TEXT"},
]


def test_route_l1_l2_execute():
    result = compile_heuristic("how many orders exist", "sqlite", SAMPLE_SCHEMA)
    route = decide_heuristic_route(result)
    assert route.action == RouteAction.HEURISTIC_EXECUTE


def test_route_l3_validate():
    result = compile_heuristic("total revenue by month for orders", "sqlite", SAMPLE_SCHEMA)
    route = decide_heuristic_route(result)
    assert route.action == RouteAction.HEURISTIC_VALIDATE


def test_route_l4_llm():
    result = compile_heuristic("compare Q1 vs Q2 revenue trends", "sqlite", SAMPLE_SCHEMA)
    route = decide_heuristic_route(result)
    assert route.action == RouteAction.LLM


def test_route_ambiguous_llm():
    schema = [
        {"table_name": "foo", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
        {"table_name": "bar", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    ]
    result = compile_heuristic("show foo and bar records", "sqlite", schema)
    route = decide_heuristic_route(result)
    assert route.action == RouteAction.LLM


def test_component_confidence_extracted():
    result = compile_heuristic("how many orders exist", "sqlite", SAMPLE_SCHEMA)
    component = extract_component_confidence(result)
    assert component.table >= 0.8
    assert component.aggregation >= 0.8


def test_calibrate_confidence_drops_when_ungrounded():
    result = compile_heuristic("how many orders exist", "sqlite", SAMPLE_SCHEMA)
    component = extract_component_confidence(result)
    high = calibrate_confidence(
        result, component, grounding_valid=True, join_valid=True, semantic_valid=True, safety_valid=True
    )
    low = calibrate_confidence(
        result, component, grounding_valid=False, join_valid=True, semantic_valid=True, safety_valid=True
    )
    assert high > low


def test_validate_heuristic_l2_passes():
    compiled = compile_heuristic("how many orders exist", "sqlite", SAMPLE_SCHEMA)
    graph = SchemaGraph.from_schema_metadata(SAMPLE_SCHEMA)
    validation = validate_heuristic_sql(
        sql=compiled.sql,
        db_type="sqlite",
        graph=graph,
        heuristic=compiled,
        require_semantic=False,
    )
    assert validation.safety_valid
    assert validation.grounding_valid
    assert validation.join_valid
    assert validation.can_execute


def test_validate_heuristic_l3_semantic():
    compiled = compile_heuristic("total revenue by month for orders", "sqlite", SAMPLE_SCHEMA)
    graph = SchemaGraph.from_schema_metadata(SAMPLE_SCHEMA)
    validation = validate_heuristic_sql(
        sql=compiled.sql,
        db_type="sqlite",
        graph=graph,
        heuristic=compiled,
        require_semantic=True,
    )
    assert validation.semantic_valid
    assert validation.can_execute


def test_validate_join_grounding_fk():
    graph = SchemaGraph.from_schema_metadata(SAMPLE_SCHEMA)
    sql = "SELECT orders.id, users.name FROM orders JOIN users ON orders.user_id = users.id"
    valid, issues = validate_join_grounding(sql, graph)
    assert valid is True
    assert not issues


def test_validate_join_rejects_bad_on():
    graph = SchemaGraph.from_schema_metadata(SAMPLE_SCHEMA)
    sql = "SELECT * FROM orders JOIN users ON orders.price = users.name"
    valid, issues = validate_join_grounding(sql, graph)
    assert valid is False
    assert issues


def test_semantic_detects_missing_count():
    compiled = compile_heuristic("how many orders exist", "sqlite", SAMPLE_SCHEMA)
    ok, issues = validate_semantic_intent("SELECT price FROM orders", compiled)
    assert ok is False
    assert any("missing_count" in i for i in issues)


def test_generate_sql_l2_routes_heuristic():
    from unittest.mock import patch

    with patch("app.core.ai.query_generator.list_llm_clients", return_value=[object()]), patch(
        "app.core.ai.query_generator.complete_chat_with_fallback",
    ) as mock_llm:
        result = generate_sql("how many orders exist", "sqlite", SAMPLE_SCHEMA)

    assert result.used_llm is False
    assert result.provider == "heuristic"
    assert result.routing_decision == RouteAction.HEURISTIC_EXECUTE.value
    assert result.validation_passed is True
    assert result.calibrated_confidence is not None
    assert result.component_confidence is not None
    mock_llm.assert_not_called()


def test_generate_sql_l3_validates_then_executes():
    from unittest.mock import patch

    with patch("app.core.ai.query_generator.list_llm_clients", return_value=[object()]), patch(
        "app.core.ai.query_generator.complete_chat_with_fallback",
    ) as mock_llm:
        result = generate_sql("total revenue by month for orders", "sqlite", SAMPLE_SCHEMA)

    assert result.used_llm is False
    assert result.provider == "heuristic"
    assert result.routing_decision == RouteAction.HEURISTIC_VALIDATE.value
    assert result.validation_passed is True
    mock_llm.assert_not_called()


def test_generate_sql_ungrounded_escalates_llm():
    from unittest.mock import patch
    from app.core.ai.llm_client import LLMCompletion

    completion = LLMCompletion(
        content="SELECT id FROM orders",
        prompt_tokens=1,
        completion_tokens=1,
        cost_usd=0.0,
        duration_ms=1.0,
        provider="openai",
        model="gpt-4o-mini",
    )
    with patch("app.core.ai.query_generator.list_llm_clients", return_value=[object()]), patch(
        "app.core.ai.query_generator.compile_heuristic",
    ) as mock_compile, patch(
        "app.core.ai.query_generator.complete_chat_with_fallback",
        return_value=completion,
    ) as mock_llm:
        from app.core.ai.heuristic_compiler import HeuristicCompileResult

        mock_compile.return_value = HeuristicCompileResult(
            sql="SELECT id FROM ghost_table",
            confidence=0.95,
            tier="L1",
            matched_tables=["ghost_table"],
            should_escalate=False,
            reasons=["explicit_table_name", "columns=explicit"],
            intent="listing",
        )
        result = generate_sql("show ghost records", "sqlite", SAMPLE_SCHEMA)

    assert result.used_llm is True
    mock_llm.assert_called_once()


def test_grounding_helper():
    graph = SchemaGraph.from_schema_metadata(SAMPLE_SCHEMA)
    assert _is_heuristic_grounded("SELECT id FROM orders", graph) is True
    assert _is_heuristic_grounded("SELECT id FROM missing", graph) is False


def test_explanation_includes_routing_metadata():
    from app.core.explanation.builder import build_query_explanation
    from app.core.grounding.validator import validate_sql_grounding

    graph = SchemaGraph.from_schema_metadata(SAMPLE_SCHEMA)
    sql = "SELECT COUNT(*) FROM orders"
    grounding = validate_sql_grounding(sql, graph)
    explanation = build_query_explanation(
        question="how many orders exist",
        sql=sql,
        graph=graph,
        grounding=grounding,
        confidence=88,
        used_llm=False,
        resolution_source="heuristic",
        heuristic_tier="L2",
        heuristic_intent="aggregation",
        routing_decision="heuristic_execute",
        validation_passed=True,
        calibrated_confidence=90,
        component_confidence={"table": 0.95, "column": 0.8, "join": 1.0, "aggregation": 0.92},
    )
    assert explanation["routing_decision"] == "heuristic_execute"
    assert explanation["heuristic_tier"] == "L2"
    assert explanation["component_confidence"]["table"] == 0.95
    assert explanation["calibrated_confidence"] == 90


def test_safety_blocks_mutating_sql():
    compiled = compile_heuristic("how many orders exist", "sqlite", SAMPLE_SCHEMA)
    graph = SchemaGraph.from_schema_metadata(SAMPLE_SCHEMA)
    validation = validate_heuristic_sql(
        sql="DELETE FROM orders",
        db_type="sqlite",
        graph=graph,
        heuristic=compiled,
    )
    assert validation.safety_valid is False
    assert validation.can_execute is False
