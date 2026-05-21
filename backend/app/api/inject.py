import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user, require_engagement, verify_csrf
from app.models.inject import Inject, InjectTemplate, MSELEntry
from app.models.user import User
from app.models.workstream import Workstream
from app.schemas.inject import (
    InjectCreate,
    InjectOut,
    InjectTemplateCreate,
    InjectTemplateOut,
    InjectTemplateUpdate,
    InjectUpdate,
    MSELCreate,
    MSELOut,
    MSELUpdate,
)

injects_router = APIRouter(
    prefix="/engagements/{engagement_id}/injects",
    tags=["inject"],
    dependencies=[Depends(require_engagement)],
)
templates_router = APIRouter(
    prefix="/engagements/{engagement_id}/inject-templates",
    tags=["inject"],
    dependencies=[Depends(require_engagement)],
)
msel_router = APIRouter(
    prefix="/engagements/{engagement_id}/msel",
    tags=["inject"],
    dependencies=[Depends(require_engagement)],
)


async def _require_ws_inject_kind(
    db: AsyncSession, engagement_id: uuid.UUID, workstream_id: uuid.UUID
) -> Workstream:
    ws = await db.get(Workstream, workstream_id)
    if ws is None or ws.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workstream not found")
    if ws.kind != "inject":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Workstream is not of kind 'inject'",
        )
    return ws


def _out(inj: Inject) -> InjectOut:
    return InjectOut.model_validate(inj)


