from __future__ import annotations

from app.core.grounding.validator import GroundingResult
from app.core.schema.graph import SchemaGraph


def compute_confidence_score(
    question: str,
    sql: str,
    graph: SchemaGraph,
    grounding: GroundingResult,
    used_llm: bool,
    semantic_metric: bool = False,
) -> int:
    """
    Heuristic confidence score (0-100) based on schema grounding and question overlap.
    """
    score = 0

    if grounding.valid:
        score += 40
    else:
        score -= 30

    if grounding.tables_referenced:
        score += 15

    question_lower = question.lower()
    sql_lower = sql.lower()

    matched_columns = 0
    for table_name, columns in graph.tables.items():
        if table_name.lower() in sql_lower:
            score += 5
        for col in columns:
            if col.name.lower() in question_lower and col.name.lower() in sql_lower:
                matched_columns += 1

    score += min(matched_columns * 5, 20)

    if len(grounding.tables_referenced) > 1 and graph.join_path(
        grounding.tables_referenced[0], grounding.tables_referenced[-1]
    ):
        score += 15

    if not used_llm and not semantic_metric:
        score = min(score, 65)

    if semantic_metric:
        score += 25

    return max(0, min(100, score))
