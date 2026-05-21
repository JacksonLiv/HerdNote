import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.compromise import ARTIFACT_TYPES, CRED_SOURCES, HASH_TYPES, PRIVILEGE_LEVELS

PrivField = Field(default="user", pattern="^(" + "|".join(PRIVILEGE_LEVELS) + ")$")
ArtTypeField = Field(default="other", pattern="^(" + "|".join(ARTIFACT_TYPES) + ")$")
SourceField = Field(default=None, pattern="^(" + "|".join(CRED_SOURCES) + ")$")
HashTypeField = Field(default=None, pattern="^(" + "|".join(HASH_TYPES) + ")$")


# --- compromised users ---
class CompromisedUserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=160)
    domain: str | None = None
    privilege: str = PrivField
    asset_id: uuid.UUID | None = None
    workstream_id: uuid.UUID | None = None
    method_md: str | None = None
    secret: str | None = None  # plaintext in; stored encrypted.
    validated: bool = False
    notes_md: str | None = None
    source: str | None = SourceField
    hash_type: str | None = HashTypeField
    cracked: bool = False
    spn: str | None = None


class CompromisedUserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=1, max_length=160)
    domain: str | None = None
    privilege: str | None = Field(
        default=None, pattern="^(" + "|".join(PRIVILEGE_LEVELS) + ")$"
    )
    asset_id: uuid.UUID | None = None
    workstream_id: uuid.UUID | None = None
    method_md: str | None = None
    secret: str | None = None
    validated: bool | None = None
    notes_md: str | None = None
    source: str | None = Field(default=None, pattern="^(" + "|".join(CRED_SOURCES) + ")$")
    hash_type: str | None = Field(default=None, pattern="^(" + "|".join(HASH_TYPES) + ")$")
    cracked: bool | None = None
    spn: str | None = None


class CompromisedUserOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    asset_id: uuid.UUID | None
    workstream_id: uuid.UUID | None
    username: str
    domain: str | None
    privilege: str
    method_md: str | None
    has_secret: bool
    validated: bool
    notes_md: str | None
    source: str | None
    hash_type: str | None
    cracked: bool
    spn: str | None
    created_at: datetime


class SecretReveal(BaseModel):
    secret: str


# --- artifacts ---
class ArtifactCreate(BaseModel):
    type: str = ArtTypeField
    description: str = Field(min_length=1)
    asset_id: uuid.UUID | None = None
    workstream_id: uuid.UUID | None = None
    notes: str | None = None


class ArtifactUpdate(BaseModel):
    type: str | None = Field(default=None, pattern="^(" + "|".join(ARTIFACT_TYPES) + ")$")
    description: str | None = Field(default=None, min_length=1)
    asset_id: uuid.UUID | None = None
    workstream_id: uuid.UUID | None = None
    removed: bool | None = None
    notes: str | None = None


class ArtifactOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    asset_id: uuid.UUID | None
    workstream_id: uuid.UUID | None
    type: str
    description: str
    introduced_at: datetime
    removed: bool
    removed_at: datetime | None
    notes: str | None

    model_config = {"from_attributes": True}
