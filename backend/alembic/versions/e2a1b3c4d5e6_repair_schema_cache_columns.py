"""repair missing schema cache columns

Revision ID: e2a1b3c4d5e6
Revises: d1e2f3a4b5c6
Create Date: 2026-09-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migration_utils import has_column


revision: str = "e2a1b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not has_column("database_schema_caches", "is_nullable"):
        op.add_column("database_schema_caches", sa.Column("is_nullable", sa.Boolean(), nullable=True))
    if not has_column("database_schema_caches", "null_ratio"):
        op.add_column("database_schema_caches", sa.Column("null_ratio", sa.Float(), nullable=True))
    if not has_column("database_schema_caches", "distinct_count"):
        op.add_column("database_schema_caches", sa.Column("distinct_count", sa.Integer(), nullable=True))
    if not has_column("database_schema_caches", "sample_values"):
        op.add_column("database_schema_caches", sa.Column("sample_values", sa.Text(), nullable=True))
    if not has_column("database_schema_caches", "is_pii"):
        op.add_column(
            "database_schema_caches",
            sa.Column("is_pii", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    if has_column("database_schema_caches", "is_pii"):
        op.drop_column("database_schema_caches", "is_pii")
    if has_column("database_schema_caches", "sample_values"):
        op.drop_column("database_schema_caches", "sample_values")
    if has_column("database_schema_caches", "distinct_count"):
        op.drop_column("database_schema_caches", "distinct_count")
    if has_column("database_schema_caches", "null_ratio"):
        op.drop_column("database_schema_caches", "null_ratio")
    if has_column("database_schema_caches", "is_nullable"):
        op.drop_column("database_schema_caches", "is_nullable")
