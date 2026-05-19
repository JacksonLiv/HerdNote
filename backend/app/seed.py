"""Optional sample-data seeder: `python -m app.seed`.

Creates an initial admin (idempotent) and a demo engagement so a fresh
deployment isn't a blank screen. Safe to run repeatedly.
"""

import asyncio

from sqlalchemy import func, select

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models.engagement import Engagement, EngagementMember
from app.models.user import User
from app.models.workstream import Workstream

ADMIN_USER = "admin"
ADMIN_PASS = "changeme123"


async def seed() -> None:
    async with SessionLocal() as db:
        count = await db.scalar(select(func.count()).select_from(User))
        if count:
            print("Users already exist — skipping seed.")
            return

        admin = User(
            username=ADMIN_USER,
            password_hash=hash_password(ADMIN_PASS),
            display_name="CyberHerd Admin",
            role="admin",
        )
        db.add(admin)
        await db.flush()

        eng = Engagement(name="Demo Engagement", type="redteam", created_by=admin.id)
        db.add(eng)
        await db.flush()
        db.add(EngagementMember(engagement_id=eng.id, user_id=admin.id, role="lead"))
        db.add(
            Workstream(engagement_id=eng.id, name="Active Directory", kind="active_directory")
        )
        db.add(Workstream(engagement_id=eng.id, name="Web", kind="web"))
        await db.commit()

    print(f"Seeded admin '{ADMIN_USER}' / '{ADMIN_PASS}' — CHANGE THIS PASSWORD.")


if __name__ == "__main__":
    asyncio.run(seed())
