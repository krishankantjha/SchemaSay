"""add feedback answer context columns

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-16 18:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migration_utils import has_column


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not has_column("query_feedback", "feedback_categories_json"):
        op.add_column("query_feedback", sa.Column("feedback_categories_json", sa.Text(), nullable=True))
    if not has_column("query_feedback", "correlation_id"):
        op.add_column("query_feedback", sa.Column("correlation_id", sa.String(), nullable=True))
    if not has_column("query_feedback", "result_row_count"):
        op.add_column("query_feedback", sa.Column("result_row_count", sa.Integer(), nullable=True))
    if not has_column("query_feedback", "result_columns_json"):
        op.add_column("query_feedback", sa.Column("result_columns_json", sa.Text(), nullable=True))


def downgrade() -> None:
    if has_column("query_feedback", "result_columns_json"):
        op.drop_column("query_feedback", "result_columns_json")
    if has_column("query_feedback", "result_row_count"):
        op.drop_column("query_feedback", "result_row_count")
    if has_column("query_feedback", "correlation_id"):
        op.drop_column("query_feedback", "correlation_id")
    if has_column("query_feedback", "feedback_categories_json"):
        op.drop_column("query_feedback", "feedback_categories_json")
