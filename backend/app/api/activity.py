import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user, require_engagement, verify_csrf
from app.models.activity import ActivityLogEntry
from app.models.user import User
from app.schemas.activity import ActivityCreate, ActivityOut

router = APIRouter(
    prefix="/engagements/{engagement_id}/activity",
    tags=["activity"],
    dependencies=[Depends(require_engagement)],
)


def _to_out(entry: ActivityLogEntry, operator_name: str) -> ActivityOut:
    return ActivityOut(
        id=entry.id,
        engagement_id=entry.engagement_id,
        operator_id=entry.operator_id,
        operator_name=operator_name,
        ts=entry.ts,
        action_type=entry.action_type,
        target_asset_id=entry.target_asset_id,
        workstream_id=entry.workstream_id,
        command=entry.command,
        source_ip=entry.source_ip,
        mitre_technique=entry.mitre_technique,
        description=entry.description,
    )


@router.get("", response_model=list[ActivityOut])
async def list_activity(
    engagement_id: uuid.UUID,
    target_asset_id: uuid.UUID | None = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
) -> list[ActivityOut]:
    query = (
        select(ActivityLogEntry, User.display_name)
        .join(User, User.id == ActivityLogEntry.operator_id)
        .where(ActivityLogEntry.engagement_id == engagement_id)
    )
    if target_asset_id is not None:
        query = query.where(ActivityLogEntry.target_asset_id == target_asset_id)
    query = query.order_by(ActivityLogEntry.ts.desc()).limit(min(limit, 500))
    rows = (await db.execute(query)).all()
    return [_to_out(entry, name) for entry, name in rows]


@router.post(
    "",
    response_model=ActivityOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_activity(
    engagement_id: uuid.UUID,
    payload: ActivityCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityOut:
    """Quick-capture: operator + timestamp are stamped automatically."""
    entry = ActivityLogEntry(
        engagement_id=engagement_id,
        operator_id=user.id,
        action_type=payload.action_type,
        target_asset_id=payload.target_asset_id,
        workstream_id=payload.workstream_id,
        command=payload.command,
        source_ip=payload.source_ip,
        mitre_technique=payload.mitre_technique,
        description=payload.description,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return _to_out(entry, user.display_name)
