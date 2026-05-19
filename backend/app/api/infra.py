import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user, require_engagement, verify_csrf
from app.models.infra import Infrastructure, OplogEntry
from app.models.user import User
from app.schemas.infra import (
    InfraCreate,
    InfraOut,
    InfraUpdate,
    OplogCreate,
    OplogOut,
)

infra_router = APIRouter(
    prefix="/engagements/{engagement_id}/infrastructure",
    tags=["infrastructure"],
    dependencies=[Depends(require_engagement)],
)
oplog_router = APIRouter(
    prefix="/engagements/{engagement_id}/oplog",
    tags=["oplog"],
    dependencies=[Depends(require_engagement)],
)


@infra_router.get("", response_model=list[InfraOut])
async def list_infra(
    engagement_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> list[Infrastructure]:
    return list(
        await db.scalars(
            select(Infrastructure)
            .where(Infrastructure.engagement_id == engagement_id)
            .order_by(Infrastructure.kind, Infrastructure.name)
        )
    )


@infra_router.post(
    "",
    response_model=InfraOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_infra(
    engagement_id: uuid.UUID,
    payload: InfraCreate,
    db: AsyncSession = Depends(get_db),
) -> Infrastructure:
    i = Infrastructure(engagement_id=engagement_id, **payload.model_dump())
    db.add(i)
    await db.commit()
    await db.refresh(i)
    return i


@infra_router.patch(
    "/{infra_id}", response_model=InfraOut, dependencies=[Depends(verify_csrf)]
)
async def update_infra(
    engagement_id: uuid.UUID,
    infra_id: uuid.UUID,
    payload: InfraUpdate,
    db: AsyncSession = Depends(get_db),
) -> Infrastructure:
    i = await db.get(Infrastructure, infra_id)
    if i is None or i.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(i, f, v)
    await db.commit()
    await db.refresh(i)
    return i


@infra_router.delete(
    "/{infra_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_infra(
    engagement_id: uuid.UUID,
    infra_id: uuid.UUID,
    _: None = Depends(verify_csrf),
    db: AsyncSession = Depends(get_db),
) -> None:
    i = await db.get(Infrastructure, infra_id)
    if i is None or i.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    await db.delete(i)
    await db.commit()


def _oplog_out(e: OplogEntry, operator_name: str) -> OplogOut:
    return OplogOut(
        id=e.id,
        engagement_id=e.engagement_id,
        operator_id=e.operator_id,
        operator_name=operator_name,
        workstream_id=e.workstream_id,
        ts=e.ts,
        source_host=e.source_host,
        dest_host=e.dest_host,
        tool=e.tool,
        command=e.command,
        output=e.output,
        mitre_technique=e.mitre_technique,
        description=e.description,
    )


@oplog_router.get("", response_model=list[OplogOut])
async def list_oplog(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID | None = None,
    limit: int = 300,
    db: AsyncSession = Depends(get_db),
) -> list[OplogOut]:
    q = (
        select(OplogEntry, User.display_name)
        .join(User, User.id == OplogEntry.operator_id)
        .where(OplogEntry.engagement_id == engagement_id)
    )
    if workstream_id is not None:
        q = q.where(OplogEntry.workstream_id == workstream_id)
    rows = (
        await db.execute(
            q.order_by(OplogEntry.ts.desc()).limit(min(limit, 1000))
        )
    ).all()
    return [_oplog_out(e, name) for e, name in rows]


@oplog_router.post(
    "",
    response_model=OplogOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_oplog(
    engagement_id: uuid.UUID,
    payload: OplogCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OplogOut:
    e = OplogEntry(
        engagement_id=engagement_id,
        operator_id=user.id,
        **payload.model_dump(),
    )
    db.add(e)
    await db.commit()
    await db.refresh(e)
    return _oplog_out(e, user.display_name)


@oplog_router.delete(
    "/{entry_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_oplog(
    engagement_id: uuid.UUID,
    entry_id: uuid.UUID,
    _: None = Depends(verify_csrf),
    db: AsyncSession = Depends(get_db),
) -> None:
    e = await db.get(OplogEntry, entry_id)
    if e is None or e.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    await db.delete(e)
    await db.commit()
