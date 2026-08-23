"""Hash persisted refresh tokens.

Revision ID: 4c8e1e8d7a10
Revises: ecd7fafb844a
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "4c8e1e8d7a10"
down_revision: Union[str, Sequence[str], None] = "ecd7fafb844a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("refresh_tokens", sa.Column("token_hash", sa.String(length=64), nullable=True))
    # Existing plaintext rows cannot be reversibly hashed by SQL across all supported
    # databases. They are invalidated and must be reissued after deployment.
    op.execute(sa.text("DELETE FROM refresh_tokens"))
    op.drop_index("ix_refresh_tokens_token", table_name="refresh_tokens")
    with op.batch_alter_table("refresh_tokens", recreate="always") as batch_op:
        batch_op.alter_column("token_hash", existing_type=sa.String(), nullable=False)
        batch_op.drop_column("token")
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
    with op.batch_alter_table("refresh_tokens", recreate="always") as batch_op:
        batch_op.add_column(sa.Column("token", sa.String(), nullable=True))
        batch_op.alter_column("token", existing_type=sa.String(), nullable=False)
        batch_op.drop_column("token_hash")
    op.create_index("ix_refresh_tokens_token", "refresh_tokens", ["token"], unique=True)
