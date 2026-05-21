import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, uuid_pk

INJECT_SOURCES = ("remote_email", "in_person", "other")
INJECT_CATEGORIES = (
    "phishing_create",
    "phishing_classify",
    "network_question",
    "general_question",
    "other",
)
INJECT_STATUSES = ("open", "in_progress", "responded", "closed", "deferred")
INJECT_PRIORITIES = ("low", "normal", "high")
INJECT_VERDICTS = ("phishing", "legit", "suspicious", "inconclusive")

INJECT_TEMPLATE_CATEGORIES = INJECT_CATEGORIES + ("pretext",)


class Inject(Base, TimestampMixin):
    """A scenario task pushed to the team (white-team email, walk-up question)."""

    __tablename__ = "inject"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    workstream_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workstreams.id", ondelete="CASCADE"), index=True
    )
    source: Mapped[str] = mapped_column(String(16), default="remote_email")
    arrived_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    received_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    requester: Mapped[str | None] = mapped_column(String(160), nullable=True)
    category: Mapped[str] = mapped_column(String(32), default="general_question", index=True)
    subject: Mapped[str] = mapped_column(String(255))
    body_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    priority: Mapped[str] = mapped_column(String(8), default="normal")
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    response_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    responded_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    attachments: Mapped[list] = mapped_column(JSON, default=list)
    verdict: Mapped[str | None] = mapped_column(String(16), nullable=True)
    inject_number: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    point_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_awarded: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_completeness: Mapped[str | None] = mapped_column(String(20), nullable=True)
    expected_response_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    gap_analysis_md: Mapped[str | None] = mapped_column(Text, nullable=True)


class InjectTemplate(Base, TimestampMixin):
    """Reusable canned response / phishing pretext / FAQ entry."""

    __tablename__ = "inject_template"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=True, index=True
    )
    category: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(255))
    body_md: Mapped[str] = mapped_column(Text)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class MSELEntry(Base, TimestampMixin):
    """Pre-planned scenario event for the Master Scenario Events List."""

    __tablename__ = "msel_entry"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    workstream_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workstreams.id", ondelete="CASCADE"), index=True
    )
    inject_number: Mapped[int] = mapped_column(Integer, index=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    title: Mapped[str] = mapped_column(String(500))
    scenario_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    point_value: Mapped[int] = mapped_column(Integer, default=10)
    expected_response_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    inject_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("inject.id", ondelete="SET NULL"), nullable=True
    )
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
