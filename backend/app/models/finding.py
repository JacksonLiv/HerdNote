import uuid

from sqlalchemy import JSON, Column, Float, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk

SEVERITIES = ("critical", "high", "medium", "low", "informational")
FINDING_STATUS = ("draft", "open", "remediated", "accepted", "false_positive")

# M2M: a finding can affect many assets.
finding_assets = Table(
    "finding_assets",
    Base.metadata,
    Column(
        "finding_id",
        ForeignKey("findings.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "asset_id",
        ForeignKey("assets.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class FindingTemplate(Base):
    """Reusable, engagement-independent finding boilerplate library."""

    __tablename__ = "finding_templates"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(200), unique=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    severity_default: Mapped[str] = mapped_column(String(16), default="medium")
    cwe: Mapped[str | None] = mapped_column(String(16), nullable=True)
    finding_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    description_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    impact_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    remediation_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    host_detection_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    network_detection_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    references_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Internal-only: how/when to use this template (not for reports).
    finding_guidance_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSON, default=list)


class FindingDraft(Base, TimestampMixin):
    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )
    workstream_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workstreams.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(240))
    severity: Mapped[str] = mapped_column(String(16), default="medium")
    status: Mapped[str] = mapped_column(String(16), default="draft")
    cvss_vector: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cvss_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    cwe: Mapped[str | None] = mapped_column(String(16), nullable=True)
    cve: Mapped[str | None] = mapped_column(String(24), nullable=True)
    finding_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    description_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    impact_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    reproduction_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    remediation_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    host_detection_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    network_detection_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    references_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("finding_templates.id", ondelete="SET NULL"), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    assets: Mapped[list["Asset"]] = relationship(  # noqa: F821
        secondary=finding_assets, lazy="selectin"
    )
