import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk


class Client(Base, TimestampMixin):
    """An organization engagements are run for (Ghostwriter-style)."""

    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    short_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes_md: Mapped[str | None] = mapped_column(Text, nullable=True)

    contacts: Mapped[list["ClientContact"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )


class ClientContact(Base):
    __tablename__ = "client_contacts"

    id: Mapped[uuid.UUID] = uuid_pk()
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str | None] = mapped_column(String(120), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(60), nullable=True)
    notes_md: Mapped[str | None] = mapped_column(Text, nullable=True)

    client: Mapped[Client] = relationship(back_populates="contacts")
