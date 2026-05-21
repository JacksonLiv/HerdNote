"""Add engagement_reports table

Revision ID: a1c2d3e4f5a6
Revises: bb2233445566
Create Date: 2026-05-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1c2d3e4f5a6"
down_revision: str | None = "bb2233445566"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "engagement_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("engagement_id", sa.Uuid(), nullable=False),
        sa.Column("exec_summary_md", sa.Text(), nullable=True),
        sa.Column("recommendations_md", sa.Text(), nullable=True),
        sa.Column("selected_finding_ids", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("appendix_config", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("template_file_path", sa.String(512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["engagement_id"], ["engagements.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("engagement_id"),
    )
    op.create_index(
        "ix_engagement_reports_engagement_id",
        "engagement_reports",
        ["engagement_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_engagement_reports_engagement_id", table_name="engagement_reports")
    op.drop_table("engagement_reports")
