import re
from typing import Any, Dict, List, Optional

_AGGREGATION_HINTS = re.compile(
    r"\b(count|sum|average|avg|total|how many|top\s+\d+|bottom|rate|percent|ratio|trend|compare|growth|declin)\b",
    re.IGNORECASE,
)

_LISTING_HINTS = re.compile(
    r"\b(show|list|display|get|fetch|see|view|all|every)\b",
    re.IGNORECASE,
)

_ENTITY_WORDS = (
    ("customer", "customers"),
    ("order", "orders"),
    ("product", "products"),
    ("lead", "leads"),
    ("sale", "sales"),
    ("user", "users"),
    ("record", "records"),
    ("row", "rows"),
)

_NAME_COLUMNS = ("name", "customer_name", "product_name", "title", "label", "email")


def _guess_entity(question: str, row_count: int) -> str:
    q = question.lower()
    for singular, plural in _ENTITY_WORDS:
        if singular in q or plural in q:
            return singular if row_count == 1 else plural
    return "record" if row_count == 1 else "records"


def _find_name_column(columns: List[str]) -> Optional[str]:
    lower_map = {col.lower(): col for col in columns}
    for candidate in _NAME_COLUMNS:
        if candidate in lower_map:
            return lower_map[candidate]
    return None


def _format_name_preview(rows: List[Dict[str, Any]], name_col: str, limit: int = 3) -> str:
    names: List[str] = []
    for row in rows[:limit]:
        value = row.get(name_col)
        if value is not None and str(value).strip():
            names.append(str(value).strip())
    return ", ".join(names)


def try_simple_insight(
    question: str,
    columns: List[str],
    rows: List[Dict[str, Any]],
) -> Optional[str]:
    """
    Return an instant plain-English answer for simple listing queries.
    Skips the LLM when the question is straightforward and the result set is small.
    """
    if not columns:
        return None

    if not rows:
        return "No results matched your question."

    row_count = len(rows)
    question = question.strip()
    if not question:
        return None

    if _AGGREGATION_HINTS.search(question):
        return None

    is_listing = bool(_LISTING_HINTS.search(question))
    if not is_listing and row_count > 15:
        return None

    entity = _guess_entity(question, row_count)
    name_col = _find_name_column(columns)

    if name_col:
        if row_count == 1:
            name = _format_name_preview(rows, name_col, limit=1)
            return f"Found 1 {entity.rstrip('s')}: {name}." if name else f"Found 1 {entity.rstrip('s')}."

        preview = _format_name_preview(rows, name_col, limit=3)
        if preview:
            if row_count <= 5:
                all_names = _format_name_preview(rows, name_col, limit=row_count)
                return f"Here are {row_count} {entity}: {all_names}."
            remaining = row_count - 3
            return f"Found {row_count} {entity}. Examples include {preview}, and {remaining} more."

    if row_count == 1:
        return f"Found 1 {entity.rstrip('s')}."

    return f"Found {row_count} {entity} for your question."
