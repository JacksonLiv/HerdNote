"""Versioned engagement export — the stable phase-2 report contract.

A future report generator consumes this JSON only; it never touches the DB.
Bump SCHEMA_VERSION (and document it) on any breaking shape change.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import decrypt_secret
from app.models.access_path import AccessPath
from app.models.activity import ActivityLogEntry
from app.models.asset import Asset
from app.models.compromise import Artifact, CompromisedUser
from app.models.engagement import Engagement, EngagementMember
from app.models.evidence import Evidence
from app.models.finding import FindingDraft
from app.models.user import User
from app.models.workstream import Workstream, WorkstreamAssignment

SCHEMA_VERSION = "1.0"


async def build_export(
    db: AsyncSession, engagement: Engagement, include_secrets: bool = False
) -> dict:
    eid = engagement.id

    users = {u.id: u for u in await db.scalars(select(User))}

    workstreams = list(
        await db.scalars(
            select(Workstream).where(Workstream.engagement_id == eid)
        )
    )
    ws_assignments: dict = {}
    for a in await db.scalars(
        select(WorkstreamAssignment).where(
            WorkstreamAssignment.workstream_id.in_([w.id for w in workstreams] or [None])
        )
    ):
        ws_assignments.setdefault(a.workstream_id, []).append(a.user_id)

    members = list(
        await db.scalars(
            select(EngagementMember).where(EngagementMember.engagement_id == eid)
        )
    )
    assets = list(
        await db.scalars(select(Asset).where(Asset.engagement_id == eid))
    )
    cusers = list(
        await db.scalars(
            select(CompromisedUser).where(CompromisedUser.engagement_id == eid)
        )
    )
    paths = list(
        await db.scalars(
            select(AccessPath)
            .where(AccessPath.engagement_id == eid)
            .options(selectinload(AccessPath.steps))
        )
    )
    activity = list(
        await db.scalars(
            select(ActivityLogEntry)
            .where(ActivityLogEntry.engagement_id == eid)
            .order_by(ActivityLogEntry.ts)
        )
    )
    findings = list(
        await db.scalars(
            select(FindingDraft).where(FindingDraft.engagement_id == eid)
        )
    )
    artifacts = list(
        await db.scalars(select(Artifact).where(Artifact.engagement_id == eid))
    )
    evidence = list(
        await db.scalars(select(Evidence).where(Evidence.engagement_id == eid))
    )

    def uname(uid):
        u = users.get(uid)
        return u.display_name if u else None

    return {
        "schema_version": SCHEMA_VERSION,
        "engagement": {
            "id": str(eid),
            "name": engagement.name,
            "client": engagement.client,
            "type": engagement.type,
            "status": engagement.status,
            "start_date": str(engagement.start_date) if engagement.start_date else None,
            "end_date": str(engagement.end_date) if engagement.end_date else None,
            "scope_md": engagement.scope_md,
            "roe_md": engagement.roe_md,
        },
        "workstreams": [
            {
                "id": str(w.id),
                "name": w.name,
                "kind": w.kind,
                "description_md": w.description_md,
                "assignees": [uname(u) for u in ws_assignments.get(w.id, [])],
            }
            for w in workstreams
        ],
        "members": [
            {"user": uname(m.user_id), "role": m.role} for m in members
        ],
        "assets": [
            {
                "id": str(a.id),
                "workstream_ids": [str(w.id) for w in a.workstreams],
                "type": a.type,
                "identifier": a.identifier,
                "os": a.os,
                "services": a.services,
                "in_scope": a.in_scope,
                "state": a.state,
                "tags": a.tags,
                "notes_md": a.notes_md,
            }
            for a in assets
        ],
        "compromised_users": [
            {
                "id": str(c.id),
                "asset_id": str(c.asset_id) if c.asset_id else None,
                "username": c.username,
                "domain": c.domain,
                "privilege": c.privilege,
                "method_md": c.method_md,
                "validated": c.validated,
                "secret": (
                    decrypt_secret(c.secret_encrypted)
                    if include_secrets and c.secret_encrypted
                    else None
                ),
                "secret_present": c.secret_encrypted is not None,
            }
            for c in cusers
        ],
        "access_paths": [
            {
                "id": str(p.id),
                "name": p.name,
                "status": p.status,
                "target_asset_id": str(p.target_asset_id)
                if p.target_asset_id
                else None,
                "description_md": p.description_md,
                "steps": [
                    {
                        "order": s.order_index,
                        "title": s.title,
                        "command_or_action": s.command_or_action,
                        "expected_result": s.expected_result,
                        "from_asset_id": str(s.from_asset_id)
                        if s.from_asset_id
                        else None,
                        "to_asset_id": str(s.to_asset_id) if s.to_asset_id else None,
                        "mitre_technique": s.mitre_technique,
                        "notes_md": s.notes_md,
                    }
                    for s in sorted(p.steps, key=lambda x: x.order_index)
                ],
            }
            for p in paths
        ],
        "activity_log": [
            {
                "ts": a.ts.isoformat() if a.ts else None,
                "operator": uname(a.operator_id),
                "action_type": a.action_type,
                "description": a.description,
                "command": a.command,
                "source_ip": a.source_ip,
                "mitre_technique": a.mitre_technique,
                "target_asset_id": str(a.target_asset_id)
                if a.target_asset_id
                else None,
            }
            for a in activity
        ],
        "findings": [
            {
                "id": str(f.id),
                "title": f.title,
                "severity": f.severity,
                "status": f.status,
                "cvss_vector": f.cvss_vector,
                "cvss_score": f.cvss_score,
                "cwe": f.cwe,
                "cve": f.cve,
                "description_md": f.description_md,
                "impact_md": f.impact_md,
                "reproduction_md": f.reproduction_md,
                "remediation_md": f.remediation_md,
                "references_md": f.references_md,
                "asset_ids": [str(a.id) for a in f.assets],
            }
            for f in findings
        ],
        "artifacts": [
            {
                "id": str(t.id),
                "asset_id": str(t.asset_id) if t.asset_id else None,
                "type": t.type,
                "description": t.description,
                "introduced_at": t.introduced_at.isoformat()
                if t.introduced_at
                else None,
                "removed": t.removed,
                "removed_at": t.removed_at.isoformat() if t.removed_at else None,
                "notes": t.notes,
            }
            for t in artifacts
        ],
        "evidence_manifest": [
            {
                "id": str(e.id),
                "parent_type": e.parent_type,
                "parent_id": str(e.parent_id),
                "filename": e.filename,
                "content_type": e.content_type,
                "sha256": e.sha256,
                "caption": e.caption,
            }
            for e in evidence
        ],
    }
