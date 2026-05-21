import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user, require_engagement, verify_csrf
from app.models.social_campaign import SocialCampaign
from app.models.user import User
from app.models.workstream import Workstream
from app.schemas.social_campaign import SocialCampaignCreate, SocialCampaignOut, SocialCampaignUpdate

router = APIRouter(
    prefix="/engagements/{engagement_id}/workstreams/{workstream_id}/campaigns",
    tags=["campaigns"],
    dependencies=[Depends(require_engagement)],
)


async def _require_ws(db: AsyncSession, engagement_id: uuid.UUID, workstream_id: uuid.UUID) -> Workstream:
    ws = await db.get(Workstream, workstream_id)
    if ws is None or ws.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workstream not found")
    return ws


@router.get("", response_model=list[SocialCampaignOut])
async def list_campaigns(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[SocialCampaignOut]:
    await _require_ws(db, engagement_id, workstream_id)
    rows = await db.scalars(
        select(SocialCampaign)
        .where(SocialCampaign.workstream_id == workstream_id)
        .order_by(SocialCampaign.created_at.desc())
    )
    return [SocialCampaignOut.model_validate(r) for r in rows]


@router.post("", response_model=SocialCampaignOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_csrf)])
async def create_campaign(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID,
    payload: SocialCampaignCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SocialCampaignOut:
    await _require_ws(db, engagement_id, workstream_id)
    campaign = SocialCampaign(
        engagement_id=engagement_id,
        workstream_id=workstream_id,
        created_by=user.id,
        **payload.model_dump(),
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return SocialCampaignOut.model_validate(campaign)


@router.patch("/{campaign_id}", response_model=SocialCampaignOut, dependencies=[Depends(verify_csrf)])
async def update_campaign(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID,
    campaign_id: uuid.UUID,
    payload: SocialCampaignUpdate,
    db: AsyncSession = Depends(get_db),
) -> SocialCampaignOut:
    await _require_ws(db, engagement_id, workstream_id)
    campaign = await db.get(SocialCampaign, campaign_id)
    if campaign is None or campaign.workstream_id != workstream_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    await db.commit()
    await db.refresh(campaign)
    return SocialCampaignOut.model_validate(campaign)


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_csrf)])
async def delete_campaign(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID,
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    await _require_ws(db, engagement_id, workstream_id)
    campaign = await db.get(SocialCampaign, campaign_id)
    if campaign is None or campaign.workstream_id != workstream_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    await db.delete(campaign)
    await db.commit()
