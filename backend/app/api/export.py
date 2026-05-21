from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.core.deps import get_current_user, require_engagement, verify_csrf
from app.export.builder import build_export
from app.models.engagement import Engagement
from app.models.finding import FindingDraft
from app.models.ghostwriter import GhostwriterSettings
from app.models.user import User
from app.schemas.ghostwriter import GhostwriterExportRequest, GhostwriterExportResult
from app.services.ghostwriter import export_engagement_to_ghostwriter

router = APIRouter(
    prefix="/engagements/{engagement_id}/export",
    tags=["export"],
)


@router.get("")
async def export_engagement(
    eng: Engagement = Depends(require_engagement),
    user: User = Depends(get_current_user),
    include_secrets: bool = False,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Versioned JSON export — the phase-2 report contract.

    Secrets are redacted by default. ``include_secrets=true`` requires admin
    and decrypts captured secrets into the payload.
    """
    if include_secrets and user.role != "admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Admin required to include secrets"
        )
    return await build_export(db, eng, include_secrets=include_secrets)


@router.post(
    "/ghostwriter",
    response_model=GhostwriterExportResult,
    dependencies=[Depends(verify_csrf)],
)
async def export_to_ghostwriter(
    body: GhostwriterExportRequest,
    eng: Engagement = Depends(require_engagement),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GhostwriterExportResult:
    """Push filtered findings to the configured Ghostwriter instance."""
    config = await db.scalar(
        select(GhostwriterSettings).where(GhostwriterSettings.id == 1)
    )
    if not config or not config.enabled or not config.url or not config.api_token:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Ghostwriter integration is not configured or not enabled. "
            "An admin must set it up in Admin → Integrations.",
        )

    all_findings = list(
        await db.scalars(
            select(FindingDraft)
            .where(FindingDraft.engagement_id == eng.id)
            .options(selectinload(FindingDraft.assets))
        )
    )
    filtered = [f for f in all_findings if f.status in body.statuses]

    if not filtered:
        return GhostwriterExportResult(
            pushed=0,
            updated=0,
            errors=["No findings matched the selected statuses."],
        )

    return await export_engagement_to_ghostwriter(config, eng, filtered)
