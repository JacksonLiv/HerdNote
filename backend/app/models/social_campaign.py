import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, uuid_pk

CAMPAIGN_TYPES = ("email", "vishing", "smishing", "usb_drop", "other")
CAMPAIGN_STATUSES = ("planned", "active", "complete")


class SocialCampaign(Base, TimestampMixin):
    __tablename__ = "social_campaigns"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    workstream_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workstreams.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    campaign_type: Mapped[str] = mapped_column(String(16), default="email")
    campaign_status: Mapped[str] = mapped_column(String(16), default="planned")
    sent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    clicked: Mapped[int | None] = mapped_column(Integer, nullable=True)
    submitted: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mfa_bypassed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reported: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pretext_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    from_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    landing_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tool_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
