import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user, require_engagement, verify_csrf
from app.models.scratch_note import ScratchNote
from app.models.user import User
from app.models.workstream import Workstream
from app.schemas.scratch_note import ScratchNoteCreate, ScratchNoteOut, ScratchNoteUpdate

router = APIRouter(
    prefix="/engagements/{engagement_id}/workstreams/{workstream_id}/scratch-notes",
    tags=["scratch-notes"],
    dependencies=[Depends(require_engagement)],
)


async def _require_ws(db: AsyncSession, engagement_id: uuid.UUID, workstream_id: uuid.UUID) -> Workstream:
    ws = await db.get(Workstream, workstream_id)
    if ws is None or ws.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workstream not found")
    return ws


@router.get("", response_model=list[ScratchNoteOut])
async def list_notes(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[ScratchNoteOut]:
    await _require_ws(db, engagement_id, workstream_id)
    rows = await db.scalars(
        select(ScratchNote)
        .where(ScratchNote.workstream_id == workstream_id)
        .order_by(ScratchNote.updated_at.desc())
    )
    return [ScratchNoteOut.model_validate(r) for r in rows]


@router.post("", response_model=ScratchNoteOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_csrf)])
async def create_note(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID,
    payload: ScratchNoteCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScratchNoteOut:
    await _require_ws(db, engagement_id, workstream_id)
    note = ScratchNote(
        engagement_id=engagement_id,
        workstream_id=workstream_id,
        title=payload.title,
        body=payload.body,
        created_by=user.id,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return ScratchNoteOut.model_validate(note)


@router.patch("/{note_id}", response_model=ScratchNoteOut, dependencies=[Depends(verify_csrf)])
async def update_note(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID,
    note_id: uuid.UUID,
    payload: ScratchNoteUpdate,
    db: AsyncSession = Depends(get_db),
) -> ScratchNoteOut:
    await _require_ws(db, engagement_id, workstream_id)
    note = await db.get(ScratchNote, note_id)
    if note is None or note.workstream_id != workstream_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(note, field, value)
    await db.commit()
    await db.refresh(note)
    return ScratchNoteOut.model_validate(note)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_csrf)])
async def delete_note(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID,
    note_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    await _require_ws(db, engagement_id, workstream_id)
    note = await db.get(ScratchNote, note_id)
    if note is None or note.workstream_id != workstream_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    await db.delete(note)
    await db.commit()
