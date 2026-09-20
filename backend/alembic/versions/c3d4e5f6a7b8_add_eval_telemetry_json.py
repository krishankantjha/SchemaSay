"""add eval telemetry json to audit logs

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-14 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migration_utils import has_column


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not has_column("query_audit_logs", "eval_telemetry_json"):
        op.add_column("query_audit_logs", sa.Column("eval_telemetry_json", sa.Text(), nullable=True))


def downgrade() -> None:
    if has_column("query_audit_logs", "eval_telemetry_json"):
        op.drop_column("query_audit_logs", "eval_telemetry_json")
