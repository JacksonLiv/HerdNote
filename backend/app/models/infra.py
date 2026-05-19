import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, uuid_pk

INFRA_KINDS = ("domain", "c2_server", "redirector", "vps", "phishing", "other")
INFRA_STATUS = ("planned", "active", "burned", "retired")


class Infrastructure(Base, TimestampMixin):
    """Covert red-team infrastructure (Ghostwriter-style)."""

    __tablename__ = "infrastructure"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(16), default="other")
    name: Mapped[str] = mapped_column(String(255), index=True)  # domain / IP / host
    provider: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")
    role: Mapped[str | None] = mapped_column(String(160), nullable=True)
    notes_md: Mapped[str | None] = mapped_column(Text, nullable=True)


class OplogEntry(Base):
    """Structured operation-log line (Ghostwriter oplog-compatible)."""

    __tablename__ = "oplog"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    operator_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    workstream_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workstreams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    source_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dest_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tool: Mapped[str | None] = mapped_column(String(120), nullable=True)
    command: Mapped[str | None] = mapped_column(Text, nullable=True)
    output: Mapped[str | None] = mapped_column(Text, nullable=True)
    mitre_technique: Mapped[str | None] = mapped_column(String(16), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
