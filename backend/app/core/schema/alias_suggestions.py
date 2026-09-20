"""Heuristic alias suggestions from synced schema metadata."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Optional, Set

from app.core.ai.heuristic_aliases import DEFAULT_COLUMN_ALIASES, DEFAULT_TABLE_ALIASES
from app.core.schema.alias_validation import normalize_alias_token


@dataclass
class AliasSuggestion:
    alias_type: str
    alias_token: str
    target_table: str
    target_column: Optional[str]
    reason: str


_TABLE_SUGGESTIONS: dict[str, list[str]] = {
    "users": ["customer", "customers", "client", "buyer"],
    "orders": ["purchase", "purchases", "sale"],
    "products": ["item", "sku"],
    "order_items": ["line item", "line items"],
}

_COLUMN_SUGGESTIONS: dict[str, list[str]] = {
    "price": ["revenue", "sales", "amount"],
    "quantity": ["qty", "units"],
    "email": ["email address"],
    "status": ["state"],
    "created_at": ["order date", "created date"],
}


def _display_alias(alias_token: str) -> str:
    text = alias_token.strip().replace("_", " ")
    if not text:
        return text
    return text[0].upper() + text[1:]


def _friendly_name(name: str) -> str:
    return name.replace("_", " ")


def _table_reason(alias_token: str, target_table: str) -> str:
    alias = _display_alias(alias_token)
    table = _friendly_name(target_table)
    return f"{alias} is connected to your {table} table."


def _column_reason(alias_token: str, target_column: str) -> str:
    alias = _display_alias(alias_token)
    column = _friendly_name(target_column)
    return f"{alias} is connected to your {column} field."


def _existing_tokens(
    existing_aliases: Iterable[dict],
) -> Set[str]:
    tokens: Set[str] = set()
    for alias in existing_aliases:
        token = alias.get("alias_token") or alias.get("aliasToken")
        if token:
            tokens.add(normalize_alias_token(str(token)))
    return tokens


def suggest_aliases_from_metadata(
    metadata_rows: Iterable[dict],
    existing_aliases: Optional[Iterable[dict]] = None,
    *,
    limit: int = 12,
) -> List[AliasSuggestion]:
    """
    Propose table/column aliases from schema names and common business vocabulary.
    Skips tokens that already exist on the connection or match global defaults.
    """
    existing = _existing_tokens(existing_aliases or [])
    suggestions: List[AliasSuggestion] = []
    seen: Set[tuple[str, str, str, Optional[str]]] = set()

    tables = sorted({row["table_name"] for row in metadata_rows if row.get("table_name")})
    columns_by_table: dict[str, set[str]] = {}
    for row in metadata_rows:
        table = row.get("table_name")
        column = row.get("column_name")
        if table and column:
            columns_by_table.setdefault(table, set()).add(column)

    def add(
        alias_type: str,
        alias_token: str,
        target_table: str,
        target_column: Optional[str],
        reason: str,
    ) -> None:
        normalized = normalize_alias_token(alias_token)
        if not normalized or normalized in existing:
            return
        if alias_type == "table" and normalized in {t.lower() for t in tables}:
            return
        if alias_type == "column":
            canonical = columns_by_table.get(target_table, set())
            if target_column not in canonical:
                return
            if normalized == target_column.lower():
                return
        key = (alias_type, normalized, target_table.lower(), target_column.lower() if target_column else None)
        if key in seen:
            return
        seen.add(key)
        suggestions.append(
            AliasSuggestion(
                alias_type=alias_type,
                alias_token=normalized,
                target_table=target_table,
                target_column=target_column,
                reason=reason,
            )
        )

    for table in tables:
        table_lower = table.lower()
        for alias_token in _TABLE_SUGGESTIONS.get(table_lower, []):
            add("table", alias_token, table, None, _table_reason(alias_token, table))
        for alias_token, canonical in DEFAULT_TABLE_ALIASES.items():
            if canonical.lower() == table_lower:
                add("table", alias_token, table, None, _table_reason(alias_token, table))

    for table, columns in columns_by_table.items():
        for column in columns:
            column_lower = column.lower()
            for alias_token in _COLUMN_SUGGESTIONS.get(column_lower, []):
                add(
                    "column",
                    alias_token,
                    table,
                    column,
                    _column_reason(alias_token, column),
                )
            for alias_token, canonical in DEFAULT_COLUMN_ALIASES.items():
                if canonical.lower() == column_lower:
                    add(
                        "column",
                        alias_token,
                        table,
                        column,
                        _column_reason(alias_token, column),
                    )

    suggestions.sort(key=lambda item: (item.alias_type, item.target_table, item.alias_token))
    return suggestions[:limit]
