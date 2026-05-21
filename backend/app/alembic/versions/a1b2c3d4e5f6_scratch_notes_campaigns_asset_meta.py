"""scratch notes, social campaigns, asset meta

Revision ID: a1b2c3d4e5f6
Revises: c2a8d1f3b540
Create Date: 2026-05-20 10:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "c2a8d1f3b540"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("assets", sa.Column("meta", sa.JSON(), nullable=True, server_default="{}"))

    op.create_table(
        "scratch_notes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("engagement_id", sa.Uuid(), nullable=False),
        sa.Column("workstream_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False, server_default="Untitled"),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["engagement_id"], ["engagements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workstream_id"], ["workstreams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scratch_notes_workstream_id", "scratch_notes", ["workstream_id"])
    op.create_index("ix_scratch_notes_engagement_id", "scratch_notes", ["engagement_id"])

    op.create_table(
        "social_campaigns",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("engagement_id", sa.Uuid(), nullable=False),
        sa.Column("workstream_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("campaign_type", sa.String(length=16), nullable=False, server_default="email"),
        sa.Column("sent", sa.Integer(), nullable=True),
        sa.Column("clicked", sa.Integer(), nullable=True),
        sa.Column("submitted", sa.Integer(), nullable=True),
        sa.Column("mfa_bypassed", sa.Integer(), nullable=True),
        sa.Column("notes_md", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["engagement_id"], ["engagements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workstream_id"], ["workstreams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_social_campaigns_workstream_id", "social_campaigns", ["workstream_id"])
    op.create_index("ix_social_campaigns_engagement_id", "social_campaigns", ["engagement_id"])


def downgrade() -> None:
    op.drop_table("social_campaigns")
    op.drop_table("scratch_notes")
    op.drop_column("assets", "meta")
