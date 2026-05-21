import uuid
from datetime import date

from pydantic import BaseModel, Field

from app.models.workstream import WORKSTREAM_KINDS
from app.schemas.auth import UserOut

KindStr = Field(default="other", pattern="^(" + "|".join(WORKSTREAM_KINDS) + ")$")


class WorkstreamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: str = KindStr
    description_md: str | None = None
    assignee_ids: list[uuid.UUID] = []


class EngagementCreate(BaseModel):
    """Payload from the 3-step Start Pentest wizard."""

    name: str = Field(min_length=1, max_length=160)
    client: str | None = None
    client_id: uuid.UUID | None = None
    type: str = Field(default="pentest", max_length=24)
    status: str = Field(default="active", pattern="^(planning|active|reporting|closed)$")
    start_date: date | None = None
    end_date: date | None = None
    scope_md: str | None = None
    roe_md: str | None = None
    workstreams: list[WorkstreamCreate] = []
    member_ids: list[uuid.UUID] = []


class WorkstreamOut(BaseModel):
    id: uuid.UUID
    name: str
    kind: str
    description_md: str | None
    meta: dict = {}
    assignees: list[UserOut] = []

    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    user: UserOut
    role: str


class EngagementOut(BaseModel):
    id: uuid.UUID
    name: str
    client: str | None
    client_id: uuid.UUID | None = None
    type: str
    status: str
    start_date: date | None
    end_date: date | None
    scope_md: str | None
    roe_md: str | None
    workstreams: list[WorkstreamOut] = []
    members: list[MemberOut] = []

    model_config = {"from_attributes": True}


class EngagementListItem(BaseModel):
    id: uuid.UUID
    name: str
    client: str | None
    type: str
    status: str
    workstream_count: int
    member_count: int

    model_config = {"from_attributes": True}
