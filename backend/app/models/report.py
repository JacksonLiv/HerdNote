import uuid

from sqlalchemy import ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk


class EngagementReport(Base, TimestampMixin):
    """One report configuration per engagement (1:1)."""

    __tablename__ = "engagement_reports"
    __table_args__ = (UniqueConstraint("engagement_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), index=True
    )

    exec_summary_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendations_md: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Ordered list of finding UUIDs selected for inclusion.
    selected_finding_ids: Mapped[list] = mapped_column(JSON, default=list)

    # List of appendix config objects:
    # [{type, title, included, custom_md}]
    appendix_config: Mapped[list] = mapped_column(JSON, default=list)

    # Path on disk to the uploaded .docx template.
    template_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
