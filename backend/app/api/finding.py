import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user, require_engagement, verify_csrf
from app.models.asset import Asset
from app.models.finding import FindingDraft, FindingTemplate
from app.models.user import User
from app.schemas.finding import (
    FindingCreate,
    FindingOut,
    FindingUpdate,
    TemplateCreate,
    TemplateOut,
    TemplateUpdate,
)

templates_router = APIRouter(prefix="/finding-templates", tags=["finding-templates"])
findings_router = APIRouter(
    prefix="/engagements/{engagement_id}/findings",
    tags=["findings"],
    dependencies=[Depends(require_engagement)],
)


# --- templates (global library) ---
@templates_router.get(
    "", response_model=list[TemplateOut], dependencies=[Depends(get_current_user)]
)
async def list_templates(db: AsyncSession = Depends(get_db)) -> list[FindingTemplate]:
    res = await db.scalars(select(FindingTemplate).order_by(FindingTemplate.name))
    return list(res)


@templates_router.post(
    "",
    response_model=TemplateOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf), Depends(get_current_user)],
)
async def create_template(
    payload: TemplateCreate, db: AsyncSession = Depends(get_db)
) -> FindingTemplate:
    if await db.scalar(
        select(FindingTemplate).where(FindingTemplate.name == payload.name)
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "Template name exists")
    tpl = FindingTemplate(**payload.model_dump())
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@templates_router.patch(
    "/{template_id}",
    response_model=TemplateOut,
    dependencies=[Depends(verify_csrf), Depends(get_current_user)],
)
async def update_template(
    template_id: uuid.UUID,
    payload: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
) -> FindingTemplate:
    tpl = await db.get(FindingTemplate, template_id)
    if tpl is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != tpl.name:
        if await db.scalar(
            select(FindingTemplate).where(FindingTemplate.name == data["name"])
        ):
            raise HTTPException(status.HTTP_409_CONFLICT, "Template name exists")
    for field, value in data.items():
        setattr(tpl, field, value)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@templates_router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf), Depends(get_current_user)],
)
async def delete_template(
    template_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> None:
    tpl = await db.get(FindingTemplate, template_id)
    if tpl is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    await db.delete(tpl)
    await db.commit()


# --- findings ---
def _out(f: FindingDraft) -> FindingOut:
    return FindingOut(
        id=f.id,
        engagement_id=f.engagement_id,
        workstream_id=f.workstream_id,
        title=f.title,
        severity=f.severity,
        status=f.status,
        finding_type=f.finding_type,
        cvss_vector=f.cvss_vector,
        cvss_score=f.cvss_score,
        cwe=f.cwe,
        cve=f.cve,
        description_md=f.description_md,
        impact_md=f.impact_md,
        reproduction_md=f.reproduction_md,
        remediation_md=f.remediation_md,
        host_detection_md=f.host_detection_md,
        network_detection_md=f.network_detection_md,
        references_md=f.references_md,
        tags=f.tags or [],
        template_id=f.template_id,
        asset_ids=[a.id for a in f.assets],
    )


async def _get(db: AsyncSession, engagement_id: uuid.UUID, fid: uuid.UUID) -> FindingDraft:
    f = await db.get(FindingDraft, fid)
    if f is None or f.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Finding not found")
    return f


async def _resolve_assets(
    db: AsyncSession, engagement_id: uuid.UUID, ids: list[uuid.UUID]
) -> list[Asset]:
    if not ids:
        return []
    res = await db.scalars(
        select(Asset).where(Asset.id.in_(ids), Asset.engagement_id == engagement_id)
    )
    return list(res)


@findings_router.get("", response_model=list[FindingOut])
async def list_findings(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[FindingOut]:
    query = (
        select(FindingDraft)
        .where(FindingDraft.engagement_id == engagement_id)
        .order_by(FindingDraft.created_at.desc())
    )
    if workstream_id is not None:
        query = query.where(FindingDraft.workstream_id == workstream_id)
    res = await db.scalars(query)
    return [_out(f) for f in res]


@findings_router.post(
    "",
    response_model=FindingOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_finding(
    engagement_id: uuid.UUID,
    payload: FindingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FindingOut:
    data = payload.model_dump(exclude={"asset_ids"})

    # Instantiate from a template: fill any field the caller left blank.
    if payload.template_id:
        tpl = await db.get(FindingTemplate, payload.template_id)
        if tpl is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
        if not data.get("description_md"):
            data["description_md"] = tpl.description_md
        if not data.get("impact_md"):
            data["impact_md"] = tpl.impact_md
        if not data.get("remediation_md"):
            data["remediation_md"] = tpl.remediation_md
        if not data.get("references_md"):
            data["references_md"] = tpl.references_md
        if not data.get("host_detection_md"):
            data["host_detection_md"] = tpl.host_detection_md
        if not data.get("network_detection_md"):
            data["network_detection_md"] = tpl.network_detection_md
        if not data.get("cwe"):
            data["cwe"] = tpl.cwe
        if not data.get("finding_type"):
            data["finding_type"] = tpl.finding_type or tpl.category
        if not data.get("tags"):
            data["tags"] = list(tpl.tags or [])
        if data.get("severity") == "medium":
            data["severity"] = tpl.severity_default

    finding = FindingDraft(engagement_id=engagement_id, created_by=user.id, **data)
    finding.assets = await _resolve_assets(db, engagement_id, payload.asset_ids)
    db.add(finding)
    await db.commit()
    await db.refresh(finding)
    return _out(finding)


@findings_router.patch(
    "/{finding_id}", response_model=FindingOut, dependencies=[Depends(verify_csrf)]
)
async def update_finding(
    engagement_id: uuid.UUID,
    finding_id: uuid.UUID,
    payload: FindingUpdate,
    db: AsyncSession = Depends(get_db),
) -> FindingOut:
    finding = await _get(db, engagement_id, finding_id)
    data = payload.model_dump(exclude_unset=True)
    if "asset_ids" in data:
        ids = data.pop("asset_ids")
        finding.assets = await _resolve_assets(db, engagement_id, ids or [])
    for field, value in data.items():
        setattr(finding, field, value)
    await db.commit()
    await db.refresh(finding)
    return _out(finding)


@findings_router.delete(
    "/{finding_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_finding(
    engagement_id: uuid.UUID,
    finding_id: uuid.UUID,
    _: None = Depends(verify_csrf),
    db: AsyncSession = Depends(get_db),
) -> None:
    finding = await _get(db, engagement_id, finding_id)
    await db.delete(finding)
    await db.commit()
