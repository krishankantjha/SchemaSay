"""merge migration heads

Revision ID: 844d42bf965e
Revises: f4c2d8e91a07, 4c8e1e8d7a10
Create Date: 2026-09-09 18:30:27.820757

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '844d42bf965e'
down_revision: Union[str, Sequence[str], None] = ('f4c2d8e91a07', '4c8e1e8d7a10')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
