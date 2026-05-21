import uuid
from typing import Any

from pydantic import BaseModel


class AppendixItem(BaseModel):
    type: str  # host_inventory | creds | artifacts | methodology | attack_paths | evidence | oplog | custom
    title: str
    included: bool = True
    custom_md: str | None = None


class ReportOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    exec_summary_md: str | None
    recommendations_md: str | None
    selected_finding_ids: list[str]
    appendix_config: list[dict[str, Any]]
    template_file_path: str | None

    model_config = {"from_attributes": True}


class ReportUpdate(BaseModel):
    exec_summary_md: str | None = None
    recommendations_md: str | None = None
    selected_finding_ids: list[str] | None = None
    appendix_config: list[AppendixItem] | None = None
