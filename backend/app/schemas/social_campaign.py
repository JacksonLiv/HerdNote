import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.social_campaign import CAMPAIGN_STATUSES, CAMPAIGN_TYPES

CampaignTypeField = Field(default="email", pattern="^(" + "|".join(CAMPAIGN_TYPES) + ")$")
CampaignStatusField = Field(default="planned", pattern="^(" + "|".join(CAMPAIGN_STATUSES) + ")$")


class SocialCampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    campaign_type: str = CampaignTypeField
    campaign_status: str = CampaignStatusField
    sent: int | None = None
    clicked: int | None = None
    submitted: int | None = None
    mfa_bypassed: int | None = None
    reported: int | None = None
    pretext_md: str | None = None
    from_address: str | None = None
    landing_url: str | None = None
    tool_ref: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    notes_md: str | None = None


class SocialCampaignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    campaign_type: str | None = Field(default=None, pattern="^(" + "|".join(CAMPAIGN_TYPES) + ")$")
    campaign_status: str | None = Field(default=None, pattern="^(" + "|".join(CAMPAIGN_STATUSES) + ")$")
    sent: int | None = None
    clicked: int | None = None
    submitted: int | None = None
    mfa_bypassed: int | None = None
    reported: int | None = None
    pretext_md: str | None = None
    from_address: str | None = None
    landing_url: str | None = None
    tool_ref: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    notes_md: str | None = None


class SocialCampaignOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    workstream_id: uuid.UUID
    name: str
    campaign_type: str
    campaign_status: str
    sent: int | None
    clicked: int | None
    submitted: int | None
    mfa_bypassed: int | None
    reported: int | None
    pretext_md: str | None
    from_address: str | None
    landing_url: str | None
    tool_ref: str | None
    started_at: datetime | None
    ended_at: datetime | None
    notes_md: str | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
