import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, uuid_pk


class WebHost(Base, TimestampMixin):
    """A root domain or IP that anchors the web hierarchy."""

    __tablename__ = "web_hosts"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    workstream_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workstreams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    fqdn: Mapped[str] = mapped_column(String(255), index=True)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    in_scope: Mapped[bool] = mapped_column(Boolean, default=True)
    notes_md: Mapped[str | None] = mapped_column(Text, nullable=True)


class WebSubdomain(Base, TimestampMixin):
    """A subdomain belonging to a WebHost, with testing state."""

    __tablename__ = "web_subdomains"

    id: Mapped[uuid.UUID] = uuid_pk()
    host_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("web_hosts.id", ondelete="CASCADE"), index=True
    )
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    workstream_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workstreams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    fqdn: Mapped[str] = mapped_column(String(255), index=True)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tech: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auth: Mapped[str] = mapped_column(String(16), default="unknown")
    in_scope: Mapped[bool] = mapped_column(Boolean, default=True)
    state: Mapped[str] = mapped_column(String(16), default="untouched")
    notes_md: Mapped[str | None] = mapped_column(Text, nullable=True)


class Domain(Base, TimestampMixin):
    """A domain or subdomain in scope (Web/External workstreams)."""

    __tablename__ = "domains"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    workstream_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workstreams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), index=True)
    is_subdomain: Mapped[bool] = mapped_column(Boolean, default=False)
    in_scope: Mapped[bool] = mapped_column(Boolean, default=True)
    notes_md: Mapped[str | None] = mapped_column(Text, nullable=True)


class WebApp(Base, TimestampMixin):
    """A website/app and the host it lives on (Web workstream)."""

    __tablename__ = "webapps"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    workstream_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workstreams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    url: Mapped[str] = mapped_column(String(500))
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    host_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    domain_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("domains.id", ondelete="SET NULL"), nullable=True
    )
    tech_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes_md: Mapped[str | None] = mapped_column(Text, nullable=True)
