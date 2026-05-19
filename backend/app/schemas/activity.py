import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ActivityCreate(BaseModel):
    description: str = Field(min_length=1)
    action_type: str = Field(default="note", max_length=32)
    target_asset_id: uuid.UUID | None = None
    workstream_id: uuid.UUID | None = None
    command: str | None = None
    source_ip: str | None = None
    mitre_technique: str | None = None


class ActivityOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    operator_id: uuid.UUID
    operator_name: str
    ts: datetime
    action_type: str
    target_asset_id: uuid.UUID | None
    workstream_id: uuid.UUID | None
    command: str | None
    source_ip: str | None
    mitre_technique: str | None
    description: str

    model_config = {"from_attributes": True}
