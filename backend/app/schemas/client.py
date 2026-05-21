import uuid

from pydantic import BaseModel, Field


class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    role: str | None = None
    email: str | None = None
    phone: str | None = None
    notes_md: str | None = None


class ContactOut(ContactCreate):
    id: uuid.UUID
    client_id: uuid.UUID

    model_config = {"from_attributes": True}


class ContactPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    role: str | None = None
    email: str | None = None
    phone: str | None = None
    notes_md: str | None = None


class ClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    short_name: str | None = None
    notes_md: str | None = None


class ClientPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    short_name: str | None = None
    notes_md: str | None = None


class ClientOut(BaseModel):
    id: uuid.UUID
    name: str
    short_name: str | None
    notes_md: str | None
    contacts: list[ContactOut] = []

    model_config = {"from_attributes": True}
