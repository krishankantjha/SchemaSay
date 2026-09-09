"""repair missing audit log columns

Revision ID: f4c2d8e91a07
Revises: e2a1b3c4d5e6
Create Date: 2026-09-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4c2d8e91a07"
down_revision: Union[str, Sequence[str], None] = "e2a1b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    rows = bind.execute(sa.text(f"PRAGMA table_info({table})")).fetchall()
    return any(row[1] == column for row in rows)


def upgrade() -> None:
    if not _has_column("query_audit_logs", "correlation_id"):
        op.add_column("query_audit_logs", sa.Column("correlation_id", sa.String(), nullable=True))
        op.create_index(op.f("ix_query_audit_logs_correlation_id"), "query_audit_logs", ["correlation_id"], unique=False)
    if not _has_column("query_audit_logs", "confidence_score"):
        op.add_column("query_audit_logs", sa.Column("confidence_score", sa.Integer(), nullable=True))
    if not _has_column("query_audit_logs", "grounded"):
        op.add_column("query_audit_logs", sa.Column("grounded", sa.Boolean(), nullable=True))
    if not _has_column("query_audit_logs", "tables_accessed_json"):
        op.add_column("query_audit_logs", sa.Column("tables_accessed_json", sa.Text(), nullable=True))
    if not _has_column("query_audit_logs", "row_count"):
        op.add_column("query_audit_logs", sa.Column("row_count", sa.Integer(), nullable=True))
    if not _has_column("query_audit_logs", "resolution_source"):
        op.add_column("query_audit_logs", sa.Column("resolution_source", sa.String(), nullable=True))
    if not _has_column("query_audit_logs", "metric_id"):
        op.add_column("query_audit_logs", sa.Column("metric_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    if _has_column("query_audit_logs", "metric_id"):
        op.drop_column("query_audit_logs", "metric_id")
    if _has_column("query_audit_logs", "resolution_source"):
        op.drop_column("query_audit_logs", "resolution_source")
    if _has_column("query_audit_logs", "row_count"):
        op.drop_column("query_audit_logs", "row_count")
    if _has_column("query_audit_logs", "tables_accessed_json"):
        op.drop_column("query_audit_logs", "tables_accessed_json")
    if _has_column("query_audit_logs", "grounded"):
        op.drop_column("query_audit_logs", "grounded")
    if _has_column("query_audit_logs", "confidence_score"):
        op.drop_column("query_audit_logs", "confidence_score")
    if _has_column("query_audit_logs", "correlation_id"):
        op.drop_index(op.f("ix_query_audit_logs_correlation_id"), table_name="query_audit_logs")
        op.drop_column("query_audit_logs", "correlation_id")
