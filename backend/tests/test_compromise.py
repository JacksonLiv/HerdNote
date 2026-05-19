import uuid

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models.compromise import CompromisedUser


async def _admin_engagement(client):
    await client.post(
        "/api/auth/register",
        json={"username": "cap", "password": "supersecret", "display_name": "Cap"},
    )
    csrf = (
        await client.post(
            "/api/auth/login", json={"username": "cap", "password": "supersecret"}
        )
    ).json()["csrf_token"]
    eng = await client.post(
        "/api/engagements", headers={"X-CSRF-Token": csrf}, json={"name": "E"}
    )
    return csrf, eng.json()["id"]


async def test_compromised_user_secret_encrypted_and_revealable(client):
    csrf, eid = await _admin_engagement(client)
    r = await client.post(
        f"/api/engagements/{eid}/compromised-users",
        headers={"X-CSRF-Token": csrf},
        json={
            "username": "Administrator",
            "domain": "CORP",
            "privilege": "domain_admin",
            "method_md": "DCSync via compromised svc acct",
            "secret": "Sup3rH4sh!",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["has_secret"] is True
    assert "secret" not in body  # never returned in normal payloads
    cu_id = body["id"]

    # Stored value must be ciphertext, not the plaintext secret.
    async with SessionLocal() as db:
        cu = await db.scalar(
            select(CompromisedUser).where(CompromisedUser.id == uuid.UUID(cu_id))
        )
        assert cu is not None
        assert cu.secret_encrypted is not None
        assert "Sup3rH4sh!" not in cu.secret_encrypted

    reveal = await client.post(
        f"/api/engagements/{eid}/compromised-users/{cu_id}/reveal",
        headers={"X-CSRF-Token": csrf},
    )
    assert reveal.status_code == 200
    assert reveal.json()["secret"] == "Sup3rH4sh!"


async def test_artifact_removed_sets_timestamp(client):
    csrf, eid = await _admin_engagement(client)
    art = (
        await client.post(
            f"/api/engagements/{eid}/artifacts",
            headers={"X-CSRF-Token": csrf},
            json={"type": "webshell", "description": "cmd.aspx on web01"},
        )
    ).json()
    assert art["removed"] is False
    assert art["removed_at"] is None

    upd = await client.patch(
        f"/api/engagements/{eid}/artifacts/{art['id']}",
        headers={"X-CSRF-Token": csrf},
        json={"removed": True},
    )
    assert upd.json()["removed"] is True
    assert upd.json()["removed_at"] is not None


async def test_compromise_requires_membership(client):
    csrf, eid = await _admin_engagement(client)
    # Admin (cap) is still logged in; add a second operator.
    created = await client.post(
        "/api/auth/users",
        headers={"X-CSRF-Token": csrf},
        json={"username": "op2", "password": "supersecret", "display_name": "Op2"},
    )
    assert created.status_code == 201
    # Logging in as op2 rotates the session cookie to the non-member.
    op2 = await client.post(
        "/api/auth/login", json={"username": "op2", "password": "supersecret"}
    )
    assert op2.status_code == 200
    blocked = await client.get(f"/api/engagements/{eid}/compromised-users")
    assert blocked.status_code == 403
