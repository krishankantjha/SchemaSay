from app.core.ai.heuristic_compiler import compile_heuristic
from app.core.ai.llm_schema_context import select_schema_for_llm
from app.core.schema.graph import SchemaGraph
from app.core.schema.memory_cache import SchemaMemoryCache
from tests.fixtures.eval_schema_metadata import EVAL_SCHEMA_METADATA


def test_schema_memory_cache_expires(monkeypatch):
    cache = SchemaMemoryCache(ttl_seconds=0.01)
    graph = SchemaGraph.from_schema_metadata(EVAL_SCHEMA_METADATA)
    cache.set(1, EVAL_SCHEMA_METADATA, graph)

    assert cache.get(1) is not None
    import time

    time.sleep(0.02)
    assert cache.get(1) is None


def test_schema_memory_cache_invalidate():
    cache = SchemaMemoryCache(ttl_seconds=60)
    graph = SchemaGraph.from_schema_metadata(EVAL_SCHEMA_METADATA)
    cache.set(2, EVAL_SCHEMA_METADATA, graph)
    cache.invalidate(2)
    assert cache.get(2) is None


def test_select_schema_for_llm_uses_matched_tables():
    graph = SchemaGraph.from_schema_metadata(EVAL_SCHEMA_METADATA)
    heuristic = compile_heuristic(
        "how many orders exist",
        "sqlite",
        EVAL_SCHEMA_METADATA,
    )
    subset, truncated = select_schema_for_llm(
        EVAL_SCHEMA_METADATA,
        graph,
        heuristic,
        max_items=200,
    )
    table_names = {entry["table_name"] for entry in subset}
    assert "orders" in table_names
    assert "users" in table_names or "order_items" in table_names
    assert not truncated
    assert len(subset) < len(EVAL_SCHEMA_METADATA)
