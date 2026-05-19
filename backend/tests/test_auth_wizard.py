async def _setup_admin(client):
    r = await client.post(
        "/api/auth/register",
        json={"username": "captain", "password": "supersecret", "display_name": "Jackson"},
    )
    assert r.status_code == 201
    assert r.json()["role"] == "admin"
    login = await client.post(
        "/api/auth/login", json={"username": "captain", "password": "supersecret"}
    )
    assert login.status_code == 200
    return login.json()["csrf_token"]


async def test_bootstrap_then_register_locked(client):
    assert (await client.get("/api/auth/bootstrap-status")).json()["needs_setup"] is True
    await _setup_admin(client)
    assert (await client.get("/api/auth/bootstrap-status")).json()["needs_setup"] is False
    # Second open registration is rejected.
    r = await client.post(
        "/api/auth/register",
        json={"username": "intruder", "password": "supersecret", "display_name": "X"},
    )
    assert r.status_code == 409


async def test_login_required_and_csrf(client):
    csrf = await _setup_admin(client)

    # Missing CSRF header is rejected.
    bad = await client.post("/api/engagements", json={"name": "Engagement A"})
    assert bad.status_code == 403

    ok = await client.post(
        "/api/engagements",
        headers={"X-CSRF-Token": csrf},
        json={
            "name": "USF CCDC Prep",
            "client": "Internal",
            "type": "redteam",
            "workstreams": [
                {"name": "Active Directory", "kind": "active_directory"},
                {"name": "Web", "kind": "web"},
            ],
        },
    )
    assert ok.status_code == 201
    body = ok.json()
    assert body["name"] == "USF CCDC Prep"
    assert {w["kind"] for w in body["workstreams"]} == {"active_directory", "web"}
    assert len(body["members"]) == 1  # creator auto-added

    lst = await client.get("/api/engagements")
    assert lst.status_code == 200
    assert lst.json()[0]["workstream_count"] == 2


async def test_unauthenticated_blocked(client):
    r = await client.get("/api/engagements")
    assert r.status_code == 401
