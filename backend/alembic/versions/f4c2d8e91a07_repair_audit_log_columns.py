"""repair missing audit log columns

Revision ID: f4c2d8e91a07
Revises: e2a1b3c4d5e6
Create Date: 2026-09-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migration_utils import has_column


revision: str = "f4c2d8e91a07"
down_revision: Union[str, Sequence[str], None] = "e2a1b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not has_column("query_audit_logs", "correlation_id"):
        op.add_column("query_audit_logs", sa.Column("correlation_id", sa.String(), nullable=True))
        op.create_index(op.f("ix_query_audit_logs_correlation_id"), "query_audit_logs", ["correlation_id"], unique=False)
    if not has_column("query_audit_logs", "confidence_score"):
        op.add_column("query_audit_logs", sa.Column("confidence_score", sa.Integer(), nullable=True))
    if not has_column("query_audit_logs", "grounded"):
        op.add_column("query_audit_logs", sa.Column("grounded", sa.Boolean(), nullable=True))
    if not has_column("query_audit_logs", "tables_accessed_json"):
        op.add_column("query_audit_logs", sa.Column("tables_accessed_json", sa.Text(), nullable=True))
    if not has_column("query_audit_logs", "row_count"):
        op.add_column("query_audit_logs", sa.Column("row_count", sa.Integer(), nullable=True))
    if not has_column("query_audit_logs", "resolution_source"):
        op.add_column("query_audit_logs", sa.Column("resolution_source", sa.String(), nullable=True))
    if not has_column("query_audit_logs", "metric_id"):
        op.add_column("query_audit_logs", sa.Column("metric_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    if has_column("query_audit_logs", "metric_id"):
        op.drop_column("query_audit_logs", "metric_id")
    if has_column("query_audit_logs", "resolution_source"):
        op.drop_column("query_audit_logs", "resolution_source")
    if has_column("query_audit_logs", "row_count"):
        op.drop_column("query_audit_logs", "row_count")
    if has_column("query_audit_logs", "tables_accessed_json"):
        op.drop_column("query_audit_logs", "tables_accessed_json")
    if has_column("query_audit_logs", "grounded"):
        op.drop_column("query_audit_logs", "grounded")
    if has_column("query_audit_logs", "confidence_score"):
        op.drop_column("query_audit_logs", "confidence_score")
    if has_column("query_audit_logs", "correlation_id"):
        op.drop_index(op.f("ix_query_audit_logs_correlation_id"), table_name="query_audit_logs")
        op.drop_column("query_audit_logs", "correlation_id")
