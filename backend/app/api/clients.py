import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.core.deps import get_current_user, require_admin, verify_csrf
from app.models.client import Client, ClientContact
from app.schemas.client import ClientCreate, ClientOut, ContactCreate, ContactOut

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get(
    "", response_model=list[ClientOut], dependencies=[Depends(get_current_user)]
)
async def list_clients(db: AsyncSession = Depends(get_db)) -> list[Client]:
    res = await db.scalars(
        select(Client).options(selectinload(Client.contacts)).order_by(Client.name)
    )
    return list(res)


@router.post(
    "",
    response_model=ClientOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf), Depends(require_admin)],
)
async def create_client(
    payload: ClientCreate, db: AsyncSession = Depends(get_db)
) -> Client:
    if await db.scalar(select(Client).where(Client.name == payload.name)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Client name exists")
    c = Client(**payload.model_dump())
    db.add(c)
    await db.commit()
    c = await db.scalar(
        select(Client).where(Client.id == c.id).options(selectinload(Client.contacts))
    )
    return c


@router.delete(
    "/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf), Depends(require_admin)],
)
async def delete_client(
    client_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> None:
    c = await db.get(Client, client_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    await db.delete(c)
    await db.commit()


@router.post(
    "/{client_id}/contacts",
    response_model=ContactOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf), Depends(require_admin)],
)
async def add_contact(
    client_id: uuid.UUID,
    payload: ContactCreate,
    db: AsyncSession = Depends(get_db),
) -> ClientContact:
    if await db.get(Client, client_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")
    contact = ClientContact(client_id=client_id, **payload.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete(
    "/{client_id}/contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf), Depends(require_admin)],
)
async def delete_contact(
    client_id: uuid.UUID,
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    contact = await db.get(ClientContact, contact_id)
    if contact is None or contact.client_id != client_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    await db.delete(contact)
    await db.commit()
