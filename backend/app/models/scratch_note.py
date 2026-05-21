import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, uuid_pk


class ScratchNote(Base, TimestampMixin):
    __tablename__ = "scratch_notes"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    workstream_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workstreams.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200), default="Untitled")
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
