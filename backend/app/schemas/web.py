import uuid
from datetime import datetime

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


# ── WebHost ──────────────────────────────────────────────────────────────────


class WebHostCreate(BaseModel):
    fqdn: str = Field(min_length=1, max_length=255)
    ip: str | None = None
    in_scope: bool = True
    notes_md: str | None = None
    workstream_id: uuid.UUID | None = None


class WebHostUpdate(BaseModel):
    fqdn: str | None = Field(default=None, min_length=1, max_length=255)
    ip: str | None = None
    in_scope: bool | None = None
    notes_md: str | None = None
    workstream_id: uuid.UUID | None = None


class WebHostOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    workstream_id: uuid.UUID | None
    fqdn: str
    ip: str | None
    in_scope: bool
    notes_md: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── WebSubdomain ─────────────────────────────────────────────────────────────


class WebSubdomainCreate(BaseModel):
    host_id: uuid.UUID
    fqdn: str = Field(min_length=1, max_length=255)
    ip: str | None = None
    status_code: int | None = None
    title: str | None = None
    tech: str | None = None
    auth: str = "unknown"
    in_scope: bool = True
    state: str = "untouched"
    notes_md: str | None = None
    workstream_id: uuid.UUID | None = None


class WebSubdomainUpdate(BaseModel):
    fqdn: str | None = None
    ip: str | None = None
    status_code: int | None = None
    title: str | None = None
    tech: str | None = None
    auth: str | None = None
    in_scope: bool | None = None
    state: str | None = None
    notes_md: str | None = None


class WebSubdomainOut(BaseModel):
    id: uuid.UUID
    host_id: uuid.UUID
    engagement_id: uuid.UUID
    workstream_id: uuid.UUID | None
    fqdn: str
    ip: str | None
    status_code: int | None
    title: str | None
    tech: str | None
    auth: str
    in_scope: bool
    state: str
    notes_md: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WebSubdomainBulkCreate(BaseModel):
    host_id: uuid.UUID
    text: str = Field(min_length=1)
    workstream_id: uuid.UUID | None = None
