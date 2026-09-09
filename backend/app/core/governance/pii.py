from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import List, Optional

from app.core.schema.graph import SchemaGraph


PII_NAME_PATTERNS = (
    r"\bemail\b",
    r"\bphone\b",
    r"\bmobile\b",
    r"\bssn\b",
    r"\bsocial_security\b",
    r"\bpassword\b",
    r"\bpasswd\b",
    r"\bcredit_card\b",
    r"\bcard_number\b",
    r"\baddress\b",
    r"\bdob\b",
    r"\bbirth_date\b",
    r"\bdate_of_birth\b",
)

EMAIL_SAMPLE_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_SAMPLE_PATTERN = re.compile(r"^\+?[\d\s().-]{7,}$")


def detect_pii_column(table_name: str, column_name: str, data_type: str, sample_values: Optional[str] = None) -> bool:
    """
    Heuristically flags columns that likely contain personally identifiable information.
    """
    combined = f"{table_name}.{column_name}".lower()
    for pattern in PII_NAME_PATTERNS:
        if re.search(pattern, combined):
            return True

    if sample_values:
        try:
            values = json.loads(sample_values) if isinstance(sample_values, str) else sample_values
        except json.JSONDecodeError:
            values = []
        for value in values or []:
            text = str(value)
            if EMAIL_SAMPLE_PATTERN.match(text):
                return True
            if PHONE_SAMPLE_PATTERN.match(text) and sum(char.isdigit() for char in text) >= 7:
                return True

    lowered_type = (data_type or "").lower()
    if "email" in lowered_type:
        return True

    return False


def pii_warnings_for_sql(sql: str, graph: SchemaGraph, tables_used: List[str]) -> List[str]:
    warnings: List[str] = []
    sql_lower = sql.lower()

    for table_name in tables_used:
        table_key = graph._resolve_table_key(table_name)
        if not table_key:
            continue
        for column in graph.tables.get(table_key, []):
            if not column.is_pii:
                continue
            if column.name.lower() in sql_lower or f"{table_key.lower()}.{column.name.lower()}" in sql_lower:
                warnings.append(
                    f"Query accesses PII column '{table_key}.{column.name}'. Handle results according to your data policy."
                )
    return warnings
