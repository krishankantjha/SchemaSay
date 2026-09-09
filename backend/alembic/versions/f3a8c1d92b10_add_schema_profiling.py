"""add schema profiling columns and table stats

Revision ID: f3a8c1d92b10
Revises: ecd7fafb844a
Create Date: 2026-09-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3a8c1d92b10"
down_revision: Union[str, Sequence[str], None] = "ecd7fafb844a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("database_schema_caches", sa.Column("is_nullable", sa.Boolean(), nullable=True))
    op.add_column("database_schema_caches", sa.Column("null_ratio", sa.Float(), nullable=True))
    op.add_column("database_schema_caches", sa.Column("distinct_count", sa.Integer(), nullable=True))
    op.add_column("database_schema_caches", sa.Column("sample_values", sa.Text(), nullable=True))

    op.create_table(
        "schema_table_stats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("connection_id", sa.Integer(), nullable=False),
        sa.Column("table_name", sa.String(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("last_profiled_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["connection_id"], ["database_connections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_schema_table_stats_connection_id"), "schema_table_stats", ["connection_id"], unique=False)
    op.create_index(op.f("ix_schema_table_stats_table_name"), "schema_table_stats", ["table_name"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_schema_table_stats_table_name"), table_name="schema_table_stats")
    op.drop_index(op.f("ix_schema_table_stats_connection_id"), table_name="schema_table_stats")
    op.drop_table("schema_table_stats")

    op.drop_column("database_schema_caches", "sample_values")
    op.drop_column("database_schema_caches", "distinct_count")
    op.drop_column("database_schema_caches", "null_ratio")
    op.drop_column("database_schema_caches", "is_nullable")
