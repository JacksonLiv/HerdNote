import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.core.deps import get_current_user, verify_csrf
from app.models.engagement import Engagement, EngagementMember
from app.models.user import User
from app.models.workstream import Workstream, WorkstreamAssignment
from app.schemas.engagement import (
    EngagementCreate,
    EngagementListItem,
    EngagementOut,
    MemberOut,
    WorkstreamOut,
)

router = APIRouter(prefix="/engagements", tags=["engagements"])


async def _load_full(db: AsyncSession, engagement_id: uuid.UUID) -> Engagement:
    eng = await db.scalar(
        select(Engagement)
        .where(Engagement.id == engagement_id)
        .options(
            selectinload(Engagement.workstreams).selectinload(Workstream.assignments),
            selectinload(Engagement.members),
        )
        # Force-refresh from DB so freshly committed children show up.
        .execution_options(populate_existing=True)
    )
    if eng is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Engagement not found")
    return eng


async def require_membership(
    engagement_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Engagement:
    eng = await _load_full(db, engagement_id)
    if user.role == "admin":
        return eng
    if not any(m.user_id == user.id for m in eng.members):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this engagement")
    return eng


async def _serialize(db: AsyncSession, eng: Engagement) -> EngagementOut:
    users = {
        u.id: u
        for u in await db.scalars(select(User))
    }
    ws_out = []
    for ws in eng.workstreams:
        assignees = [
            users[a.user_id] for a in ws.assignments if a.user_id in users
        ]
        ws_out.append(
            WorkstreamOut(
                id=ws.id,
                name=ws.name,
                kind=ws.kind,
                description_md=ws.description_md,
                meta=ws.meta or {},
                assignees=assignees,  # type: ignore[arg-type]
            )
        )
    members = [
        MemberOut(user=users[m.user_id], role=m.role)  # type: ignore[arg-type]
        for m in eng.members
        if m.user_id in users
    ]
    return EngagementOut(
        id=eng.id,
        name=eng.name,
        client=eng.client,
        client_id=eng.client_id,
        type=eng.type,
        status=eng.status,
        start_date=eng.start_date,
        end_date=eng.end_date,
        scope_md=eng.scope_md,
        roe_md=eng.roe_md,
        workstreams=ws_out,
        members=members,
    )


@router.post(
    "",
    response_model=EngagementOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_engagement(
    payload: EngagementCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EngagementOut:
    """Start Pentest wizard: create engagement + workstreams + team in one call."""
    eng = Engagement(
        name=payload.name,
        client=payload.client,
        client_id=payload.client_id,
        type=payload.type,
        status=payload.status,
        start_date=payload.start_date,
        end_date=payload.end_date,
        scope_md=payload.scope_md,
        roe_md=payload.roe_md,
        created_by=user.id,
    )
    db.add(eng)
    await db.flush()

    # Creator is always a member (lead); plus any selected members.
    member_ids = set(payload.member_ids) | {user.id}
    for uid in member_ids:
        db.add(
            EngagementMember(
                engagement_id=eng.id,
                user_id=uid,
                role="lead" if uid == user.id else "operator",
            )
        )

    for ws_in in payload.workstreams:
        ws = Workstream(
            engagement_id=eng.id,
            name=ws_in.name,
            kind=ws_in.kind,
            description_md=ws_in.description_md,
        )
        db.add(ws)
        await db.flush()
        for uid in set(ws_in.assignee_ids):
            db.add(WorkstreamAssignment(workstream_id=ws.id, user_id=uid))

    await db.commit()
    return await _serialize(db, await _load_full(db, eng.id))


@router.get("", response_model=list[EngagementListItem])
async def list_engagements(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[EngagementListItem]:
    query = select(Engagement).options(
        selectinload(Engagement.workstreams),
        selectinload(Engagement.members),
    )
    if user.role != "admin":
        query = query.join(EngagementMember).where(EngagementMember.user_id == user.id)
    engagements = await db.scalars(query.order_by(Engagement.created_at.desc()))
    return [
        EngagementListItem(
            id=e.id,
            name=e.name,
            client=e.client,
            type=e.type,
            status=e.status,
            workstream_count=len(e.workstreams),
            member_count=len(e.members),
        )
        for e in engagements.unique()
    ]


@router.get("/{engagement_id}", response_model=EngagementOut)
async def get_engagement(
    eng: Engagement = Depends(require_membership),
    db: AsyncSession = Depends(get_db),
) -> EngagementOut:
    return await _serialize(db, eng)


# --- patch engagement metadata ---
class _EngPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    client: str | None = None
    client_id: uuid.UUID | None = None
    type: str | None = Field(default=None, max_length=24)
    status: str | None = Field(default=None, pattern="^(planning|active|reporting|closed)$")
    start_date: date | None = None
    end_date: date | None = None
    scope_md: str | None = None
    roe_md: str | None = None


@router.patch(
    "/{engagement_id}",
    response_model=EngagementOut,
    dependencies=[Depends(verify_csrf)],
)
async def patch_engagement(
    engagement_id: uuid.UUID,
    payload: _EngPatch,
    eng: Engagement = Depends(require_membership),
    db: AsyncSession = Depends(get_db),
) -> EngagementOut:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(eng, k, v)
    await db.commit()
    return await _serialize(db, await _load_full(db, engagement_id))


# --- engagement settings: workstream management ---
class _WsBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: str = Field(default="other")


@router.post(
    "/{engagement_id}/workstreams",
    response_model=EngagementOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def add_workstream(
    engagement_id: uuid.UUID,
    payload: _WsBody,
    eng: Engagement = Depends(require_membership),
    db: AsyncSession = Depends(get_db),
) -> EngagementOut:
    db.add(
        Workstream(
            engagement_id=engagement_id, name=payload.name, kind=payload.kind
        )
    )
    await db.commit()
    return await _serialize(db, await _load_full(db, engagement_id))


class _WsPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description_md: str | None = None
    meta: dict | None = None


@router.patch(
    "/{engagement_id}/workstreams/{ws_id}",
    response_model=EngagementOut,
    dependencies=[Depends(verify_csrf)],
)
async def patch_workstream(
    engagement_id: uuid.UUID,
    ws_id: uuid.UUID,
    payload: _WsPatch,
    eng: Engagement = Depends(require_membership),
    db: AsyncSession = Depends(get_db),
) -> EngagementOut:
    ws = await db.get(Workstream, ws_id)
    if ws is None or ws.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workstream not found")
    if payload.name is not None:
        ws.name = payload.name
    if payload.description_md is not None:
        ws.description_md = payload.description_md
    if payload.meta is not None:
        ws.meta = {**(ws.meta or {}), **payload.meta}
    await db.commit()
    return await _serialize(db, await _load_full(db, engagement_id))


@router.delete(
    "/{engagement_id}/workstreams/{ws_id}",
    response_model=EngagementOut,
    dependencies=[Depends(verify_csrf)],
)
async def remove_workstream(
    engagement_id: uuid.UUID,
    ws_id: uuid.UUID,
    eng: Engagement = Depends(require_membership),
    db: AsyncSession = Depends(get_db),
) -> EngagementOut:
    ws = await db.get(Workstream, ws_id)
    if ws is None or ws.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workstream not found")
    await db.delete(ws)
    await db.commit()
    return await _serialize(db, await _load_full(db, engagement_id))
