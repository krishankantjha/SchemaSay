"""add google oauth fields to users

Revision ID: d1e2f3a4b5c6
Revises: c9e1f4b72a81
Create Date: 2026-09-08 22:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, Sequence[str], None] = "c9e1f4b72a81"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column("hashed_password", existing_type=sa.String(), nullable=True)
        batch_op.add_column(sa.Column("google_id", sa.String(), nullable=True))
        batch_op.add_column(
            sa.Column("auth_provider", sa.String(), nullable=False, server_default="local")
        )
    op.create_index(op.f("ix_users_google_id"), "users", ["google_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_google_id"), table_name="users")
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("auth_provider")
        batch_op.drop_column("google_id")
        batch_op.alter_column("hashed_password", existing_type=sa.String(), nullable=False)
