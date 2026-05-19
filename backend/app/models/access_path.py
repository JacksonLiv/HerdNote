import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk

PATH_STATUS = ("planning", "working", "achieved", "lost")


class AccessPath(Base, TimestampMixin):
    """An ordered, reproducible 'how I got here' chain (and attack narrative)."""

    __tablename__ = "access_paths"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    workstream_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workstreams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    target_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id", ondelete="SET NULL"), nullable=True
    )
    description_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="working")

    steps: Mapped[list["AccessStep"]] = relationship(
        back_populates="path",
        cascade="all, delete-orphan",
        order_by="AccessStep.order_index",
    )


class AccessStep(Base):
    __tablename__ = "access_steps"

    id: Mapped[uuid.UUID] = uuid_pk()
    path_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("access_paths.id", ondelete="CASCADE"), index=True
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    title: Mapped[str] = mapped_column(String(200))
    command_or_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    from_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id", ondelete="SET NULL"), nullable=True
    )
    to_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id", ondelete="SET NULL"), nullable=True
    )
    compromised_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("compromised_users.id", ondelete="SET NULL"), nullable=True
    )
    mitre_technique: Mapped[str | None] = mapped_column(String(16), nullable=True)
    notes_md: Mapped[str | None] = mapped_column(Text, nullable=True)

    path: Mapped[AccessPath] = relationship(back_populates="steps")
