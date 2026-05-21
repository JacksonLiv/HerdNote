import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_engagement, verify_csrf
from app.models.web import Domain, WebApp, WebHost, WebSubdomain
from app.schemas.web import (
    DomainCreate,
    DomainOut,
    DomainUpdate,
    WebAppCreate,
    WebAppOut,
    WebAppUpdate,
    WebHostCreate,
    WebHostOut,
    WebHostUpdate,
    WebSubdomainBulkCreate,
    WebSubdomainCreate,
    WebSubdomainOut,
    WebSubdomainUpdate,
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
web_hosts_router = APIRouter(
    prefix="/engagements/{engagement_id}/web-hosts",
    tags=["web-hosts"],
    dependencies=[Depends(require_engagement)],
)
web_subdomains_router = APIRouter(
    prefix="/engagements/{engagement_id}/web-subdomains",
    tags=["web-subdomains"],
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


# ── WebHost CRUD ─────────────────────────────────────────────────────────────


@web_hosts_router.get("", response_model=list[WebHostOut])
async def list_web_hosts(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[WebHost]:
    q = select(WebHost).where(WebHost.engagement_id == engagement_id)
    if workstream_id is not None:
        q = q.where(WebHost.workstream_id == workstream_id)
    return list(await db.scalars(q.order_by(WebHost.fqdn)))


@web_hosts_router.post(
    "",
    response_model=WebHostOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_web_host(
    engagement_id: uuid.UUID,
    payload: WebHostCreate,
    db: AsyncSession = Depends(get_db),
) -> WebHost:
    h = WebHost(engagement_id=engagement_id, **payload.model_dump())
    db.add(h)
    await db.commit()
    await db.refresh(h)
    return h


@web_hosts_router.patch(
    "/{host_id}", response_model=WebHostOut, dependencies=[Depends(verify_csrf)]
)
async def update_web_host(
    engagement_id: uuid.UUID,
    host_id: uuid.UUID,
    payload: WebHostUpdate,
    db: AsyncSession = Depends(get_db),
) -> WebHost:
    h = await db.get(WebHost, host_id)
    if h is None or h.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Host not found")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(h, f, v)
    await db.commit()
    await db.refresh(h)
    return h


@web_hosts_router.delete("/{host_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_web_host(
    engagement_id: uuid.UUID,
    host_id: uuid.UUID,
    _: None = Depends(verify_csrf),
    db: AsyncSession = Depends(get_db),
) -> None:
    h = await db.get(WebHost, host_id)
    if h is None or h.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Host not found")
    await db.delete(h)
    await db.commit()


# ── WebSubdomain CRUD + bulk ──────────────────────────────────────────────────


@web_subdomains_router.get("", response_model=list[WebSubdomainOut])
async def list_web_subdomains(
    engagement_id: uuid.UUID,
    host_id: uuid.UUID | None = None,
    workstream_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[WebSubdomain]:
    q = select(WebSubdomain).where(WebSubdomain.engagement_id == engagement_id)
    if host_id is not None:
        q = q.where(WebSubdomain.host_id == host_id)
    if workstream_id is not None:
        q = q.where(WebSubdomain.workstream_id == workstream_id)
    return list(await db.scalars(q.order_by(WebSubdomain.fqdn)))


@web_subdomains_router.post(
    "",
    response_model=WebSubdomainOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_web_subdomain(
    engagement_id: uuid.UUID,
    payload: WebSubdomainCreate,
    db: AsyncSession = Depends(get_db),
) -> WebSubdomain:
    s = WebSubdomain(engagement_id=engagement_id, **payload.model_dump())
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


@web_subdomains_router.post(
    "/bulk",
    response_model=list[WebSubdomainOut],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def bulk_create_web_subdomains(
    engagement_id: uuid.UUID,
    payload: WebSubdomainBulkCreate,
    db: AsyncSession = Depends(get_db),
) -> list[WebSubdomain]:
    """One FQDN per line; skips blank lines and duplicates within this host."""
    existing = set(
        await db.scalars(
            select(WebSubdomain.fqdn).where(
                WebSubdomain.host_id == payload.host_id,
                WebSubdomain.engagement_id == engagement_id,
            )
        )
    )
    created: list[WebSubdomain] = []
    for line in payload.text.splitlines():
        fqdn = line.strip().lower()
        if not fqdn or fqdn in existing:
            continue
        existing.add(fqdn)
        s = WebSubdomain(
            engagement_id=engagement_id,
            host_id=payload.host_id,
            fqdn=fqdn,
            workstream_id=payload.workstream_id,
        )
        db.add(s)
        created.append(s)
    await db.commit()
    for s in created:
        await db.refresh(s)
    return created


@web_subdomains_router.patch(
    "/{subdomain_id}", response_model=WebSubdomainOut, dependencies=[Depends(verify_csrf)]
)
async def update_web_subdomain(
    engagement_id: uuid.UUID,
    subdomain_id: uuid.UUID,
    payload: WebSubdomainUpdate,
    db: AsyncSession = Depends(get_db),
) -> WebSubdomain:
    s = await db.get(WebSubdomain, subdomain_id)
    if s is None or s.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subdomain not found")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(s, f, v)
    await db.commit()
    await db.refresh(s)
    return s


@web_subdomains_router.delete("/{subdomain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_web_subdomain(
    engagement_id: uuid.UUID,
    subdomain_id: uuid.UUID,
    _: None = Depends(verify_csrf),
    db: AsyncSession = Depends(get_db),
) -> None:
    s = await db.get(WebSubdomain, subdomain_id)
    if s is None or s.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subdomain not found")
    await db.delete(s)
    await db.commit()
