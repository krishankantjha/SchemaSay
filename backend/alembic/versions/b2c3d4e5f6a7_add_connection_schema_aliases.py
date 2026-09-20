"""add connection schema aliases

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-14 21:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migration_utils import has_index, has_table


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not has_table("connection_schema_aliases"):
        op.create_table(
            "connection_schema_aliases",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("connection_id", sa.Integer(), nullable=False),
            sa.Column("alias_type", sa.String(), nullable=False),
            sa.Column("alias_token", sa.String(), nullable=False),
            sa.Column("target_table", sa.String(), nullable=False),
            sa.Column("target_column", sa.String(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=True,
            ),
            sa.ForeignKeyConstraint(["connection_id"], ["database_connections.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if not has_index("connection_schema_aliases", "ix_connection_schema_aliases_connection_id"):
        op.create_index(
            op.f("ix_connection_schema_aliases_connection_id"),
            "connection_schema_aliases",
            ["connection_id"],
            unique=False,
        )
    if not has_index("connection_schema_aliases", "ix_connection_schema_aliases_alias_token"):
        op.create_index(
            op.f("ix_connection_schema_aliases_alias_token"),
            "connection_schema_aliases",
            ["alias_token"],
            unique=False,
        )


def downgrade() -> None:
    if has_index("connection_schema_aliases", "ix_connection_schema_aliases_alias_token"):
        op.drop_index(
            op.f("ix_connection_schema_aliases_alias_token"),
            table_name="connection_schema_aliases",
        )
    if has_index("connection_schema_aliases", "ix_connection_schema_aliases_connection_id"):
        op.drop_index(
            op.f("ix_connection_schema_aliases_connection_id"),
            table_name="connection_schema_aliases",
        )
    if has_table("connection_schema_aliases"):
        op.drop_table("connection_schema_aliases")
