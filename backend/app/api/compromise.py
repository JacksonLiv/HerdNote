import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user, require_engagement, verify_csrf
from app.core.security import decrypt_secret, encrypt_secret
from app.models.compromise import Artifact, CompromisedUser
from app.models.user import User
from app.schemas.compromise import (
    ArtifactCreate,
    ArtifactOut,
    ArtifactUpdate,
    CompromisedUserCreate,
    CompromisedUserOut,
    CompromisedUserUpdate,
    SecretReveal,
)

users_router = APIRouter(
    prefix="/engagements/{engagement_id}/compromised-users",
    tags=["compromised-users"],
    dependencies=[Depends(require_engagement)],
)
artifacts_router = APIRouter(
    prefix="/engagements/{engagement_id}/artifacts",
    tags=["artifacts"],
    dependencies=[Depends(require_engagement)],
)


def _cu_out(cu: CompromisedUser) -> CompromisedUserOut:
    return CompromisedUserOut(
        id=cu.id,
        engagement_id=cu.engagement_id,
        asset_id=cu.asset_id,
        workstream_id=cu.workstream_id,
        username=cu.username,
        domain=cu.domain,
        privilege=cu.privilege,
        method_md=cu.method_md,
        has_secret=cu.secret_encrypted is not None,
        validated=cu.validated,
        notes_md=cu.notes_md,
        created_at=cu.created_at,
    )


async def _get_cu(
    db: AsyncSession, engagement_id: uuid.UUID, cu_id: uuid.UUID
) -> CompromisedUser:
    cu = await db.get(CompromisedUser, cu_id)
    if cu is None or cu.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return cu


@users_router.get("", response_model=list[CompromisedUserOut])
async def list_compromised_users(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[CompromisedUserOut]:
    query = (
        select(CompromisedUser)
        .where(CompromisedUser.engagement_id == engagement_id)
        .order_by(CompromisedUser.created_at.desc())
    )
    if workstream_id is not None:
        query = query.where(CompromisedUser.workstream_id == workstream_id)
    res = await db.scalars(query)
    return [_cu_out(c) for c in res]


@users_router.post(
    "",
    response_model=CompromisedUserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_compromised_user(
    engagement_id: uuid.UUID,
    payload: CompromisedUserCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CompromisedUserOut:
    cu = CompromisedUser(
        engagement_id=engagement_id,
        asset_id=payload.asset_id,
        workstream_id=payload.workstream_id,
        username=payload.username,
        domain=payload.domain,
        privilege=payload.privilege,
        method_md=payload.method_md,
        secret_encrypted=encrypt_secret(payload.secret) if payload.secret else None,
        validated=payload.validated,
        notes_md=payload.notes_md,
        created_by=user.id,
    )
    db.add(cu)
    await db.commit()
    await db.refresh(cu)
    return _cu_out(cu)


@users_router.patch(
    "/{cu_id}",
    response_model=CompromisedUserOut,
    dependencies=[Depends(verify_csrf)],
)
async def update_compromised_user(
    engagement_id: uuid.UUID,
    cu_id: uuid.UUID,
    payload: CompromisedUserUpdate,
    db: AsyncSession = Depends(get_db),
) -> CompromisedUserOut:
    cu = await _get_cu(db, engagement_id, cu_id)
    data = payload.model_dump(exclude_unset=True)
    if "secret" in data:
        secret = data.pop("secret")
        cu.secret_encrypted = encrypt_secret(secret) if secret else None
    for field, value in data.items():
        setattr(cu, field, value)
    await db.commit()
    await db.refresh(cu)
    return _cu_out(cu)


@users_router.post(
    "/{cu_id}/reveal",
    response_model=SecretReveal,
    dependencies=[Depends(verify_csrf)],
)
async def reveal_secret(
    engagement_id: uuid.UUID,
    cu_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> SecretReveal:
    """Explicit, member-gated decrypt — secrets are never in list/get."""
    cu = await _get_cu(db, engagement_id, cu_id)
    if cu.secret_encrypted is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No secret stored")
    return SecretReveal(secret=decrypt_secret(cu.secret_encrypted))


@users_router.delete("/{cu_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_compromised_user(
    engagement_id: uuid.UUID,
    cu_id: uuid.UUID,
    _: None = Depends(verify_csrf),
    db: AsyncSession = Depends(get_db),
) -> None:
    cu = await _get_cu(db, engagement_id, cu_id)
    await db.delete(cu)
    await db.commit()


# --- artifacts ---
async def _get_art(
    db: AsyncSession, engagement_id: uuid.UUID, art_id: uuid.UUID
) -> Artifact:
    art = await db.get(Artifact, art_id)
    if art is None or art.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return art


@artifacts_router.get("", response_model=list[ArtifactOut])
async def list_artifacts(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Artifact]:
    q = select(Artifact).where(Artifact.engagement_id == engagement_id)
    if workstream_id is not None:
        q = q.where(Artifact.workstream_id == workstream_id)
    res = await db.scalars(q.order_by(Artifact.introduced_at.desc()))
    return list(res)


@artifacts_router.post(
    "",
    response_model=ArtifactOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_artifact(
    engagement_id: uuid.UUID,
    payload: ArtifactCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Artifact:
    art = Artifact(
        engagement_id=engagement_id,
        asset_id=payload.asset_id,
        workstream_id=payload.workstream_id,
        type=payload.type,
        description=payload.description,
        notes=payload.notes,
        introduced_by=user.id,
    )
    db.add(art)
    await db.commit()
    await db.refresh(art)
    return art


@artifacts_router.patch(
    "/{art_id}",
    response_model=ArtifactOut,
    dependencies=[Depends(verify_csrf)],
)
async def update_artifact(
    engagement_id: uuid.UUID,
    art_id: uuid.UUID,
    payload: ArtifactUpdate,
    db: AsyncSession = Depends(get_db),
) -> Artifact:
    art = await _get_art(db, engagement_id, art_id)
    data = payload.model_dump(exclude_unset=True)
    if "removed" in data:
        art.removed = data.pop("removed")
        art.removed_at = datetime.now(UTC) if art.removed else None
    for field, value in data.items():
        setattr(art, field, value)
    await db.commit()
    await db.refresh(art)
    return art


@artifacts_router.delete("/{art_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_artifact(
    engagement_id: uuid.UUID,
    art_id: uuid.UUID,
    _: None = Depends(verify_csrf),
    db: AsyncSession = Depends(get_db),
) -> None:
    art = await _get_art(db, engagement_id, art_id)
    await db.delete(art)
    await db.commit()
