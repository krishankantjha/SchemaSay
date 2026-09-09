"""add query feedback learning table

Revision ID: c9e1f4b72a81
Revises: b8d4f1a26c90
Create Date: 2026-09-06 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9e1f4b72a81"
down_revision: Union[str, Sequence[str], None] = "b8d4f1a26c90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "query_feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("connection_id", sa.Integer(), nullable=False),
        sa.Column("audit_log_id", sa.Integer(), nullable=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("generated_sql", sa.Text(), nullable=True),
        sa.Column("corrected_sql", sa.Text(), nullable=True),
        sa.Column("rating", sa.String(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["audit_log_id"], ["query_audit_logs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["connection_id"], ["database_connections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_query_feedback_user_id"), "query_feedback", ["user_id"], unique=False)
    op.create_index(op.f("ix_query_feedback_connection_id"), "query_feedback", ["connection_id"], unique=False)
    op.create_index(op.f("ix_query_feedback_audit_log_id"), "query_feedback", ["audit_log_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_query_feedback_audit_log_id"), table_name="query_feedback")
    op.drop_index(op.f("ix_query_feedback_connection_id"), table_name="query_feedback")
    op.drop_index(op.f("ix_query_feedback_user_id"), table_name="query_feedback")
    op.drop_table("query_feedback")
