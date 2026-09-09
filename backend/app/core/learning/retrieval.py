from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.models.learning import QueryFeedback


@dataclass
class VerifiedExample:
    question: str
    sql: str
    similarity: float
    source: str


def _tokenize(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9_]+", text.lower()) if len(token) > 1}


def _similarity(left: str, right: str) -> float:
    left_tokens = _tokenize(left)
    right_tokens = _tokenize(right)
    if not left_tokens or not right_tokens:
        return 0.0
    intersection = left_tokens.intersection(right_tokens)
    union = left_tokens.union(right_tokens)
    return len(intersection) / len(union)


def _example_sql(feedback: QueryFeedback) -> Optional[str]:
    if feedback.rating == "corrected" and feedback.corrected_sql:
        return feedback.corrected_sql.strip()
    if feedback.rating == "thumbs_up":
        return (feedback.corrected_sql or feedback.generated_sql or "").strip() or None
    return None


def find_similar_examples(
    question: str,
    connection_id: int,
    user_id: int,
    db: Session,
    limit: Optional[int] = None,
    min_similarity: Optional[float] = None,
) -> List[VerifiedExample]:
    """
    Retrieves verified question/SQL pairs for prompt augmentation based on token similarity.
    """
    limit = limit or settings.LEARNING_MAX_EXAMPLES
    min_similarity = min_similarity if min_similarity is not None else settings.LEARNING_MIN_SIMILARITY

    feedback_rows = (
        db.query(QueryFeedback)
        .filter(
            QueryFeedback.connection_id == connection_id,
            QueryFeedback.user_id == user_id,
            QueryFeedback.rating.in_(["thumbs_up", "corrected"]),
        )
        .order_by(QueryFeedback.created_at.desc())
        .limit(100)
        .all()
    )

    scored: List[VerifiedExample] = []
    for row in feedback_rows:
        sql = _example_sql(row)
        if not sql:
            continue
        score = _similarity(question, row.question)
        if score < min_similarity:
            continue
        scored.append(
            VerifiedExample(
                question=row.question,
                sql=sql,
                similarity=score,
                source=row.rating,
            )
        )

    scored.sort(key=lambda item: item.similarity, reverse=True)
    return scored[:limit]


def format_examples_for_prompt(examples: List[VerifiedExample]) -> str:
    if not examples:
        return ""

    lines = ["Verified examples for this database (prefer these patterns when relevant):"]
    for index, example in enumerate(examples, start=1):
        lines.append(f"{index}. Question: {example.question}")
        lines.append(f"   SQL: {example.sql}")
    return "\n".join(lines)


def pick_high_confidence_example(
    question: str,
    examples: List[VerifiedExample],
    threshold: Optional[float] = None,
) -> Optional[VerifiedExample]:
    threshold = threshold if threshold is not None else settings.LEARNING_DIRECT_MATCH_THRESHOLD
    if not examples:
        return None
    best = max(examples, key=lambda item: item.similarity)
    if best.similarity >= threshold:
        return best
    return None
