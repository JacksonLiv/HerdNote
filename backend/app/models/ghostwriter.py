from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GhostwriterSettings(Base):
    """Singleton system-wide Ghostwriter integration config (row id always 1)."""

    __tablename__ = "ghostwriter_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    api_token: Mapped[str | None] = mapped_column(String(512), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
