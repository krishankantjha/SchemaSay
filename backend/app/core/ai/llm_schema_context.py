"""Select a focused schema slice for LLM prompts."""

from __future__ import annotations

from typing import Iterable, List, Set

from app.core.ai.heuristic_compiler import HeuristicCompileResult
from app.core.schema.graph import SchemaGraph


def _resolve_tables(graph: SchemaGraph, names: Iterable[str]) -> Set[str]:
    resolved: Set[str] = set()
    for name in names:
        key = graph._resolve_table_key(name)
        if key:
            resolved.add(key)
    return resolved


def expand_related_tables(graph: SchemaGraph, seed_tables: Iterable[str]) -> Set[str]:
    """Include seed tables plus one-hop FK neighbors."""
    related = _resolve_tables(graph, seed_tables)
    if not related:
        return related

    for edge in graph.foreign_key_edges():
        from_key = graph._resolve_table_key(edge.from_table)
        to_key = graph._resolve_table_key(edge.to_table)
        if from_key in related and to_key:
            related.add(to_key)
        if to_key in related and from_key:
            related.add(from_key)
    return related


def select_schema_for_llm(
    schema_metadata: List[dict],
    graph: SchemaGraph,
    heuristic: HeuristicCompileResult,
    *,
    max_items: int = 200,
    fallback_table_limit: int = 15,
) -> tuple[List[dict], bool]:
    """
    Return schema rows relevant to the heuristic compile result.
    Falls back to the first N tables when no tables were matched.
    """
    if not schema_metadata:
        return [], False

    table_names = expand_related_tables(graph, heuristic.matched_tables)
    if not table_names:
        ordered_tables = sorted({entry["table_name"] for entry in schema_metadata})
        table_names = set(ordered_tables[:fallback_table_limit])

    filtered = [entry for entry in schema_metadata if entry["table_name"] in table_names]
    truncated = len(filtered) > max_items
    if truncated:
        filtered = filtered[:max_items]
    return filtered, truncated
