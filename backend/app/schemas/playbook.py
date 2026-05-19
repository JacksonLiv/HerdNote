import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.playbook import PLAYBOOK_STATUSES

_STATUS_PATTERN = "^(" + "|".join(PLAYBOOK_STATUSES) + ")$"


class PlaybookStateUpsert(BaseModel):
    status: str | None = Field(default=None, pattern=_STATUS_PATTERN)
    notes_md: str | None = None


class PlaybookStateOut(BaseModel):
    id: uuid.UUID
    workstream_id: uuid.UUID
    task_key: str
    status: str
    notes_md: str | None
    updated_at: datetime
    updated_by: uuid.UUID | None

    model_config = {"from_attributes": True}


class WorkstreamNoteCreate(BaseModel):
    category: str = Field(min_length=1, max_length=64)
    task_key: str | None = Field(default=None, max_length=128)
    title: str = Field(min_length=1, max_length=255)
    body_md: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)


class WorkstreamNoteUpdate(BaseModel):
    category: str | None = Field(default=None, min_length=1, max_length=64)
    task_key: str | None = Field(default=None, max_length=128)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    body_md: str | None = None
    data: dict[str, Any] | None = None


class WorkstreamNoteOut(BaseModel):
    id: uuid.UUID
    workstream_id: uuid.UUID
    category: str
    task_key: str | None
    title: str
    body_md: str | None
    data: dict[str, Any]
    created_at: datetime
    created_by: uuid.UUID | None

    model_config = {"from_attributes": True}


class PlaybookEnvelope(BaseModel):
    state: list[PlaybookStateOut]
    notes: list[WorkstreamNoteOut]
