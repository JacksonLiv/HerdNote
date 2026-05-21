import uuid

from sqlalchemy import JSON, Boolean, Column, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk

ASSET_TYPES = (
    "host", "webapp", "url", "network", "account", "cloud",
    "ap", "ssid", "site", "building", "floor", "door", "attempt",
    "target", "client", "loot", "evidence", "iam_entity",
    "ad_user", "ad_computer", "ad_group", "ad_gpo",
    "share", "cloud_resource",
)
ASSET_STATES = ("untouched", "enumerated", "exploited", "compromised", "cleaned")

# A host can belong to many workstreams (AD + Web), and vice-versa.
asset_workstreams = Table(
    "asset_workstreams",
    Base.metadata,
    Column(
        "asset_id",
        ForeignKey("assets.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "workstream_id",
        ForeignKey("workstreams.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Asset(Base, TimestampMixin):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    # Legacy single column kept for back-compat; M2M below is authoritative.
    workstream_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workstreams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    type: Mapped[str] = mapped_column(String(16), default="host")
    identifier: Mapped[str] = mapped_column(String(255), index=True)
    os: Mapped[str | None] = mapped_column(String(120), nullable=True)
    services: Mapped[list] = mapped_column(JSON, default=list)
    in_scope: Mapped[bool] = mapped_column(Boolean, default=True)
    state: Mapped[str] = mapped_column(String(16), default="untouched")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    notes_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    owner_op: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id", ondelete="CASCADE"), nullable=True, index=True
    )

    workstreams: Mapped[list["Workstream"]] = relationship(  # noqa: F821
        secondary=asset_workstreams, lazy="selectin"
    )
