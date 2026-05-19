import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.core.deps import get_current_user, require_engagement, verify_csrf
from app.models.asset import Asset, asset_workstreams
from app.models.user import User
from app.models.workstream import Workstream
from app.schemas.asset import (
    AssetCreate,
    AssetOut,
    AssetUpdate,
    BulkAssetCreate,
    WorkstreamRef,
)
from app.services.nmap import parse_nmap_xml
from app.services.parsing import parse_asset_list

router = APIRouter(
    prefix="/engagements/{engagement_id}/assets",
    tags=["assets"],
    dependencies=[Depends(require_engagement)],
)


def _out(a: Asset) -> AssetOut:
    return AssetOut(
        id=a.id,
        engagement_id=a.engagement_id,
        workstreams=[WorkstreamRef.model_validate(w) for w in a.workstreams],
        workstream_ids=[w.id for w in a.workstreams],
        type=a.type,
        identifier=a.identifier,
        os=a.os,
        services=a.services or [],
        in_scope=a.in_scope,
        state=a.state,
        tags=a.tags or [],
        notes_md=a.notes_md,
        owner_op=a.owner_op,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


async def _load(db: AsyncSession, asset_id: uuid.UUID) -> Asset:
    """Re-fetch with workstreams eagerly loaded (safe to serialize)."""
    return await db.scalar(
        select(Asset)
        .where(Asset.id == asset_id)
        .options(selectinload(Asset.workstreams))
    )


async def _get_asset(db: AsyncSession, engagement_id: uuid.UUID, asset_id: uuid.UUID) -> Asset:
    asset = await db.get(Asset, asset_id)
    if asset is None or asset.engagement_id != engagement_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
    return asset


async def _resolve_ws(
    db: AsyncSession, engagement_id: uuid.UUID, ids: list[uuid.UUID]
) -> list[Workstream]:
    if not ids:
        return []
    res = await db.scalars(
        select(Workstream).where(
            Workstream.id.in_(ids), Workstream.engagement_id == engagement_id
        )
    )
    return list(res)


@router.get("", response_model=list[AssetOut])
async def list_assets(
    engagement_id: uuid.UUID,
    workstream_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[AssetOut]:
    query = (
        select(Asset)
        .where(Asset.engagement_id == engagement_id)
        .options(selectinload(Asset.workstreams))
    )
    if workstream_id is not None:
        # Scoped: only hosts assigned to this workstream (M2M).
        query = query.join(
            asset_workstreams, asset_workstreams.c.asset_id == Asset.id
        ).where(asset_workstreams.c.workstream_id == workstream_id)
    res = await db.scalars(query.order_by(Asset.identifier))
    return [_out(a) for a in res.unique()]


@router.post(
    "",
    response_model=AssetOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_asset(
    engagement_id: uuid.UUID,
    payload: AssetCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssetOut:
    asset = Asset(
        engagement_id=engagement_id,
        type=payload.type,
        identifier=payload.identifier,
        os=payload.os,
        in_scope=payload.in_scope,
        owner_op=user.id,
    )
    asset.workstreams = await _resolve_ws(db, engagement_id, payload.workstream_ids)
    db.add(asset)
    await db.commit()
    return _out(await _load(db, asset.id))


@router.post(
    "/bulk",
    response_model=list[AssetOut],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def bulk_create_assets(
    engagement_id: uuid.UUID,
    payload: BulkAssetCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AssetOut]:
    """Paste a list of IPs/CIDRs/hosts/URLs → many assets, skipping dupes."""
    parsed = parse_asset_list(payload.text)
    if not parsed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No hosts found in input")

    ws = await _resolve_ws(db, engagement_id, payload.workstream_ids)
    existing = set(
        await db.scalars(
            select(Asset.identifier).where(Asset.engagement_id == engagement_id)
        )
    )
    created: list[Asset] = []
    for atype, ident in parsed:
        if ident in existing:
            continue
        existing.add(ident)
        asset = Asset(
            engagement_id=engagement_id,
            type=atype,
            identifier=ident,
            owner_op=user.id,
        )
        asset.workstreams = list(ws)
        db.add(asset)
        created.append(asset)
    await db.commit()
    ids = [a.id for a in created]
    return [_out(await _load(db, i)) for i in ids]


@router.post(
    "/import-nmap",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def import_nmap(
    engagement_id: uuid.UUID,
    file: UploadFile | None = File(default=None),
    xml_text: str | None = Form(default=None),
    auto_split: bool = Form(default=True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Digest an nmap XML scan (uploaded file OR pasted text).

    With auto_split, hosts are assigned to AD/Web workstreams by service
    heuristics (auto-creating those workstreams). Every host is also visible
    engagement-wide ("All"). Tolerant parser handles messy/broken XML.
    """
    raw = b""
    if file is not None:
        raw = await file.read()
    elif xml_text:
        raw = xml_text.encode()
    if not raw.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No nmap XML provided")

    try:
        hosts = parse_nmap_xml(raw)
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from e
    if not hosts:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No up hosts in scan")

    # Resolve / create the AD + Web workstreams ONCE up front (reuse by kind),
    # so we never lazy-load a relationship in async context mid-loop.
    ws_by_kind: dict[str, Workstream] = {}
    for w in await db.scalars(
        select(Workstream).where(Workstream.engagement_id == engagement_id)
    ):
        ws_by_kind.setdefault(w.kind, w)

    if auto_split:
        if any(h.is_ad for h in hosts) and "active_directory" not in ws_by_kind:
            ws_by_kind["active_directory"] = Workstream(
                engagement_id=engagement_id,
                name="Active Directory",
                kind="active_directory",
            )
            db.add(ws_by_kind["active_directory"])
        if any(h.is_web for h in hosts) and "web" not in ws_by_kind:
            ws_by_kind["web"] = Workstream(
                engagement_id=engagement_id, name="Web", kind="web"
            )
            db.add(ws_by_kind["web"])
        await db.flush()
    ad_ws = ws_by_kind.get("active_directory")
    web_ws = ws_by_kind.get("web")

    existing = list(
        await db.scalars(
            select(Asset)
            .where(Asset.engagement_id == engagement_id)
            .options(selectinload(Asset.workstreams))
        )
    )
    by_ident: dict[str, Asset] = {a.identifier: a for a in existing}

    created = 0
    updated = 0
    split_counts = {"active_directory": 0, "web": 0}
    for h in hosts:
        svc = [s.as_dict() for s in h.services]
        targets: list[Workstream] = []
        if auto_split and h.is_ad and ad_ws is not None:
            targets.append(ad_ws)
        if auto_split and h.is_web and web_ws is not None:
            targets.append(web_ws)

        match = (
            by_ident.get(h.hostname or "")
            or by_ident.get(h.ip or "")
            or by_ident.get(h.identifier)
        )
        if match is not None:
            if h.os:
                match.os = h.os
            match.services = svc
            existing_ids = {w.id for w in match.workstreams}  # loaded via selectin
            for t in targets:
                if t.id not in existing_ids:
                    match.workstreams.append(t)
                    split_counts[t.kind] += 1
            updated += 1
        else:
            asset = Asset(
                engagement_id=engagement_id,
                type="host",
                identifier=h.identifier,
                os=h.os,
                services=svc,
                owner_op=user.id,
            )
            asset.workstreams = list(targets)
            for t in targets:
                split_counts[t.kind] += 1
            db.add(asset)
            by_ident[h.identifier] = asset
            created += 1

    await db.commit()
    return {
        "created": created,
        "updated": updated,
        "assigned_ad": split_counts["active_directory"],
        "assigned_web": split_counts["web"],
        "hosts": [
            {
                "identifier": h.identifier,
                "ports": len(h.services),
                "os": h.os,
                "ad": h.is_ad,
                "web": h.is_web,
            }
            for h in hosts
        ],
    }


@router.patch(
    "/{asset_id}",
    response_model=AssetOut,
    dependencies=[Depends(verify_csrf)],
)
async def update_asset(
    engagement_id: uuid.UUID,
    asset_id: uuid.UUID,
    payload: AssetUpdate,
    db: AsyncSession = Depends(get_db),
) -> AssetOut:
    """Inline edits incl. state machine + workstream membership (M2M)."""
    asset = await _get_asset(db, engagement_id, asset_id)
    data = payload.model_dump(exclude_unset=True)
    if "workstream_ids" in data:
        ids = data.pop("workstream_ids")
        asset.workstreams = await _resolve_ws(db, engagement_id, ids or [])
    for field, value in data.items():
        setattr(asset, field, value)
    await db.commit()
    return _out(await _load(db, asset.id))


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    engagement_id: uuid.UUID,
    asset_id: uuid.UUID,
    _: None = Depends(verify_csrf),
    db: AsyncSession = Depends(get_db),
) -> None:
    asset = await _get_asset(db, engagement_id, asset_id)
    await db.delete(asset)
    await db.commit()
