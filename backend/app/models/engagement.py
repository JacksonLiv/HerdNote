import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk


class Engagement(Base, TimestampMixin):
    __tablename__ = "engagements"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(160), index=True)
    # Free-text label (legacy) + optional link to a managed Client.
    client: Mapped[str | None] = mapped_column(String(160), nullable=True)
    client_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    # pentest | redteam | webapp | external | internal | other
    type: Mapped[str] = mapped_column(String(24), default="pentest")
    # planning | active | reporting | closed
    status: Mapped[str] = mapped_column(String(16), default="active")
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    scope_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    roe_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    workstreams: Mapped[list["Workstream"]] = relationship(
        back_populates="engagement", cascade="all, delete-orphan"
    )
    members: Mapped[list["EngagementMember"]] = relationship(
        back_populates="engagement", cascade="all, delete-orphan"
    )


class EngagementMember(Base):
    __tablename__ = "engagement_members"
    __table_args__ = (UniqueConstraint("engagement_id", "user_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # lead | operator
    role: Mapped[str] = mapped_column(String(16), default="operator")

    engagement: Mapped[Engagement] = relationship(back_populates="members")


# Imported at module end to avoid circular import at definition time.
from app.models.workstream import Workstream  # noqa: E402
