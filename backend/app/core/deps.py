import uuid

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import read_session
from app.models.engagement import Engagement, EngagementMember
from app.models.user import User

SESSION_COOKIE = "session"


async def get_current_user(
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> User:
    data = read_session(session)
    if not data:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    user = await db.get(User, uuid.UUID(data["uid"]))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return user


async def require_engagement(
    engagement_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Engagement:
    """Validate the engagement exists and the caller may access it."""
    eng = await db.get(Engagement, engagement_id)
    if eng is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Engagement not found")
    if user.role != "admin":
        is_member = await db.scalar(
            select(
                exists().where(
                    EngagementMember.engagement_id == engagement_id,
                    EngagementMember.user_id == user.id,
                )
            )
        )
        if not is_member:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this engagement")
    return eng


async def verify_csrf(
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
    x_csrf_token: str | None = Header(default=None),
) -> None:
    """Double-submit CSRF: header must match the token signed into the session."""
    data = read_session(session)
    if not data or not x_csrf_token or x_csrf_token != data.get("csrf"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "CSRF check failed")
