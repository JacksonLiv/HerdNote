"""ghostwriter hasura admin secret

Revision ID: bb2233445566
Revises: aabb1122ccdd
Create Date: 2026-05-21

"""
import sqlalchemy as sa
from alembic import op

revision = "bb2233445566"
down_revision = "aabb1122ccdd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ghostwriter_settings",
        sa.Column("hasura_admin_secret", sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ghostwriter_settings", "hasura_admin_secret")
