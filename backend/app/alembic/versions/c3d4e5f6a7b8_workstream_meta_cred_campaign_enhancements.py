"""workstream_meta_cred_campaign_enhancements

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-05-20

"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # workstreams: add meta JSON column
    op.add_column("workstreams", sa.Column("meta", sa.JSON(), nullable=True))
    op.execute("UPDATE workstreams SET meta = '{}'::jsonb WHERE meta IS NULL")

    # compromised_users: add credential tracking fields
    op.add_column("compromised_users", sa.Column("source", sa.String(24), nullable=True))
    op.add_column("compromised_users", sa.Column("hash_type", sa.String(16), nullable=True))
    op.add_column("compromised_users", sa.Column("cracked", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("compromised_users", sa.Column("spn", sa.Text(), nullable=True))

    # social_campaigns: add SE-specific fields
    op.add_column("social_campaigns", sa.Column("reported", sa.Integer(), nullable=True))
    op.add_column("social_campaigns", sa.Column("pretext_md", sa.Text(), nullable=True))
    op.add_column("social_campaigns", sa.Column("from_address", sa.String(255), nullable=True))
    op.add_column("social_campaigns", sa.Column("landing_url", sa.String(500), nullable=True))
    op.add_column("social_campaigns", sa.Column("tool_ref", sa.String(255), nullable=True))
    op.add_column("social_campaigns", sa.Column("campaign_status", sa.String(16), nullable=False, server_default="planned"))
    op.add_column("social_campaigns", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("social_campaigns", sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("social_campaigns", "ended_at")
    op.drop_column("social_campaigns", "started_at")
    op.drop_column("social_campaigns", "campaign_status")
    op.drop_column("social_campaigns", "tool_ref")
    op.drop_column("social_campaigns", "landing_url")
    op.drop_column("social_campaigns", "from_address")
    op.drop_column("social_campaigns", "pretext_md")
    op.drop_column("social_campaigns", "reported")
    op.drop_column("compromised_users", "spn")
    op.drop_column("compromised_users", "cracked")
    op.drop_column("compromised_users", "hash_type")
    op.drop_column("compromised_users", "source")
    op.drop_column("workstreams", "meta")
