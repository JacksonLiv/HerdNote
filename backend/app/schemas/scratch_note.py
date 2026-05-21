import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ScratchNoteCreate(BaseModel):
    title: str = Field(default="Untitled", max_length=200)
    body: str | None = None


class ScratchNoteUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    body: str | None = None


class ScratchNoteOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    workstream_id: uuid.UUID
    title: str
    body: str | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
