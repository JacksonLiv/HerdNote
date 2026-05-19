"""asset workstream m2m, artifact and oplog workstream

Revision ID: a3e025f53b6b
Revises: 0e37569cf689
Create Date: 2026-05-19 15:08:11.392645
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'a3e025f53b6b'
down_revision: str | None = '0e37569cf689'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "asset_workstreams",
        sa.Column("asset_id", sa.Uuid(), nullable=False),
        sa.Column("workstream_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["workstream_id"], ["workstreams.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("asset_id", "workstream_id"),
    )
    # Backfill the junction from the legacy single workstream_id.
    op.execute(
        "INSERT INTO asset_workstreams (asset_id, workstream_id) "
        "SELECT id, workstream_id FROM assets WHERE workstream_id IS NOT NULL"
    )

    # Batch mode so SQLite (dev/test) can add the FK columns too.
    with op.batch_alter_table("artifacts") as b:
        b.add_column(sa.Column("workstream_id", sa.Uuid(), nullable=True))
        b.create_index(
            b.f("ix_artifacts_workstream_id"), ["workstream_id"], unique=False
        )
        b.create_foreign_key(
            "fk_artifacts_workstream_id",
            "workstreams",
            ["workstream_id"],
            ["id"],
            ondelete="SET NULL",
        )
    with op.batch_alter_table("oplog") as b:
        b.add_column(sa.Column("workstream_id", sa.Uuid(), nullable=True))
        b.create_index(
            b.f("ix_oplog_workstream_id"), ["workstream_id"], unique=False
        )
        b.create_foreign_key(
            "fk_oplog_workstream_id",
            "workstreams",
            ["workstream_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("oplog") as b:
        b.drop_constraint("fk_oplog_workstream_id", type_="foreignkey")
        b.drop_index(b.f("ix_oplog_workstream_id"))
        b.drop_column("workstream_id")
    with op.batch_alter_table("artifacts") as b:
        b.drop_constraint("fk_artifacts_workstream_id", type_="foreignkey")
        b.drop_index(b.f("ix_artifacts_workstream_id"))
        b.drop_column("workstream_id")
    op.drop_table("asset_workstreams")
