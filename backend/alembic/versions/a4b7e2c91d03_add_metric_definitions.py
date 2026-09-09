"""add metric definitions table

Revision ID: a4b7e2c91d03
Revises: f3a8c1d92b10
Create Date: 2026-09-06 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a4b7e2c91d03"
down_revision: Union[str, Sequence[str], None] = "f3a8c1d92b10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "metric_definitions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("connection_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sql_expression", sa.Text(), nullable=False),
        sa.Column("base_table", sa.String(), nullable=False),
        sa.Column("default_filters", sa.Text(), nullable=True),
        sa.Column("dimensions_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["connection_id"], ["database_connections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("connection_id", "name", name="uq_metric_connection_name"),
    )
    op.create_index(op.f("ix_metric_definitions_connection_id"), "metric_definitions", ["connection_id"], unique=False)
    op.create_index(op.f("ix_metric_definitions_user_id"), "metric_definitions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_metric_definitions_user_id"), table_name="metric_definitions")
    op.drop_index(op.f("ix_metric_definitions_connection_id"), table_name="metric_definitions")
    op.drop_table("metric_definitions")
