import uuid

from sqlalchemy import JSON, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, uuid_pk

PLAYBOOK_STATUSES = ("todo", "in_progress", "done", "na")


class PlaybookState(Base, TimestampMixin):
    """Per-workstream check/skip status for a static-catalog playbook task."""

    __tablename__ = "playbook_state"
    __table_args__ = (UniqueConstraint("workstream_id", "task_key"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    workstream_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workstreams.id", ondelete="CASCADE"), index=True
    )
    task_key: Mapped[str] = mapped_column(String(128), index=True)
    status: Mapped[str] = mapped_column(String(16), default="todo")
    notes_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class WorkstreamNote(Base, TimestampMixin):
    """Structured capture against a workstream's playbook category."""

    __tablename__ = "workstream_note"

    id: Mapped[uuid.UUID] = uuid_pk()
    workstream_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workstreams.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(64), index=True)
    task_key: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    body_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
