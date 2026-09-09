"""add governance and rich audit fields

Revision ID: b8d4f1a26c90
Revises: a4b7e2c91d03
Create Date: 2026-09-06 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8d4f1a26c90"
down_revision: Union[str, Sequence[str], None] = "a4b7e2c91d03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("database_schema_caches", sa.Column("is_pii", sa.Boolean(), nullable=False, server_default=sa.false()))

    op.add_column("query_audit_logs", sa.Column("correlation_id", sa.String(), nullable=True))
    op.add_column("query_audit_logs", sa.Column("confidence_score", sa.Integer(), nullable=True))
    op.add_column("query_audit_logs", sa.Column("grounded", sa.Boolean(), nullable=True))
    op.add_column("query_audit_logs", sa.Column("tables_accessed_json", sa.Text(), nullable=True))
    op.add_column("query_audit_logs", sa.Column("row_count", sa.Integer(), nullable=True))
    op.add_column("query_audit_logs", sa.Column("resolution_source", sa.String(), nullable=True))
    op.add_column("query_audit_logs", sa.Column("metric_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_query_audit_logs_correlation_id"), "query_audit_logs", ["correlation_id"], unique=False)

    op.create_table(
        "connection_policies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("connection_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("blocked_tables_json", sa.Text(), nullable=False),
        sa.Column("blocked_columns_json", sa.Text(), nullable=False),
        sa.Column("require_high_confidence", sa.Boolean(), nullable=False),
        sa.Column("min_confidence_threshold", sa.Integer(), nullable=False),
        sa.Column("block_pii_access", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["connection_id"], ["database_connections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("connection_id", name="uq_connection_policy"),
    )
    op.create_index(op.f("ix_connection_policies_connection_id"), "connection_policies", ["connection_id"], unique=False)
    op.create_index(op.f("ix_connection_policies_user_id"), "connection_policies", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_connection_policies_user_id"), table_name="connection_policies")
    op.drop_index(op.f("ix_connection_policies_connection_id"), table_name="connection_policies")
    op.drop_table("connection_policies")

    op.drop_index(op.f("ix_query_audit_logs_correlation_id"), table_name="query_audit_logs")
    op.drop_column("query_audit_logs", "metric_id")
    op.drop_column("query_audit_logs", "resolution_source")
    op.drop_column("query_audit_logs", "row_count")
    op.drop_column("query_audit_logs", "tables_accessed_json")
    op.drop_column("query_audit_logs", "grounded")
    op.drop_column("query_audit_logs", "confidence_score")
    op.drop_column("query_audit_logs", "correlation_id")

    op.drop_column("database_schema_caches", "is_pii")
