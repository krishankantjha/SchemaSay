"""add heuristic compiler audit columns

Revision ID: a1b2c3d4e5f6
Revises: 844d42bf965e
Create Date: 2026-09-14 19:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "844d42bf965e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    rows = bind.execute(sa.text(f"PRAGMA table_info({table})")).fetchall()
    return any(row[1] == column for row in rows)


def upgrade() -> None:
    if not _has_column("query_audit_logs", "heuristic_tier"):
        op.add_column("query_audit_logs", sa.Column("heuristic_tier", sa.String(), nullable=True))
    if not _has_column("query_audit_logs", "heuristic_compile_confidence"):
        op.add_column(
            "query_audit_logs",
            sa.Column("heuristic_compile_confidence", sa.Integer(), nullable=True),
        )


def downgrade() -> None:
    if _has_column("query_audit_logs", "heuristic_compile_confidence"):
        op.drop_column("query_audit_logs", "heuristic_compile_confidence")
    if _has_column("query_audit_logs", "heuristic_tier"):
        op.drop_column("query_audit_logs", "heuristic_tier")
