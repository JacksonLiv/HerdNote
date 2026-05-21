from pydantic import BaseModel, HttpUrl


class GhostwriterSettingsIn(BaseModel):
    url: str
    api_token: str
    enabled: bool = False


class GhostwriterSettingsOut(BaseModel):
    url: str | None
    enabled: bool
    token_set: bool


class GhostwriterExportRequest(BaseModel):
    statuses: list[str] = ["open", "accepted"]


class GhostwriterExportResult(BaseModel):
    pushed: int = 0
    updated: int = 0
    errors: list[str] = []
