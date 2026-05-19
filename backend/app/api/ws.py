import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import exists, select

from app.core.db import SessionLocal
from app.core.security import read_session
from app.core.ws import hub
from app.models.engagement import Engagement, EngagementMember
from app.models.user import User

router = APIRouter()


@router.websocket("/ws/engagements/{engagement_id}")
async def engagement_ws(websocket: WebSocket, engagement_id: str) -> None:
    """Per-engagement live channel. Auth via the session cookie; membership-gated."""
    data = read_session(websocket.cookies.get("session"))
    if not data:
        await websocket.close(code=4401)
        return

    try:
        eid = uuid.UUID(engagement_id)
    except ValueError:
        await websocket.close(code=4404)
        return

    async with SessionLocal() as db:
        user = await db.get(User, uuid.UUID(data["uid"]))
        if user is None or await db.get(Engagement, eid) is None:
            await websocket.close(code=4404)
            return
        if user.role != "admin":
            is_member = await db.scalar(
                select(
                    exists().where(
                        EngagementMember.engagement_id == eid,
                        EngagementMember.user_id == user.id,
                    )
                )
            )
            if not is_member:
                await websocket.close(code=4403)
                return

    await websocket.accept()
    await hub.join(engagement_id, websocket)
    try:
        while True:
            # We don't expect client messages; this keeps the socket open.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await hub.leave(engagement_id, websocket)
