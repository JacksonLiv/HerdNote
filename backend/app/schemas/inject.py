import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.inject import (
    INJECT_CATEGORIES,
    INJECT_PRIORITIES,
    INJECT_SOURCES,
    INJECT_STATUSES,
    INJECT_TEMPLATE_CATEGORIES,
    INJECT_VERDICTS,
)

_SOURCE = "^(" + "|".join(INJECT_SOURCES) + ")$"
_CATEGORY = "^(" + "|".join(INJECT_CATEGORIES) + ")$"
_STATUS = "^(" + "|".join(INJECT_STATUSES) + ")$"
_PRIORITY = "^(" + "|".join(INJECT_PRIORITIES) + ")$"
_VERDICT = "^(" + "|".join(INJECT_VERDICTS) + ")$"
_TEMPLATE_CATEGORY = "^(" + "|".join(INJECT_TEMPLATE_CATEGORIES) + ")$"


class InjectCreate(BaseModel):
    workstream_id: uuid.UUID
    source: str = Field(default="remote_email", pattern=_SOURCE)
    requester: str | None = Field(default=None, max_length=160)
    category: str = Field(default="general_question", pattern=_CATEGORY)
    subject: str = Field(min_length=1, max_length=255)
    body_md: str | None = None
    deadline: datetime | None = None
    priority: str = Field(default="normal", pattern=_PRIORITY)
    assigned_to: uuid.UUID | None = None


class InjectUpdate(BaseModel):
    workstream_id: uuid.UUID | None = None
    source: str | None = Field(default=None, pattern=_SOURCE)
    requester: str | None = Field(default=None, max_length=160)
    category: str | None = Field(default=None, pattern=_CATEGORY)
    subject: str | None = Field(default=None, min_length=1, max_length=255)
    body_md: str | None = None
    deadline: datetime | None = None
    status: str | None = Field(default=None, pattern=_STATUS)
    priority: str | None = Field(default=None, pattern=_PRIORITY)
    assigned_to: uuid.UUID | None = None
    response_md: str | None = None
    verdict: str | None = Field(default=None, pattern=_VERDICT)


class InjectOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    workstream_id: uuid.UUID
    source: str
    arrived_at: datetime
    received_by: uuid.UUID | None
    requester: str | None
    category: str
    subject: str
    body_md: str | None
    deadline: datetime | None
    status: str
    priority: str
    assigned_to: uuid.UUID | None
    response_md: str | None
    responded_at: datetime | None
    responded_by: uuid.UUID | None
    attachments: list[dict[str, Any]]
    verdict: str | None

    model_config = {"from_attributes": True}


class InjectTemplateCreate(BaseModel):
    category: str = Field(pattern=_TEMPLATE_CATEGORY)
    title: str = Field(min_length=1, max_length=255)
    body_md: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)
    is_global: bool = False


class InjectTemplateUpdate(BaseModel):
    category: str | None = Field(default=None, pattern=_TEMPLATE_CATEGORY)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    body_md: str | None = Field(default=None, min_length=1)
    tags: list[str] | None = None


class InjectTemplateOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID | None
    category: str
    title: str
    body_md: str
    tags: list[str]
    created_at: datetime
    created_by: uuid.UUID | None

    model_config = {"from_attributes": True}
