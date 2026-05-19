import hashlib
import uuid
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import get_current_user, require_engagement, verify_csrf
from app.models.evidence import EVIDENCE_PARENTS, Evidence
from app.models.user import User
from app.schemas.evidence import EvidenceOut

settings = get_settings()

router = APIRouter(
    prefix="/engagements/{engagement_id}/evidence",
    tags=["evidence"],
    dependencies=[Depends(require_engagement)],
)

_CHUNK = 1 << 20  # 1 MiB


def _out(e: Evidence, engagement_id: uuid.UUID) -> EvidenceOut:
    return EvidenceOut(
        id=e.id,
        engagement_id=e.engagement_id,
        parent_type=e.parent_type,
        parent_id=e.parent_id,
        filename=e.filename,
        content_type=e.content_type,
        sha256=e.sha256,
        caption=e.caption,
        uploaded_by=e.uploaded_by,
        uploaded_at=e.uploaded_at,
        url=f"/api/engagements/{engagement_id}/evidence/{e.id}/download",
    )


async def _get(db: AsyncSession, engagement_id: uuid.UUID, ev_id: uuid.UUID) -> Evidence:
    ev = await db.get(Evidence, ev_id)
    if ev is None or ev.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evidence not found")
    return ev


@router.get("", response_model=list[EvidenceOut])
async def list_evidence(
    engagement_id: uuid.UUID,
    parent_type: str | None = None,
    parent_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[EvidenceOut]:
    query = select(Evidence).where(Evidence.engagement_id == engagement_id)
    if parent_type is not None:
        query = query.where(Evidence.parent_type == parent_type)
    if parent_id is not None:
        query = query.where(Evidence.parent_id == parent_id)
    res = await db.scalars(query.order_by(Evidence.uploaded_at.desc()))
    return [_out(e, engagement_id) for e in res]


@router.post(
    "",
    response_model=EvidenceOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def upload_evidence(
    engagement_id: uuid.UUID,
    parent_type: str = Form(...),
    parent_id: uuid.UUID = Form(...),
    caption: str | None = Form(None),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EvidenceOut:
    """Drag-drop / clipboard-paste upload, auto-attached to a parent entity."""
    if parent_type not in EVIDENCE_PARENTS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Bad parent_type")

    ev_id = uuid.uuid4()
    suffix = Path(file.filename or "").suffix
    eng_dir = Path(settings.evidence_dir) / str(engagement_id)
    eng_dir.mkdir(parents=True, exist_ok=True)
    dest = eng_dir / f"{ev_id}{suffix}"

    digest = hashlib.sha256()
    with dest.open("wb") as fh:
        while chunk := await file.read(_CHUNK):
            digest.update(chunk)
            fh.write(chunk)

    ev = Evidence(
        id=ev_id,
        engagement_id=engagement_id,
        parent_type=parent_type,
        parent_id=parent_id,
        filename=file.filename or f"{ev_id}{suffix}",
        stored_path=str(dest),
        content_type=file.content_type or "application/octet-stream",
        sha256=digest.hexdigest(),
        caption=caption,
        uploaded_by=user.id,
    )
    db.add(ev)
    await db.commit()
    await db.refresh(ev)
    return _out(ev, engagement_id)


@router.get("/{ev_id}/download")
async def download_evidence(
    engagement_id: uuid.UUID,
    ev_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    ev = await _get(db, engagement_id, ev_id)
    if not Path(ev.stored_path).exists():
        raise HTTPException(status.HTTP_410_GONE, "File missing on disk")
    return FileResponse(
        ev.stored_path, media_type=ev.content_type, filename=ev.filename
    )


@router.delete("/{ev_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evidence(
    engagement_id: uuid.UUID,
    ev_id: uuid.UUID,
    _: None = Depends(verify_csrf),
    db: AsyncSession = Depends(get_db),
) -> None:
    ev = await _get(db, engagement_id, ev_id)
    Path(ev.stored_path).unlink(missing_ok=True)
    await db.delete(ev)
    await db.commit()
