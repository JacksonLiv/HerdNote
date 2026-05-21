"""merge heads

Revision ID: aabb1122ccdd
Revises: e1a2b3c4d5e6, f1a2b3c4d5e6
Create Date: 2026-05-21

"""
from alembic import op

revision = "aabb1122ccdd"
down_revision = ("e1a2b3c4d5e6", "f1a2b3c4d5e6")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
