import uuid

from pydantic import BaseModel, Field


class DomainCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    workstream_id: uuid.UUID | None = None
    is_subdomain: bool = False
    in_scope: bool = True
    notes_md: str | None = None


class DomainUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    workstream_id: uuid.UUID | None = None
    is_subdomain: bool | None = None
    in_scope: bool | None = None
    notes_md: str | None = None


class DomainOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    workstream_id: uuid.UUID | None
    name: str
    is_subdomain: bool
    in_scope: bool
    notes_md: str | None

    model_config = {"from_attributes": True}


class WebAppCreate(BaseModel):
    url: str = Field(min_length=1, max_length=500)
    workstream_id: uuid.UUID | None = None
    name: str | None = None
    host_asset_id: uuid.UUID | None = None
    domain_id: uuid.UUID | None = None
    tech_md: str | None = None
    notes_md: str | None = None


class WebAppUpdate(BaseModel):
    url: str | None = Field(default=None, min_length=1, max_length=500)
    workstream_id: uuid.UUID | None = None
    name: str | None = None
    host_asset_id: uuid.UUID | None = None
    domain_id: uuid.UUID | None = None
    tech_md: str | None = None
    notes_md: str | None = None


class WebAppOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    workstream_id: uuid.UUID | None
    url: str
    name: str | None
    host_asset_id: uuid.UUID | None
    domain_id: uuid.UUID | None
    tech_md: str | None
    notes_md: str | None

    model_config = {"from_attributes": True}
