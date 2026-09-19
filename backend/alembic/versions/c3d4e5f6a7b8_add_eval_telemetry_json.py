"""add eval telemetry json to audit logs

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-14 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT name FROM pragma_table_info(:table) WHERE name = :column"),
        {"table": table, "column": column},
    ).fetchall()
    return bool(rows)


def upgrade() -> None:
    if not _has_column("query_audit_logs", "eval_telemetry_json"):
        op.add_column("query_audit_logs", sa.Column("eval_telemetry_json", sa.Text(), nullable=True))


def downgrade() -> None:
    if _has_column("query_audit_logs", "eval_telemetry_json"):
        op.drop_column("query_audit_logs", "eval_telemetry_json")
