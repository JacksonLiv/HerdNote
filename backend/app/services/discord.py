"""Fire-and-forget Discord webhook notifications."""
import asyncio

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.engagement import Engagement, EngagementMember
from app.models.user import User

_PRIV_COLORS = {
    "domain_admin": 0xFF2222,
    "root": 0xFF5500,
    "local_admin": 0xFF8800,
    "service": 0xAA88FF,
    "user": 0x4488FF,
    "other": 0x888888,
}


async def _send(url: str, payload: dict) -> None:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(url, json=payload)
    except Exception:
        pass  # best-effort; never crash the request path


async def notify_new_credential(
    db: AsyncSession,
    engagement_id: str,
    username: str,
    domain: str | None,
    privilege: str,
    source: str | None,
    added_by_name: str,
) -> None:
    """Notify all engagement members who have a Discord webhook configured."""
    eng = await db.get(Engagement, engagement_id)
    if eng is None:
        return

    result = await db.scalars(
        select(User)
        .join(EngagementMember, EngagementMember.user_id == User.id)
        .where(
            EngagementMember.engagement_id == eng.id,
            User.discord_webhook_url.is_not(None),
        )
    )
    recipients = list(result)
    if not recipients:
        return

    cred_display = f"{domain}\\\\{username}" if domain else username
    color = _PRIV_COLORS.get(privilege, 0x4488FF)

    fields = [
        {"name": "Account", "value": f"`{cred_display}`", "inline": True},
        {"name": "Privilege", "value": privilege.replace("_", " ").title(), "inline": True},
    ]
    if source:
        fields.append({"name": "Method", "value": source, "inline": True})
    fields += [
        {"name": "Engagement", "value": eng.name, "inline": False},
        {"name": "Added by", "value": added_by_name, "inline": True},
    ]

    payload = {
        "embeds": [{
            "title": "🔑 New Credential Captured",
            "color": color,
            "fields": fields,
            "footer": {"text": "HerdNote · check your Credentials tab"},
        }]
    }

    tasks = [asyncio.create_task(_send(u.discord_webhook_url, payload)) for u in recipients]
    # Gather best-effort; errors are swallowed inside _send.
    await asyncio.gather(*tasks, return_exceptions=True)
