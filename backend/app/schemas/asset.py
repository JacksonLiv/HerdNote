import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.asset import ASSET_STATES, ASSET_TYPES

TypeField = Field(default="host", pattern="^(" + "|".join(ASSET_TYPES) + ")$")
StateField = Field(default="untouched", pattern="^(" + "|".join(ASSET_STATES) + ")$")


class AssetCreate(BaseModel):
    type: str = TypeField
    identifier: str = Field(min_length=1, max_length=255)
    workstream_ids: list[uuid.UUID] = []
    os: str | None = None
    in_scope: bool = True


class BulkAssetCreate(BaseModel):
    """Paste-a-list bulk add — the highest-frequency action."""

    text: str = Field(min_length=1)
    workstream_ids: list[uuid.UUID] = []


class AssetUpdate(BaseModel):
    type: str | None = Field(default=None, pattern="^(" + "|".join(ASSET_TYPES) + ")$")
    identifier: str | None = Field(default=None, min_length=1, max_length=255)
    workstream_ids: list[uuid.UUID] | None = None
    os: str | None = None
    in_scope: bool | None = None
    state: str | None = Field(default=None, pattern="^(" + "|".join(ASSET_STATES) + ")$")
    tags: list[str] | None = None
    notes_md: str | None = None


class WorkstreamRef(BaseModel):
    id: uuid.UUID
    name: str
    kind: str

    model_config = {"from_attributes": True}


class AssetOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    workstreams: list[WorkstreamRef] = []
    workstream_ids: list[uuid.UUID] = []
    type: str
    identifier: str
    os: str | None
    services: list
    in_scope: bool
    state: str
    tags: list
    notes_md: str | None
    owner_op: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
