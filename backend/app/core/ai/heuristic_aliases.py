"""
Business-language and per-connection aliases for the heuristic compiler.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

from sqlalchemy.orm import Session

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
        lowered = token.lower()
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
        return self.column_aliases.get(token.lower(), token)

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
