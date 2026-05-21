"""user discord webhook url

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-05-20

"""
import sqlalchemy as sa
from alembic import op

revision = "f1a2b3c4d5e6"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("discord_webhook_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "discord_webhook_url")
