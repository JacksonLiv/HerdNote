from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user, require_engagement
from app.export.builder import build_export
from app.models.engagement import Engagement
from app.models.user import User

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
