import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user, require_engagement, verify_csrf
from app.models.playbook import PlaybookState, WorkstreamNote
from app.models.user import User
from app.models.workstream import Workstream
from app.schemas.playbook import (
    PlaybookEnvelope,
    PlaybookStateOut,
    PlaybookStateUpsert,
    WorkstreamNoteCreate,
    WorkstreamNoteOut,
    WorkstreamNoteUpdate,
)

router = APIRouter(
    prefix="/engagements/{engagement_id}/workstreams/{workstream_id}/playbook",
    tags=["playbook"],
    dependencies=[Depends(require_engagement)],
)


async def _require_ws(
    db: AsyncSession, engagement_id: uuid.UUID, workstream_id: uuid.UUID
) -> Workstream:
    ws = await db.get(Workstream, workstream_id)
    if ws is None or ws.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workstream not found")
    return ws


@router.get("", response_model=PlaybookEnvelope)
async def get_playbook(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> PlaybookEnvelope:
    await _require_ws(db, engagement_id, workstream_id)
    state_rows = list(
        await db.scalars(
            select(PlaybookState).where(PlaybookState.workstream_id == workstream_id)
        )
    )
    note_rows = list(
        await db.scalars(
            select(WorkstreamNote)
            .where(WorkstreamNote.workstream_id == workstream_id)
            .order_by(WorkstreamNote.created_at.desc())
        )
    )
    return PlaybookEnvelope(
        state=[PlaybookStateOut.model_validate(s) for s in state_rows],
        notes=[WorkstreamNoteOut.model_validate(n) for n in note_rows],
    )


@router.patch(
    "/state/{task_key}",
    response_model=PlaybookStateOut,
    dependencies=[Depends(verify_csrf)],
)
async def upsert_state(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID,
    task_key: str,
    payload: PlaybookStateUpsert,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlaybookStateOut:
    await _require_ws(db, engagement_id, workstream_id)
    row = await db.scalar(
        select(PlaybookState).where(
            PlaybookState.workstream_id == workstream_id,
            PlaybookState.task_key == task_key,
        )
    )
    if row is None:
        row = PlaybookState(
            workstream_id=workstream_id,
            task_key=task_key,
            status=payload.status or "todo",
            notes_md=payload.notes_md,
            updated_by=user.id,
        )
        db.add(row)
    else:
        if payload.status is not None:
            row.status = payload.status
        if payload.notes_md is not None:
            row.notes_md = payload.notes_md
        row.updated_by = user.id
    await db.commit()
    await db.refresh(row)
    return PlaybookStateOut.model_validate(row)


@router.post(
    "/notes",
    response_model=WorkstreamNoteOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_note(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID,
    payload: WorkstreamNoteCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkstreamNoteOut:
    await _require_ws(db, engagement_id, workstream_id)
    note = WorkstreamNote(
        workstream_id=workstream_id,
        created_by=user.id,
        **payload.model_dump(),
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return WorkstreamNoteOut.model_validate(note)


@router.patch(
    "/notes/{note_id}",
    response_model=WorkstreamNoteOut,
    dependencies=[Depends(verify_csrf)],
)
async def update_note(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID,
    note_id: uuid.UUID,
    payload: WorkstreamNoteUpdate,
    db: AsyncSession = Depends(get_db),
) -> WorkstreamNoteOut:
    await _require_ws(db, engagement_id, workstream_id)
    note = await db.get(WorkstreamNote, note_id)
    if note is None or note.workstream_id != workstream_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(note, f, v)
    await db.commit()
    await db.refresh(note)
    return WorkstreamNoteOut.model_validate(note)


@router.delete(
    "/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
async def delete_note(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID,
    note_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    await _require_ws(db, engagement_id, workstream_id)
    note = await db.get(WorkstreamNote, note_id)
    if note is None or note.workstream_id != workstream_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    await db.delete(note)
    await db.commit()
