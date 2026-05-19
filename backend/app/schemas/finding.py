import uuid

from pydantic import BaseModel, Field

from app.models.finding import FINDING_STATUS, SEVERITIES

SevField = Field(default="medium", pattern="^(" + "|".join(SEVERITIES) + ")$")
StatusField = Field(default="draft", pattern="^(" + "|".join(FINDING_STATUS) + ")$")


# --- templates (Ghostwriter-style findings library) ---
class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str | None = None
    finding_type: str | None = None
    severity_default: str = SevField
    cwe: str | None = None
    description_md: str | None = None
    impact_md: str | None = None
    remediation_md: str | None = None
    host_detection_md: str | None = None
    network_detection_md: str | None = None
    references_md: str | None = None
    finding_guidance_md: str | None = None
    tags: list[str] = []


class TemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = None
    finding_type: str | None = None
    severity_default: str | None = Field(
        default=None, pattern="^(" + "|".join(SEVERITIES) + ")$"
    )
    cwe: str | None = None
    description_md: str | None = None
    impact_md: str | None = None
    remediation_md: str | None = None
    host_detection_md: str | None = None
    network_detection_md: str | None = None
    references_md: str | None = None
    finding_guidance_md: str | None = None
    tags: list[str] | None = None


class TemplateOut(TemplateCreate):
    id: uuid.UUID

    model_config = {"from_attributes": True}


# --- findings ---
class FindingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    severity: str = SevField
    status: str = StatusField
    workstream_id: uuid.UUID | None = None
    finding_type: str | None = None
    cvss_vector: str | None = None
    cvss_score: float | None = None
    cwe: str | None = None
    cve: str | None = None
    description_md: str | None = None
    impact_md: str | None = None
    reproduction_md: str | None = None
    remediation_md: str | None = None
    host_detection_md: str | None = None
    network_detection_md: str | None = None
    references_md: str | None = None
    tags: list[str] = []
    template_id: uuid.UUID | None = None
    asset_ids: list[uuid.UUID] = []


class FindingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    severity: str | None = Field(default=None, pattern="^(" + "|".join(SEVERITIES) + ")$")
    status: str | None = Field(
        default=None, pattern="^(" + "|".join(FINDING_STATUS) + ")$"
    )
    workstream_id: uuid.UUID | None = None
    finding_type: str | None = None
    cvss_vector: str | None = None
    cvss_score: float | None = None
    cwe: str | None = None
    cve: str | None = None
    description_md: str | None = None
    impact_md: str | None = None
    reproduction_md: str | None = None
    remediation_md: str | None = None
    host_detection_md: str | None = None
    network_detection_md: str | None = None
    references_md: str | None = None
    tags: list[str] | None = None
    asset_ids: list[uuid.UUID] | None = None


class FindingOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    workstream_id: uuid.UUID | None
    title: str
    severity: str
    status: str
    finding_type: str | None
    cvss_vector: str | None
    cvss_score: float | None
    cwe: str | None
    cve: str | None
    description_md: str | None
    impact_md: str | None
    reproduction_md: str | None
    remediation_md: str | None
    host_detection_md: str | None
    network_detection_md: str | None
    references_md: str | None
    tags: list = []
    template_id: uuid.UUID | None
    asset_ids: list[uuid.UUID] = []
