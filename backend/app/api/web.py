import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_engagement, verify_csrf
from app.models.web import Domain, WebApp
from app.schemas.web import (
    DomainCreate,
    DomainOut,
    DomainUpdate,
    WebAppCreate,
    WebAppOut,
    WebAppUpdate,
)

domains_router = APIRouter(
    prefix="/engagements/{engagement_id}/domains",
    tags=["domains"],
    dependencies=[Depends(require_engagement)],
)
webapps_router = APIRouter(
    prefix="/engagements/{engagement_id}/webapps",
    tags=["webapps"],
    dependencies=[Depends(require_engagement)],
)


# --- domains ---
@domains_router.get("", response_model=list[DomainOut])
async def list_domains(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Domain]:
    q = select(Domain).where(Domain.engagement_id == engagement_id)
    if workstream_id is not None:
        q = q.where(Domain.workstream_id == workstream_id)
    return list(await db.scalars(q.order_by(Domain.name)))


@domains_router.post(
    "",
    response_model=DomainOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_domain(
    engagement_id: uuid.UUID,
    payload: DomainCreate,
    db: AsyncSession = Depends(get_db),
) -> Domain:
    d = Domain(engagement_id=engagement_id, **payload.model_dump())
    db.add(d)
    await db.commit()
    await db.refresh(d)
    return d


@domains_router.patch(
    "/{domain_id}", response_model=DomainOut, dependencies=[Depends(verify_csrf)]
)
async def update_domain(
    engagement_id: uuid.UUID,
    domain_id: uuid.UUID,
    payload: DomainUpdate,
    db: AsyncSession = Depends(get_db),
) -> Domain:
    d = await db.get(Domain, domain_id)
    if d is None or d.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Domain not found")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(d, f, v)
    await db.commit()
    await db.refresh(d)
    return d


@domains_router.delete(
    "/{domain_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_domain(
    engagement_id: uuid.UUID,
    domain_id: uuid.UUID,
    _: None = Depends(verify_csrf),
    db: AsyncSession = Depends(get_db),
) -> None:
    d = await db.get(Domain, domain_id)
    if d is None or d.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Domain not found")
    await db.delete(d)
    await db.commit()


# --- webapps ---
@webapps_router.get("", response_model=list[WebAppOut])
async def list_webapps(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[WebApp]:
    q = select(WebApp).where(WebApp.engagement_id == engagement_id)
    if workstream_id is not None:
        q = q.where(WebApp.workstream_id == workstream_id)
    return list(await db.scalars(q.order_by(WebApp.url)))


@webapps_router.post(
    "",
    response_model=WebAppOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_webapp(
    engagement_id: uuid.UUID,
    payload: WebAppCreate,
    db: AsyncSession = Depends(get_db),
) -> WebApp:
    w = WebApp(engagement_id=engagement_id, **payload.model_dump())
    db.add(w)
    await db.commit()
    await db.refresh(w)
    return w


@webapps_router.patch(
    "/{webapp_id}", response_model=WebAppOut, dependencies=[Depends(verify_csrf)]
)
async def update_webapp(
    engagement_id: uuid.UUID,
    webapp_id: uuid.UUID,
    payload: WebAppUpdate,
    db: AsyncSession = Depends(get_db),
) -> WebApp:
    w = await db.get(WebApp, webapp_id)
    if w is None or w.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Webapp not found")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(w, f, v)
    await db.commit()
    await db.refresh(w)
    return w


@webapps_router.delete(
    "/{webapp_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_webapp(
    engagement_id: uuid.UUID,
    webapp_id: uuid.UUID,
    _: None = Depends(verify_csrf),
    db: AsyncSession = Depends(get_db),
) -> None:
    w = await db.get(WebApp, webapp_id)
    if w is None or w.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Webapp not found")
    await db.delete(w)
    await db.commit()
