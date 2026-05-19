async def _admin(client):
    await client.post(
        "/api/auth/register",
        json={"username": "cap", "password": "supersecret", "display_name": "Cap"},
    )
    return (
        await client.post(
            "/api/auth/login", json={"username": "cap", "password": "supersecret"}
        )
    ).json()["csrf_token"]


async def test_client_crud_and_contacts(client):
    csrf = await _admin(client)
    h = {"X-CSRF-Token": csrf}

    c = await client.post(
        "/api/clients", headers=h, json={"name": "Acme Corp", "short_name": "ACME"}
    )
    assert c.status_code == 201
    cid = c.json()["id"]

    dup = await client.post("/api/clients", headers=h, json={"name": "Acme Corp"})
    assert dup.status_code == 409

    ct = await client.post(
        f"/api/clients/{cid}/contacts",
        headers=h,
        json={"name": "Jane Doe", "role": "CISO", "email": "jane@acme.test"},
    )
    assert ct.status_code == 201

    lst = await client.get("/api/clients")
    assert lst.status_code == 200
    body = lst.json()[0]
    assert body["name"] == "Acme Corp"
    assert body["contacts"][0]["name"] == "Jane Doe"

    # Engagement can link to the client.
    eng = await client.post(
        "/api/engagements",
        headers=h,
        json={"name": "Acme Pentest", "client_id": cid},
    )
    assert eng.status_code == 201
    assert eng.json()["client_id"] == cid


async def test_client_mutations_require_admin(client):
    csrf = await _admin(client)
    h = {"X-CSRF-Token": csrf}
    await client.post(
        "/api/auth/users",
        headers=h,
        json={"username": "operator9", "password": "supersecret", "display_name": "Op"},
    )
    await client.post(
        "/api/auth/login", json={"username": "operator9", "password": "supersecret"}
    )
    me = await client.get("/api/auth/me")
    op_csrf = me.json()["csrf_token"]
    blocked = await client.post(
        "/api/clients",
        headers={"X-CSRF-Token": op_csrf},
        json={"name": "Nope"},
    )
    assert blocked.status_code == 403
