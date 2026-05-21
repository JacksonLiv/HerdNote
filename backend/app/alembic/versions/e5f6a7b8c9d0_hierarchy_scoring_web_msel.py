"""hierarchy, scoring, web hosts/subdomains, msel

Revision ID: e5f6a7b8c9d0
Revises: c3d4e5f6a7b8
Create Date: 2026-05-20

"""
import sqlalchemy as sa
from alembic import op

revision = "e5f6a7b8c9d0"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── assets: parent_id for hierarchical nesting ──────────────────────────
    op.add_column(
        "assets",
        sa.Column("parent_id", sa.UUID(), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=True),
    )
    op.create_index("ix_assets_parent_id", "assets", ["parent_id"])

    # ── inject: scoring + MSEL linkage fields ───────────────────────────────
    op.add_column("inject", sa.Column("inject_number", sa.Integer(), nullable=True))
    op.add_column("inject", sa.Column("point_value", sa.Integer(), nullable=True))
    op.add_column("inject", sa.Column("score_awarded", sa.Integer(), nullable=True))
    op.add_column("inject", sa.Column("score_completeness", sa.String(20), nullable=True))
    op.add_column("inject", sa.Column("expected_response_md", sa.Text(), nullable=True))
    op.add_column("inject", sa.Column("gap_analysis_md", sa.Text(), nullable=True))
    op.create_index("ix_inject_inject_number", "inject", ["inject_number"])

    # ── web_hosts ────────────────────────────────────────────────────────────
    op.create_table(
        "web_hosts",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("engagement_id", sa.UUID(), sa.ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("workstream_id", sa.UUID(), sa.ForeignKey("workstreams.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("fqdn", sa.String(255), nullable=False, index=True),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("in_scope", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notes_md", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── web_subdomains ───────────────────────────────────────────────────────
    op.create_table(
        "web_subdomains",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("host_id", sa.UUID(), sa.ForeignKey("web_hosts.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("engagement_id", sa.UUID(), sa.ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("workstream_id", sa.UUID(), sa.ForeignKey("workstreams.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("fqdn", sa.String(255), nullable=False, index=True),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("tech", sa.String(255), nullable=True),
        sa.Column("auth", sa.String(16), nullable=False, server_default="unknown"),
        sa.Column("in_scope", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("state", sa.String(16), nullable=False, server_default="untouched"),
        sa.Column("notes_md", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── msel_entry ───────────────────────────────────────────────────────────
    op.create_table(
        "msel_entry",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("engagement_id", sa.UUID(), sa.ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("workstream_id", sa.UUID(), sa.ForeignKey("workstreams.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("inject_number", sa.Integer(), nullable=False, index=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("scenario_md", sa.Text(), nullable=True),
        sa.Column("point_value", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("expected_response_md", sa.Text(), nullable=True),
        sa.Column("inject_id", sa.UUID(), sa.ForeignKey("inject.id", ondelete="SET NULL"), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("msel_entry")
    op.drop_table("web_subdomains")
    op.drop_table("web_hosts")
    op.drop_index("ix_inject_inject_number", table_name="inject")
    op.drop_column("inject", "gap_analysis_md")
    op.drop_column("inject", "expected_response_md")
    op.drop_column("inject", "score_completeness")
    op.drop_column("inject", "score_awarded")
    op.drop_column("inject", "point_value")
    op.drop_column("inject", "inject_number")
    op.drop_index("ix_assets_parent_id", table_name="assets")
    op.drop_column("assets", "parent_id")
