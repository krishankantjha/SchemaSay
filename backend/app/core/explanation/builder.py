from __future__ import annotations

from typing import List, Optional

import sqlglot
from sqlglot import exp

from app.core.explanation.quality import build_data_quality_warnings
from app.core.governance.pii import pii_warnings_for_sql
from app.core.grounding.validator import GroundingResult
from app.core.schema.graph import SchemaGraph


def _detect_joins(sql: str, graph: SchemaGraph, tables_used: List[str]) -> List[dict]:
    joins: List[dict] = []
    seen = set()

    try:
        expression = sqlglot.parse_one(sql)
    except Exception:
        expression = None

    if expression:
        for join in expression.find_all(exp.Join):
            on = join.args.get("on")
            if isinstance(on, exp.EQ):
                left = str(on.left)
                right = str(on.right)
                key = (left, right)
                if key not in seen:
                    seen.add(key)
                    joins.append({"from_column": left, "to_column": right})

    if not joins and len(tables_used) > 1:
        for index in range(len(tables_used) - 1):
            path = graph.join_path(tables_used[index], tables_used[index + 1])
            if path:
                for edge in path:
                    key = (f"{edge.from_table}.{edge.from_column}", f"{edge.to_table}.{edge.to_column}")
                    if key not in seen:
                        seen.add(key)
                        joins.append(
                            {
                                "from_column": key[0],
                                "to_column": key[1],
                            }
                        )
    return joins


def _detect_aggregations(sql: str) -> List[str]:
    assumptions: List[str] = []
    upper = sql.upper()
    if "COUNT(" in upper:
        assumptions.append("Used COUNT aggregation to answer a counting question.")
    if "SUM(" in upper:
        assumptions.append("Interpreted numeric totals using SUM aggregation.")
    if "AVG(" in upper:
        assumptions.append("Used AVG aggregation for average values.")
    if "GROUP BY" in upper:
        assumptions.append("Grouped results to compare categories or segments.")
    if "ORDER BY" in upper:
        assumptions.append("Sorted results to highlight ranking or chronology.")
    if "LIMIT" in upper or "TOP " in upper:
        assumptions.append("Limited row count to keep the result set concise.")
    return assumptions


def build_query_explanation(
    question: str,
    sql: str,
    graph: SchemaGraph,
    grounding: GroundingResult,
    confidence: int,
    used_llm: bool,
    resolution_source: Optional[str] = None,
    metric_id: Optional[int] = None,
    metric_name: Optional[str] = None,
    metric_label: Optional[str] = None,
    extra_assumptions: Optional[List[str]] = None,
    learning_examples_used: int = 0,
    llm_provider: Optional[str] = None,
    llm_model: Optional[str] = None,
) -> dict:
    tables_used = grounding.tables_referenced or [
        table for table in graph.tables if table.lower() in sql.lower()
    ]

    assumptions = _detect_aggregations(sql)
    if extra_assumptions:
        assumptions = extra_assumptions + assumptions
    elif resolution_source == "semantic_metric":
        assumptions.append("SQL was generated from a governed semantic metric definition.")
    elif resolution_source == "learning_example":
        assumptions.append("SQL was adapted from a verified historical example for this connection.")
    elif used_llm:
        assumptions.append("SQL was generated from your question using the synced schema.")
    else:
        assumptions.append("SQL was generated using built-in schema rules.")

    if learning_examples_used > 0:
        assumptions.append(
            f"Augmented generation with {learning_examples_used} verified example(s) from prior feedback."
        )

    joins = _detect_joins(sql, graph, tables_used)

    summary = question.strip()
    if tables_used:
        summary = f"Answered '{question.strip()}' using table(s): {', '.join(tables_used)}."

    warnings = list(grounding.warnings)
    warnings.extend(build_data_quality_warnings(sql, graph, tables_used))
    warnings.extend(pii_warnings_for_sql(sql, graph, tables_used))
    if confidence < 50:
        warnings.append("Low confidence score — review the generated SQL before relying on results.")
    if not grounding.valid:
        warnings.append("SQL references schema objects that are not present in the cached schema.")

    return {
        "summary": summary,
        "assumptions": assumptions,
        "tables_used": tables_used,
        "joins": joins,
        "confidence": confidence,
        "warnings": warnings,
        "grounded": grounding.valid,
        "unknown_tables": grounding.unknown_tables,
        "unknown_columns": grounding.unknown_columns,
        "resolution_source": resolution_source,
        "metric_id": metric_id,
        "metric_name": metric_name,
        "metric_label": metric_label,
        "learning_examples_used": learning_examples_used,
        "llm_provider": llm_provider,
        "llm_model": llm_model,
    }
