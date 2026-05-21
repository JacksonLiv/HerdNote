"""finding writing status: not_done / draft / done

Revision ID: b1c2d3e4f5a6
Revises: a1c2d3e4f5a6
Create Date: 2026-05-21
"""

from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: str | None = "a1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Map old remediation-tracking statuses → writing-completion statuses.
    # "draft" stays "draft" (partially written).
    # Anything else (open / remediated / accepted / false_positive) → "not_done".
    op.execute("""
        UPDATE findings
        SET status = CASE
            WHEN status = 'draft'        THEN 'draft'
            WHEN status = 'done'         THEN 'done'
            WHEN status = 'not_done'     THEN 'not_done'
            ELSE 'not_done'
        END
    """)

    # Update the column default so new findings start as "not_done".
    op.execute("""
        ALTER TABLE findings
            ALTER COLUMN status SET DEFAULT 'not_done'
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE findings
        SET status = CASE
            WHEN status = 'done'     THEN 'remediated'
            WHEN status = 'draft'    THEN 'draft'
            ELSE 'open'
        END
    """)
    op.execute("""
        ALTER TABLE findings
            ALTER COLUMN status SET DEFAULT 'draft'
    """)
