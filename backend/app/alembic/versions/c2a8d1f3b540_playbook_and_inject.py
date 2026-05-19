"""playbook and inject

Revision ID: c2a8d1f3b540
Revises: 0e37569cf689
Create Date: 2026-05-19 17:30:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "c2a8d1f3b540"
down_revision: str | None = "a3e025f53b6b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "playbook_state",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workstream_id", sa.Uuid(), nullable=False),
        sa.Column("task_key", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("notes_md", sa.Text(), nullable=True),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["workstream_id"], ["workstreams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workstream_id", "task_key"),
    )
    op.create_index(
        op.f("ix_playbook_state_workstream_id"),
        "playbook_state",
        ["workstream_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_playbook_state_task_key"),
        "playbook_state",
        ["task_key"],
        unique=False,
    )

    op.create_table(
        "workstream_note",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workstream_id", sa.Uuid(), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("task_key", sa.String(length=128), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body_md", sa.Text(), nullable=True),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["workstream_id"], ["workstreams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_workstream_note_workstream_id"),
        "workstream_note",
        ["workstream_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_workstream_note_category"),
        "workstream_note",
        ["category"],
        unique=False,
    )
    op.create_index(
        op.f("ix_workstream_note_task_key"),
        "workstream_note",
        ["task_key"],
        unique=False,
    )

    op.create_table(
        "inject",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("engagement_id", sa.Uuid(), nullable=False),
        sa.Column("workstream_id", sa.Uuid(), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column(
            "arrived_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column("received_by", sa.Uuid(), nullable=True),
        sa.Column("requester", sa.String(length=160), nullable=True),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("body_md", sa.Text(), nullable=True),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("priority", sa.String(length=8), nullable=False),
        sa.Column("assigned_to", sa.Uuid(), nullable=True),
        sa.Column("response_md", sa.Text(), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("responded_by", sa.Uuid(), nullable=True),
        sa.Column("attachments", sa.JSON(), nullable=False),
        sa.Column("verdict", sa.String(length=16), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["engagement_id"], ["engagements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workstream_id"], ["workstreams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["received_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["responded_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_inject_engagement_id"), "inject", ["engagement_id"], unique=False)
    op.create_index(op.f("ix_inject_workstream_id"), "inject", ["workstream_id"], unique=False)
    op.create_index(op.f("ix_inject_arrived_at"), "inject", ["arrived_at"], unique=False)
    op.create_index(op.f("ix_inject_deadline"), "inject", ["deadline"], unique=False)
    op.create_index(op.f("ix_inject_status"), "inject", ["status"], unique=False)
    op.create_index(op.f("ix_inject_category"), "inject", ["category"], unique=False)

    op.create_table(
        "inject_template",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("engagement_id", sa.Uuid(), nullable=True),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body_md", sa.Text(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["engagement_id"], ["engagements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_inject_template_engagement_id"),
        "inject_template",
        ["engagement_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_inject_template_category"),
        "inject_template",
        ["category"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_inject_template_category"), table_name="inject_template")
    op.drop_index(op.f("ix_inject_template_engagement_id"), table_name="inject_template")
    op.drop_table("inject_template")
    op.drop_index(op.f("ix_inject_category"), table_name="inject")
    op.drop_index(op.f("ix_inject_status"), table_name="inject")
    op.drop_index(op.f("ix_inject_deadline"), table_name="inject")
    op.drop_index(op.f("ix_inject_arrived_at"), table_name="inject")
    op.drop_index(op.f("ix_inject_workstream_id"), table_name="inject")
    op.drop_index(op.f("ix_inject_engagement_id"), table_name="inject")
    op.drop_table("inject")
    op.drop_index(op.f("ix_workstream_note_task_key"), table_name="workstream_note")
    op.drop_index(op.f("ix_workstream_note_category"), table_name="workstream_note")
    op.drop_index(op.f("ix_workstream_note_workstream_id"), table_name="workstream_note")
    op.drop_table("workstream_note")
    op.drop_index(op.f("ix_playbook_state_task_key"), table_name="playbook_state")
    op.drop_index(op.f("ix_playbook_state_workstream_id"), table_name="playbook_state")
    op.drop_table("playbook_state")
