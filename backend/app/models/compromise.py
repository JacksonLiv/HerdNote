import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, uuid_pk

PRIVILEGE_LEVELS = (
    "user",
    "local_admin",
    "domain_admin",
    "root",
    "service",
    "other",
)
ARTIFACT_TYPES = (
    "account",
    "webshell",
    "persistence",
    "tool",
    "file",
    "config",
    "other",
)


class CompromisedUser(Base, TimestampMixin):
    """A captured account: who, where obtained, how, and (optionally) the secret."""

    __tablename__ = "compromised_users"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    workstream_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workstreams.id", ondelete="SET NULL"), nullable=True
    )
    username: Mapped[str] = mapped_column(String(160), index=True)
    domain: Mapped[str | None] = mapped_column(String(160), nullable=True)
    privilege: Mapped[str] = mapped_column(String(16), default="user")
    method_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    # AES-GCM ciphertext; never stored or returned in plaintext.
    secret_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    validated: Mapped[bool] = mapped_column(Boolean, default=False)
    notes_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))


class Artifact(Base):
    """Something we introduced into the environment — the cleanup list."""

    __tablename__ = "artifacts"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    workstream_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workstreams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    type: Mapped[str] = mapped_column(String(16), default="other")
    description: Mapped[str] = mapped_column(Text)
    introduced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    introduced_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    removed: Mapped[bool] = mapped_column(Boolean, default=False)
    removed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