@injects_router.get("", response_model=list[InjectOut])
async def list_injects(
    engagement_id: uuid.UUID,
    status_filter: str | None = None,
    category: str | None = None,
    workstream_id: uuid.UUID | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[InjectOut]:
    query = select(Inject).where(Inject.engagement_id == engagement_id)
    if status_filter is not None:
        query = query.where(Inject.status == status_filter)
    if category is not None:
        query = query.where(Inject.category == category)
    if workstream_id is not None:
        query = query.where(Inject.workstream_id == workstream_id)
    if q:
        like = f"%{q}%"
        query = query.where(
            or_(Inject.subject.ilike(like), Inject.body_md.ilike(like))
        )
    # Open ones with nearest deadlines first; everything else by recency.
    rows = list(
        await db.scalars(
            query.order_by(Inject.deadline.asc().nulls_last(), Inject.arrived_at.desc())
        )
    )
    return [_out(r) for r in rows]


@injects_router.post(
    "",
    response_model=InjectOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_inject(
    engagement_id: uuid.UUID,
    payload: InjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InjectOut:
    await _require_ws_inject_kind(db, engagement_id, payload.workstream_id)
    inj = Inject(
        engagement_id=engagement_id,
        received_by=user.id,
        **payload.model_dump(),
    )
    db.add(inj)
    await db.commit()
    await db.refresh(inj)
    return _out(inj)


@injects_router.get("/{inject_id}", response_model=InjectOut)
async def get_inject(
    engagement_id: uuid.UUID,
    inject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> InjectOut:
    inj = await db.get(Inject, inject_id)
    if inj is None or inj.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inject not found")
    return _out(inj)


@injects_router.patch(
    "/{inject_id}",
    response_model=InjectOut,
    dependencies=[Depends(verify_csrf)],
)
async def update_inject(
    engagement_id: uuid.UUID,
    inject_id: uuid.UUID,
    payload: InjectUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InjectOut:
    inj = await db.get(Inject, inject_id)
    if inj is None or inj.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inject not found")
    data = payload.model_dump(exclude_unset=True)
    if "workstream_id" in data:
        await _require_ws_inject_kind(db, engagement_id, data["workstream_id"])
    new_status = data.get("status")
    if new_status == "responded" and inj.status != "responded":
        inj.responded_at = datetime.now(UTC)
        inj.responded_by = user.id
    for f, v in data.items():
        setattr(inj, f, v)
    await db.commit()
    await db.refresh(inj)
    return _out(inj)


@injects_router.delete(
    "/{inject_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
async def delete_inject(
    engagement_id: uuid.UUID,
    inject_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    inj = await db.get(Inject, inject_id)
    if inj is None or inj.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inject not found")
    if user.role != "admin" and inj.received_by != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only admin or original receiver may delete"
        )
    await db.delete(inj)
    await db.commit()


# ---- templates ----


@templates_router.get("", response_model=list[InjectTemplateOut])
async def list_templates(
    engagement_id: uuid.UUID,
    category: str | None = None,
    q: str | None = None,
    include_global: bool = True,
    db: AsyncSession = Depends(get_db),
) -> list[InjectTemplateOut]:
    query = select(InjectTemplate)
    if include_global:
        query = query.where(
            or_(
                InjectTemplate.engagement_id == engagement_id,
                InjectTemplate.engagement_id.is_(None),
            )
        )
    else:
        query = query.where(InjectTemplate.engagement_id == engagement_id)
    if category is not None:
        query = query.where(InjectTemplate.category == category)
    if q:
        like = f"%{q}%"
        query = query.where(
            or_(InjectTemplate.title.ilike(like), InjectTemplate.body_md.ilike(like))
        )
    rows = list(await db.scalars(query.order_by(InjectTemplate.title)))
    return [InjectTemplateOut.model_validate(t) for t in rows]


@templates_router.post(
    "",
    response_model=InjectTemplateOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_template(
    engagement_id: uuid.UUID,
    payload: InjectTemplateCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InjectTemplateOut:
    data = payload.model_dump()
    is_global = data.pop("is_global", False)
    tpl = InjectTemplate(
        engagement_id=None if is_global else engagement_id,
        created_by=user.id,
        **data,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return InjectTemplateOut.model_validate(tpl)


@templates_router.patch(
    "/{template_id}",
    response_model=InjectTemplateOut,
    dependencies=[Depends(verify_csrf)],
)
async def update_template(
    engagement_id: uuid.UUID,
    template_id: uuid.UUID,
    payload: InjectTemplateUpdate,
    db: AsyncSession = Depends(get_db),
) -> InjectTemplateOut:
    tpl = await db.get(InjectTemplate, template_id)
    if tpl is None or tpl.engagement_id not in (engagement_id, None):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(tpl, f, v)
    await db.commit()
    await db.refresh(tpl)
    return InjectTemplateOut.model_validate(tpl)


@templates_router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
async def delete_template(
    engagement_id: uuid.UUID,
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    tpl = await db.get(InjectTemplate, template_id)
    if tpl is None or tpl.engagement_id not in (engagement_id, None):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    await db.delete(tpl)
    await db.commit()


# ── MSEL ─────────────────────────────────────────────────────────────────────


@msel_router.get("", response_model=list[MSELOut])
async def list_msel(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[MSELOut]:
    q = select(MSELEntry).where(MSELEntry.engagement_id == engagement_id)
    if workstream_id is not None:
        q = q.where(MSELEntry.workstream_id == workstream_id)
    rows = list(await db.scalars(q.order_by(MSELEntry.inject_number)))
    return [MSELOut.model_validate(r) for r in rows]


@msel_router.post(
    "",
    response_model=MSELOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_msel_entry(
    engagement_id: uuid.UUID,
    payload: MSELCreate,
    db: AsyncSession = Depends(get_db),
) -> MSELOut:
    entry = MSELEntry(engagement_id=engagement_id, **payload.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return MSELOut.model_validate(entry)


@msel_router.patch(
    "/{entry_id}",
    response_model=MSELOut,
    dependencies=[Depends(verify_csrf)],
)
async def update_msel_entry(
    engagement_id: uuid.UUID,
    entry_id: uuid.UUID,
    payload: MSELUpdate,
    db: AsyncSession = Depends(get_db),
) -> MSELOut:
    entry = await db.get(MSELEntry, entry_id)
    if entry is None or entry.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "MSEL entry not found")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(entry, f, v)
    await db.commit()
    await db.refresh(entry)
    return MSELOut.model_validate(entry)


@msel_router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_msel_entry(
    engagement_id: uuid.UUID,
    entry_id: uuid.UUID,
    _: None = Depends(verify_csrf),
    db: AsyncSession = Depends(get_db),
) -> None:
    entry = await db.get(MSELEntry, entry_id)
    if entry is None or entry.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "MSEL entry not found")
    await db.delete(entry)
    await db.commit()
