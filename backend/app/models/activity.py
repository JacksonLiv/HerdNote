import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, uuid_pk


class ActivityLogEntry(Base):
    """Timestamped operator action — audit trail + deconfliction + narrative."""

    __tablename__ = "activity_log"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    operator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    action_type: Mapped[str] = mapped_column(String(32), default="note")
    target_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    workstream_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workstreams.id", ondelete="SET NULL"), nullable=True
    )
    source_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    command: Mapped[str | None] = mapped_column(Text, nullable=True)
    mitre_technique: Mapped[str | None] = mapped_column(String(16), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
