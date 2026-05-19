import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, uuid_pk

# Entities a piece of evidence can hang off.
EVIDENCE_PARENTS = (
    "asset",
    "credential",
    "compromised_user",
    "finding",
    "step",
    "activity",
    "artifact",
)


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    parent_type: Mapped[str] = mapped_column(String(20), index=True)
    parent_id: Mapped[uuid.UUID] = mapped_column(index=True)
    filename: Mapped[str] = mapped_column(String(255))
    stored_path: Mapped[str] = mapped_column(Text)
    content_type: Mapped[str] = mapped_column(String(120), default="application/octet-stream")
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
