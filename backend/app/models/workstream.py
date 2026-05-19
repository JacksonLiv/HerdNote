import uuid

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, uuid_pk

# Kinds of work area an engagement can be split into.
WORKSTREAM_KINDS = (
    "active_directory",
    "web",
    "external",
    "internal",
    "wireless",
    "cloud",
    "social",
    "physical",
    "other",
)


class Workstream(Base):
    __tablename__ = "workstreams"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(24), default="other")
    description_md: Mapped[str | None] = mapped_column(Text, nullable=True)

    engagement: Mapped["Engagement"] = relationship(back_populates="workstreams")
    assignments: Mapped[list["WorkstreamAssignment"]] = relationship(
        back_populates="workstream", cascade="all, delete-orphan"
    )


class WorkstreamAssignment(Base):
    __tablename__ = "workstream_assignments"
    __table_args__ = (UniqueConstraint("workstream_id", "user_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    workstream_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workstreams.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    workstream: Mapped[Workstream] = relationship(back_populates="assignments")


from app.models.engagement import Engagement  # noqa: E402,F401
