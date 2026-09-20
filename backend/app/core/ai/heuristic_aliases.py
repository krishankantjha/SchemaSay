"""
Business-language and per-connection aliases for the heuristic compiler.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

from sqlalchemy.orm import Session

from app.core.schema.alias_validation import normalize_alias_token

# Global defaults — overridden by per-connection aliases when present.
DEFAULT_TABLE_ALIASES: Dict[str, str] = {
    "customer": "users",
    "customers": "users",
    "client": "users",
    "clients": "users",
    "user": "users",
    "order": "orders",
    "purchase": "orders",
    "purchases": "orders",
    "sale": "orders",
    "product": "products",
    "products": "products",
    "item": "order_items",
    "items": "order_items",
    "line_item": "order_items",
    "line_items": "order_items",
    "invoice": "invoices",
    "invoices": "invoices",
    "payment": "payments",
    "payments": "payments",
    "employee": "employees",
    "employees": "employees",
    "account": "accounts",
    "accounts": "accounts",
}

DEFAULT_COLUMN_ALIASES: Dict[str, str] = {
    "revenue": "price",
    "sales": "price",
    "amount": "price",
    "cost": "cost",
    "quantity": "quantity",
    "qty": "quantity",
    "email": "email",
    "name": "name",
    "status": "status",
    "total": "total",
}


def alias_phrase_variants(token: str) -> List[str]:
    """Match stored tokens as underscores or as spaced phrases in questions."""
    lowered = token.lower()
    variants = [lowered]
    spaced = lowered.replace("_", " ")
    if spaced != lowered:
        variants.append(spaced)
    return variants


def alias_keys_in_question(question_lower: str, aliases: Dict[str, str]) -> List[str]:
    """Return alias keys found in a question, longest matches first."""
    matched: List[str] = []
    for key in sorted(aliases.keys(), key=len, reverse=True):
        for variant in alias_phrase_variants(key):
            if re.search(r"\b" + re.escape(variant) + r"\b", question_lower):
                matched.append(key)
                break
    return matched


@dataclass
class AliasContext:
    table_aliases: Dict[str, str] = field(default_factory=dict)
    column_aliases: Dict[str, str] = field(default_factory=dict)

    @classmethod
    def global_defaults(cls) -> AliasContext:
        return cls(
            table_aliases=dict(DEFAULT_TABLE_ALIASES),
            column_aliases=dict(DEFAULT_COLUMN_ALIASES),
        )

    def resolve_table(self, token: str, known_tables: Set[str]) -> Optional[str]:
        lowered = normalize_alias_token(token)
        for table in known_tables:
            if table.lower() == lowered:
                return table

        candidate = self.table_aliases.get(lowered)
        if not candidate and lowered.endswith("s"):
            candidate = self.table_aliases.get(lowered[:-1])
        if not candidate and not lowered.endswith("s"):
            candidate = self.table_aliases.get(lowered + "s")
        if candidate:
            for table in known_tables:
                if table.lower() == candidate.lower():
                    return table

        if lowered.endswith("s"):
            stem = lowered[:-1]
            for table in known_tables:
                if table.lower() == stem:
                    return table
        else:
            for table in known_tables:
                if table.lower() == lowered + "s":
                    return table
        return None

    def resolve_column_hint(self, token: str) -> str:
        lowered = token.lower().strip()
        normalized = normalize_alias_token(lowered)
        if normalized in self.column_aliases:
            return self.column_aliases[normalized]
        return self.column_aliases.get(lowered, token)

    def resolve_column(self, hint: str, columns: List[str]) -> Optional[str]:
        mapped = self.resolve_column_hint(hint)
        hint_lower = mapped.lower()
        for col in columns:
            if col.lower() == hint_lower:
                return col
        if len(hint_lower) >= 3:
            for col in columns:
                if hint_lower in col.lower() or col.lower() in hint_lower:
                    return col
        return None


def table_tokens_in_question(question_lower: str) -> List[str]:
    return re.findall(r"\b[a-z][a-z0-9_]*\b", question_lower)


def load_alias_context(db: Session, connection_id: int) -> AliasContext:
    """Merge global defaults with per-connection alias overrides."""
    from app.models.connection import ConnectionSchemaAlias

    ctx = AliasContext.global_defaults()
    rows = (
        db.query(ConnectionSchemaAlias)
        .filter(ConnectionSchemaAlias.connection_id == connection_id)
        .all()
    )
    for row in rows:
        token = row.alias_token.lower()
        if row.alias_type == "table" and row.target_table:
            ctx.table_aliases[token] = row.target_table
        elif row.alias_type == "column" and row.target_column:
            ctx.column_aliases[token] = row.target_column
    return ctx
