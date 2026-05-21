import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import (
    SESSION_COOKIE,
    get_current_user,
    require_admin,
    verify_csrf,
)
from app.core.security import (
    SESSION_MAX_AGE,
    hash_password,
    make_session,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import LoginIn, MeOut, ProfileUpdate, RegisterIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, user_id: str) -> str:
    cookie, csrf = make_session(user_id)
    response.set_cookie(
        SESSION_COOKIE,
        cookie,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,  # behind TLS in prod; documented in README.
    )
    return csrf


@router.get("/bootstrap-status")
async def bootstrap_status(db: AsyncSession = Depends(get_db)) -> dict:
    """First-run: true when no users exist (show initial-admin setup)."""
    count = await db.scalar(select(func.count()).select_from(User))
    return {"needs_setup": count == 0}


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterIn, db: AsyncSession = Depends(get_db)) -> User:
    """First user (no users yet) becomes admin without auth; afterwards admin-only."""
    user_count = await db.scalar(select(func.count()).select_from(User))
    if user_count == 0:
        role = "admin"
    else:
        # Enforce admin auth + CSRF for subsequent user creation.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Setup already complete; use the admin user-management endpoint.",
        )

    exists = await db.scalar(select(User).where(User.username == payload.username))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Username taken")

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf), Depends(require_admin)],
)
async def create_user(payload: RegisterIn, db: AsyncSession = Depends(get_db)) -> User:
    """Admin-only: add operators/admins after initial setup."""
    exists = await db.scalar(select(User).where(User.username == payload.username))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Username taken")
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/users", response_model=list[UserOut], dependencies=[Depends(require_admin)])
async def list_users(db: AsyncSession = Depends(get_db)) -> list[User]:
    res = await db.scalars(select(User).order_by(User.display_name))
    return list(res)


@router.post("/login", response_model=MeOut)
async def login(
    payload: LoginIn, response: Response, db: AsyncSession = Depends(get_db)
) -> dict:
    user = await db.scalar(select(User).where(User.username == payload.username))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    csrf = _set_session_cookie(response, str(user.id))
    return {**UserOut.model_validate(user).model_dump(), "csrf_token": csrf}


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@router.get("/me", response_model=MeOut)
async def me(response: Response, user: User = Depends(get_current_user)) -> dict:
    # Refresh the cookie so an active session keeps a fresh CSRF token.
    csrf = _set_session_cookie(response, str(user.id))
    return {**UserOut.model_validate(user).model_dump(), "csrf_token": csrf}


@router.patch(
    "/me",
    response_model=MeOut,
    dependencies=[Depends(verify_csrf)],
)
async def update_profile(
    payload: ProfileUpdate,
    response: Response,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    csrf = _set_session_cookie(response, str(user.id))
    return {**UserOut.model_validate(user).model_dump(), "csrf_token": csrf}


@router.post(
    "/me/test-discord",
    dependencies=[Depends(verify_csrf)],
)
async def test_discord_webhook(
    user: User = Depends(get_current_user),
) -> dict:
    if not user.discord_webhook_url:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No webhook URL configured")
    payload = {
        "embeds": [{
            "title": "✅ HerdNote webhook test",
            "description": f"Hey {user.display_name}! Your Discord webhook is wired up correctly. You'll receive new credential notifications here.",
            "color": 0x2ECC71,
        }]
    }
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.post(user.discord_webhook_url, json=payload)
            r.raise_for_status()
    except Exception as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Discord returned an error: {exc}") from exc
    return {"ok": True}
