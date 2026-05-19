import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.infra import INFRA_KINDS, INFRA_STATUS

KindF = Field(default="other", pattern="^(" + "|".join(INFRA_KINDS) + ")$")
StatusF = Field(default="active", pattern="^(" + "|".join(INFRA_STATUS) + ")$")


class InfraCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    kind: str = KindF
    provider: str | None = None
    status: str = StatusF
    role: str | None = None
    notes_md: str | None = None


class InfraUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    kind: str | None = Field(default=None, pattern="^(" + "|".join(INFRA_KINDS) + ")$")
    provider: str | None = None
    status: str | None = Field(
        default=None, pattern="^(" + "|".join(INFRA_STATUS) + ")$"
    )
    role: str | None = None
    notes_md: str | None = None


class InfraOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    name: str
    kind: str
    provider: str | None
    status: str
    role: str | None
    notes_md: str | None

    model_config = {"from_attributes": True}


class OplogCreate(BaseModel):
    description: str = Field(min_length=1)
    workstream_id: uuid.UUID | None = None
    source_host: str | None = None
    dest_host: str | None = None
    tool: str | None = None
    command: str | None = None
    output: str | None = None
    mitre_technique: str | None = None


class OplogOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    operator_id: uuid.UUID
    operator_name: str
    workstream_id: uuid.UUID | None
    ts: datetime
    source_host: str | None
    dest_host: str | None
    tool: str | None
    command: str | None
    output: str | None
    mitre_technique: str | None
    description: str
