import re
import uuid
from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.core.deps import require_engagement
from app.models.asset import Asset, asset_workstreams
from app.models.compromise import Artifact, CompromisedUser
from app.models.finding import FindingDraft
from app.models.workstream import Workstream

_IPV4 = re.compile(r"^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}")

router = APIRouter(
    prefix="/engagements/{engagement_id}/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(require_engagement)],
)

_COMPROMISED_STATES = ("exploited", "compromised")


@router.get("")
async def dashboard(
    engagement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Always-global engagement state across ALL workstreams.

    The Dashboard intentionally ignores the workstream switcher so any
    operator (e.g. AD) can see what Web captured, etc.
    """
    assets = list(
        await db.scalars(
            select(Asset)
            .where(Asset.engagement_id == engagement_id)
            .options(selectinload(Asset.workstreams))
        )
    )
    findings = list(
        await db.scalars(
            select(FindingDraft).where(FindingDraft.engagement_id == engagement_id)
        )
    )
    cusers = list(
        await db.scalars(
            select(CompromisedUser).where(
                CompromisedUser.engagement_id == engagement_id
            )
        )
    )
    artifacts = list(
        await db.scalars(
            select(Artifact).where(Artifact.engagement_id == engagement_id)
        )
    )
    workstreams = list(
        await db.scalars(
            select(Workstream).where(Workstream.engagement_id == engagement_id)
        )
    )

    state_counts = Counter(a.state for a in assets)
    sev_counts = Counter(f.severity for f in findings)

    def ws_ids(a: Asset) -> list[str]:
        return [str(w.id) for w in a.workstreams]

    return {
        "asset_total": len(assets),
        "asset_states": dict(state_counts),
        "hosts": [
            {
                "id": str(a.id),
                "identifier": a.identifier,
                "type": a.type,
                "state": a.state,
                "in_scope": a.in_scope,
                "os": a.os,
                "workstream_ids": ws_ids(a),
            }
            for a in sorted(assets, key=lambda x: x.identifier)
        ],
        "compromised_hosts": [
            {
                "id": str(a.id),
                "identifier": a.identifier,
                "state": a.state,
                "type": a.type,
                "workstream_ids": ws_ids(a),
            }
            for a in assets
            if a.state in _COMPROMISED_STATES
        ],
        "compromised_users": [
            {
                "id": str(c.id),
                "username": c.username,
                "domain": c.domain,
                "privilege": c.privilege,
                "has_secret": c.secret_encrypted is not None,
                "validated": c.validated,
                "workstream_id": str(c.workstream_id) if c.workstream_id else None,
            }
            for c in cusers
        ],
        "artifacts_open": [
            {"id": str(t.id), "type": t.type, "description": t.description}
            for t in artifacts
            if not t.removed
        ],
        "artifacts_total": len(artifacts),
        "findings_total": len(findings),
        "findings_by_severity": dict(sev_counts),
        "findings_open": sum(
            1 for f in findings if f.status in ("open", "draft")
        ),
        "workstreams": [
            {
                "id": str(w.id),
                "name": w.name,
                "kind": w.kind,
                "asset_count": sum(
                    1 for a in assets if any(x.id == w.id for x in a.workstreams)
                ),
                "compromised_count": sum(
                    1
                    for a in assets
                    if a.state in _COMPROMISED_STATES
                    and any(x.id == w.id for x in a.workstreams)
                ),
                "finding_count": sum(
                    1 for f in findings if f.workstream_id == w.id
                ),
            }
            for w in workstreams
        ],
    }


@router.get("/network")
async def network_diagram(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Cytoscape elements: hosts as nodes clustered into /24 subnet parents.

    Global (no workstream_id) = all hosts; scoped = that workstream's hosts.
    """
    q = (
        select(Asset)
        .where(Asset.engagement_id == engagement_id)
        .options(selectinload(Asset.workstreams))
    )
    if workstream_id is not None:
        q = q.join(
            asset_workstreams, asset_workstreams.c.asset_id == Asset.id
        ).where(asset_workstreams.c.workstream_id == workstream_id)
    assets = list(await db.scalars(q))

    elements: list[dict] = []
    subnets: set[str] = set()
    for a in assets:
        m = _IPV4.match(a.identifier or "")
        subnet = f"{m.group(1)}.{m.group(2)}.{m.group(3)}.0/24" if m else "other"
        if subnet not in subnets:
            subnets.add(subnet)
            elements.append(
                {"group": "nodes", "data": {"id": f"net:{subnet}", "label": subnet, "subnet": True}}
            )
        elements.append(
            {
                "group": "nodes",
                "data": {
                    "id": str(a.id),
                    "label": a.identifier,
                    "parent": f"net:{subnet}",
                    "state": a.state,
                    "kinds": sorted({w.kind for w in a.workstreams}),
                    "workstreams": [w.name for w in a.workstreams],
                },
            }
        )
    return {"elements": elements}
