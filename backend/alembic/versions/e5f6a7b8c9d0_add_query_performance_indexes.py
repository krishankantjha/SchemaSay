"""add query performance indexes

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-19 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_schema_cache_connection_table",
        "database_schema_caches",
        ["connection_id", "table_name"],
        unique=False,
    )
    op.create_index(
        "ix_audit_logs_user_created",
        "query_audit_logs",
        ["user_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_audit_logs_user_created", table_name="query_audit_logs")
    op.drop_index("ix_schema_cache_connection_table", table_name="database_schema_caches")
