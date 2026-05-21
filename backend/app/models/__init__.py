"""SQLAlchemy models.

Importing this package must register every model on ``Base.metadata`` so
Alembic autogenerate sees them. New model modules get imported here.
"""

from app.models.access_path import AccessPath, AccessStep
from app.models.activity import ActivityLogEntry
from app.models.asset import Asset
from app.models.base import Base
from app.models.client import Client, ClientContact
from app.models.compromise import Artifact, CompromisedUser
from app.models.engagement import Engagement, EngagementMember
from app.models.evidence import Evidence
from app.models.finding import FindingDraft, FindingTemplate
from app.models.ghostwriter import GhostwriterSettings
from app.models.infra import Infrastructure, OplogEntry
from app.models.inject import Inject, InjectTemplate
from app.models.playbook import PlaybookState, WorkstreamNote
from app.models.user import User
from app.models.web import Domain, WebApp
from app.models.workstream import Workstream, WorkstreamAssignment

__all__ = [
    "Base",
    "User",
    "Engagement",
    "EngagementMember",
    "Workstream",
    "WorkstreamAssignment",
    "Asset",
    "ActivityLogEntry",
    "CompromisedUser",
    "Artifact",
    "Evidence",
    "AccessPath",
    "AccessStep",
    "FindingTemplate",
    "FindingDraft",
    "Domain",
    "WebApp",
    "Client",
    "ClientContact",
    "Infrastructure",
    "OplogEntry",
    "PlaybookState",
    "WorkstreamNote",
    "Inject",
    "InjectTemplate",
    "GhostwriterSettings",
]
