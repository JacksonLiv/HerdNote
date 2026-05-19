"""access_path workstream_id

Revision ID: 79e70ed75087
Revises: f55019d3554d
Create Date: 2026-05-19 13:53:36.546627
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '79e70ed75087'
down_revision: str | None = 'f55019d3554d'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Batch mode so SQLite (dev/test) can add the column + FK too.
    with op.batch_alter_table("access_paths") as batch:
        batch.add_column(sa.Column("workstream_id", sa.Uuid(), nullable=True))
        batch.create_index(
            batch.f("ix_access_paths_workstream_id"), ["workstream_id"], unique=False
        )
        batch.create_foreign_key(
            "fk_access_paths_workstream_id",
            "workstreams",
            ["workstream_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("access_paths") as batch:
        batch.drop_constraint("fk_access_paths_workstream_id", type_="foreignkey")
        batch.drop_index(batch.f("ix_access_paths_workstream_id"))
        batch.drop_column("workstream_id")
