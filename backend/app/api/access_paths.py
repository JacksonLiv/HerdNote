import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.core.deps import require_engagement, verify_csrf
from app.models.access_path import AccessPath, AccessStep
from app.models.asset import Asset
from app.schemas.access_path import (
    GraphOut,
    PathCreate,
    PathOut,
    PathUpdate,
    ReorderIn,
    StepCreate,
    StepOut,
    StepUpdate,
)

router = APIRouter(
    prefix="/engagements/{engagement_id}/paths",
    tags=["access-paths"],
    dependencies=[Depends(require_engagement)],
)


async def _get_path(
    db: AsyncSession, engagement_id: uuid.UUID, path_id: uuid.UUID
) -> AccessPath:
    path = await db.scalar(
        select(AccessPath)
        .where(AccessPath.id == path_id)
        .options(selectinload(AccessPath.steps))
    )
    if path is None or path.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Path not found")
    return path


@router.get("", response_model=list[PathOut])
async def list_paths(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[AccessPath]:
    query = (
        select(AccessPath)
        .where(AccessPath.engagement_id == engagement_id)
        .options(selectinload(AccessPath.steps))
        .order_by(AccessPath.created_at.desc())
    )
    if workstream_id is not None:
        query = query.where(AccessPath.workstream_id == workstream_id)
    return list(await db.scalars(query))


@router.post(
    "",
    response_model=PathOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_path(
    engagement_id: uuid.UUID,
    payload: PathCreate,
    db: AsyncSession = Depends(get_db),
) -> AccessPath:
    path = AccessPath(
        engagement_id=engagement_id,
        name=payload.name,
        workstream_id=payload.workstream_id,
        target_asset_id=payload.target_asset_id,
        description_md=payload.description_md,
        status=payload.status,
    )
    db.add(path)
    await db.commit()
    return await _get_path(db, engagement_id, path.id)


@router.patch(
    "/{path_id}", response_model=PathOut, dependencies=[Depends(verify_csrf)]
)
async def update_path(
    engagement_id: uuid.UUID,
    path_id: uuid.UUID,
    payload: PathUpdate,
    db: AsyncSession = Depends(get_db),
) -> AccessPath:
    path = await _get_path(db, engagement_id, path_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(path, field, value)
    await db.commit()
    return await _get_path(db, engagement_id, path_id)


@router.delete("/{path_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_path(
    engagement_id: uuid.UUID,
    path_id: uuid.UUID,
    _: None = Depends(verify_csrf),
    db: AsyncSession = Depends(get_db),
) -> None:
    path = await _get_path(db, engagement_id, path_id)
    await db.delete(path)
    await db.commit()


@router.post(
    "/{path_id}/steps",
    response_model=StepOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def add_step(
    engagement_id: uuid.UUID,
    path_id: uuid.UUID,
    payload: StepCreate,
    db: AsyncSession = Depends(get_db),
) -> AccessStep:
    path = await _get_path(db, engagement_id, path_id)
    next_idx = max((s.order_index for s in path.steps), default=-1) + 1
    step = AccessStep(path_id=path.id, order_index=next_idx, **payload.model_dump())
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return step


@router.patch(
    "/{path_id}/steps/{step_id}",
    response_model=StepOut,
    dependencies=[Depends(verify_csrf)],
)
async def update_step(
    engagement_id: uuid.UUID,
    path_id: uuid.UUID,
    step_id: uuid.UUID,
    payload: StepUpdate,
    db: AsyncSession = Depends(get_db),
) -> AccessStep:
    await _get_path(db, engagement_id, path_id)
    step = await db.get(AccessStep, step_id)
    if step is None or step.path_id != path_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Step not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(step, field, value)
    await db.commit()
    await db.refresh(step)
    return step


@router.delete(
    "/{path_id}/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_step(
    engagement_id: uuid.UUID,
    path_id: uuid.UUID,
    step_id: uuid.UUID,
    _: None = Depends(verify_csrf),
    db: AsyncSession = Depends(get_db),
) -> None:
    await _get_path(db, engagement_id, path_id)
    step = await db.get(AccessStep, step_id)
    if step is None or step.path_id != path_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Step not found")
    await db.delete(step)
    await db.commit()


@router.post(
    "/{path_id}/steps/reorder",
    response_model=PathOut,
    dependencies=[Depends(verify_csrf)],
)
async def reorder_steps(
    engagement_id: uuid.UUID,
    path_id: uuid.UUID,
    payload: ReorderIn,
    db: AsyncSession = Depends(get_db),
) -> AccessPath:
    path = await _get_path(db, engagement_id, path_id)
    by_id = {s.id: s for s in path.steps}
    if set(payload.step_ids) != set(by_id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "step_ids must match the path's steps exactly"
        )
    for idx, sid in enumerate(payload.step_ids):
        by_id[sid].order_index = idx
    await db.commit()
    return await _get_path(db, engagement_id, path_id)


@router.get("/{path_id}/graph", response_model=GraphOut)
async def path_graph(
    engagement_id: uuid.UUID,
    path_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> GraphOut:
    """Cytoscape elements: asset nodes chained by ordered steps."""
    path = await _get_path(db, engagement_id, path_id)
    asset_ids = {
        aid
        for s in path.steps
        for aid in (s.from_asset_id, s.to_asset_id)
        if aid is not None
    }
    if path.target_asset_id:
        asset_ids.add(path.target_asset_id)

    labels: dict[uuid.UUID, str] = {}
    if asset_ids:
        rows = await db.execute(
            select(Asset.id, Asset.identifier).where(Asset.id.in_(asset_ids))
        )
        labels = {aid: ident for aid, ident in rows}

    elements = [
        {
            "group": "nodes",
            "data": {
                "id": str(aid),
                "label": labels.get(aid, "unknown"),
                "target": aid == path.target_asset_id,
            },
        }
        for aid in asset_ids
    ]
    for s in sorted(path.steps, key=lambda x: x.order_index):
        if s.from_asset_id and s.to_asset_id:
            elements.append(
                {
                    "group": "edges",
                    "data": {
                        "id": str(s.id),
                        "source": str(s.from_asset_id),
                        "target": str(s.to_asset_id),
                        "label": s.title,
                    },
                }
            )
    return GraphOut(elements=elements)  # type: ignore[arg-type]
