import uuid

from pydantic import BaseModel, Field

from app.models.access_path import PATH_STATUS

StatusField = Field(default="working", pattern="^(" + "|".join(PATH_STATUS) + ")$")


class StepCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    command_or_action: str | None = None
    expected_result: str | None = None
    from_asset_id: uuid.UUID | None = None
    to_asset_id: uuid.UUID | None = None
    compromised_user_id: uuid.UUID | None = None
    mitre_technique: str | None = None
    notes_md: str | None = None


class StepUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    command_or_action: str | None = None
    expected_result: str | None = None
    from_asset_id: uuid.UUID | None = None
    to_asset_id: uuid.UUID | None = None
    compromised_user_id: uuid.UUID | None = None
    mitre_technique: str | None = None
    notes_md: str | None = None


class StepOut(BaseModel):
    id: uuid.UUID
    path_id: uuid.UUID
    order_index: int
    title: str
    command_or_action: str | None
    expected_result: str | None
    from_asset_id: uuid.UUID | None
    to_asset_id: uuid.UUID | None
    compromised_user_id: uuid.UUID | None
    mitre_technique: str | None
    notes_md: str | None

    model_config = {"from_attributes": True}


class PathCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    workstream_id: uuid.UUID | None = None
    target_asset_id: uuid.UUID | None = None
    description_md: str | None = None
    status: str = StatusField


class PathUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    workstream_id: uuid.UUID | None = None
    target_asset_id: uuid.UUID | None = None
    description_md: str | None = None
    status: str | None = Field(default=None, pattern="^(" + "|".join(PATH_STATUS) + ")$")


class PathOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    name: str
    workstream_id: uuid.UUID | None
    target_asset_id: uuid.UUID | None
    description_md: str | None
    status: str
    steps: list[StepOut] = []

    model_config = {"from_attributes": True}


class ReorderIn(BaseModel):
    """Ordered list of step IDs defining the new sequence."""

    step_ids: list[uuid.UUID]


class GraphElement(BaseModel):
    data: dict
    group: str  # "nodes" | "edges"


class GraphOut(BaseModel):
    elements: list[GraphElement]
