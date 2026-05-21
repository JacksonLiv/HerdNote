"""Admin routes for Ghostwriter integration config."""

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_admin, verify_csrf
from app.models.ghostwriter import GhostwriterSettings
from app.schemas.ghostwriter import GhostwriterSettingsIn, GhostwriterSettingsOut

router = APIRouter(
    prefix="/admin/ghostwriter",
    tags=["ghostwriter"],
    dependencies=[Depends(require_admin)],
)


async def _get_row(db: AsyncSession) -> GhostwriterSettings | None:
    return await db.scalar(
        select(GhostwriterSettings).where(GhostwriterSettings.id == 1)
    )


@router.get("", response_model=GhostwriterSettingsOut)
async def get_ghostwriter_config(db: AsyncSession = Depends(get_db)) -> dict:
    row = await _get_row(db)
    return {
        "url": row.url if row else None,
        "enabled": row.enabled if row else False,
        "token_set": bool(row and row.api_token),
    }


@router.put(
    "",
    response_model=GhostwriterSettingsOut,
    dependencies=[Depends(verify_csrf)],
)
async def update_ghostwriter_config(
    body: GhostwriterSettingsIn,
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await _get_row(db)
    if row is None:
        row = GhostwriterSettings(id=1)
        db.add(row)
    row.url = body.url.rstrip("/")
    row.api_token = body.api_token
    row.enabled = body.enabled
    await db.commit()
    await db.refresh(row)
    return {
        "url": row.url,
        "enabled": row.enabled,
        "token_set": bool(row.api_token),
    }


@router.post("/test", dependencies=[Depends(verify_csrf)])
async def test_ghostwriter_connection(
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await _get_row(db)
    if not row or not row.url or not row.api_token:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Ghostwriter URL and API token must be saved first.",
        )
    try:
        async with httpx.AsyncClient(
            base_url=row.url,
            headers={"Authorization": f"Bearer {row.api_token}"},
            timeout=10.0,
        ) as gw:
            resp = await gw.post(
                "/api/graphql",
                json={"query": "query { severity(limit: 1) { id } }"},
            )
            resp.raise_for_status()
            data = resp.json()
            if "errors" in data:
                msgs = "; ".join(e.get("message", "") for e in data["errors"])
                raise RuntimeError(msgs)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Ghostwriter returned HTTP {exc.response.status_code}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"Connection failed: {exc}"
        ) from exc
    return {"ok": True, "message": "Connected to Ghostwriter successfully."}
