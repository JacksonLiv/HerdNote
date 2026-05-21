from pydantic import BaseModel, HttpUrl


class GhostwriterSettingsIn(BaseModel):
    url: str
    api_token: str
    hasura_admin_secret: str = ""
    enabled: bool = False


class GhostwriterSettingsOut(BaseModel):
    url: str | None
    enabled: bool
    token_set: bool
    hasura_secret_set: bool


class GhostwriterProject(BaseModel):
    project_id: int
    project_name: str
    client_name: str
    report_id: int | None
    report_title: str | None


class GhostwriterExportRequest(BaseModel):
    statuses: list[str] = ["open", "accepted"]
    gw_report_id: int | None = None


class GhostwriterExportResult(BaseModel):
    pushed: int = 0
    updated: int = 0
    errors: list[str] = []
