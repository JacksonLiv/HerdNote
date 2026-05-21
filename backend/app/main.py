import re

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import (
    access_paths,
    activity,
    assets,
    auth,
    clients,
    compromise,
    dashboard,
    engagements,
    evidence,
    export,
    finding,
    ghostwriter,
    health,
    infra,
    inject,
    playbook,
    report,
    scratch_notes,
    social_campaigns,
    web,
    ws,
)
from app.core.config import get_settings
from app.core.ws import hub

settings = get_settings()

app = FastAPI(title="PentestReportMaker API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_ENG_PATH = re.compile(r"^/api/engagements/([0-9a-fA-F-]{36})(/|$)")


class BroadcastMiddleware(BaseHTTPMiddleware):
    """After any successful engagement-scoped mutation, nudge connected
    operators to refetch — keeps the team's view live without per-endpoint
    wiring."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.method in ("POST", "PATCH", "PUT", "DELETE") and (
            response.status_code < 400
        ):
            m = _ENG_PATH.match(request.url.path)
            if m:
                await hub.broadcast(
                    m.group(1),
                    {"type": "changed", "engagement_id": m.group(1)},
                )
        return response


app.add_middleware(BroadcastMiddleware)

# REST routers.
app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(engagements.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(clients.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(activity.router, prefix="/api")
app.include_router(compromise.users_router, prefix="/api")
app.include_router(compromise.artifacts_router, prefix="/api")
app.include_router(evidence.router, prefix="/api")
app.include_router(access_paths.router, prefix="/api")
app.include_router(finding.templates_router, prefix="/api")
app.include_router(finding.findings_router, prefix="/api")
app.include_router(web.domains_router, prefix="/api")
app.include_router(web.webapps_router, prefix="/api")
app.include_router(web.web_hosts_router, prefix="/api")
app.include_router(web.web_subdomains_router, prefix="/api")
app.include_router(infra.infra_router, prefix="/api")
app.include_router(infra.oplog_router, prefix="/api")
app.include_router(playbook.router, prefix="/api")
app.include_router(scratch_notes.router, prefix="/api")
app.include_router(social_campaigns.router, prefix="/api")
app.include_router(inject.injects_router, prefix="/api")
app.include_router(inject.templates_router, prefix="/api")
app.include_router(inject.msel_router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(ghostwriter.router, prefix="/api")
app.include_router(report.router, prefix="/api")

# WebSocket (no /api prefix; nginx proxies /ws/).
app.include_router(ws.router)
