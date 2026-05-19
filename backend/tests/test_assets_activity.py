async def _admin_engagement(client):
    await client.post(
        "/api/auth/register",
        json={"username": "captain", "password": "supersecret", "display_name": "Cap"},
    )
    csrf = (
        await client.post(
            "/api/auth/login", json={"username": "captain", "password": "supersecret"}
        )
    ).json()["csrf_token"]
    eng = await client.post(
        "/api/engagements",
        headers={"X-CSRF-Token": csrf},
        json={"name": "Net Test", "workstreams": [{"name": "AD", "kind": "active_directory"}]},
    )
    return csrf, eng.json()["id"]


async def test_bulk_add_dedupes_and_infers_type(client):
    csrf, eid = await _admin_engagement(client)
    r = await client.post(
        f"/api/engagements/{eid}/assets/bulk",
        headers={"X-CSRF-Token": csrf},
        json={"text": "10.0.0.1, 10.0.0.1\n10.0.0.0/24 https://app.local dc01"},
    )
    assert r.status_code == 201
    assets = r.json()
    # 4 unique: dup 10.0.0.1 collapsed.
    by_ident = {a["identifier"]: a["type"] for a in assets}
    assert by_ident == {
        "10.0.0.1": "host",
        "10.0.0.0/24": "network",
        "https://app.local": "url",
        "dc01": "host",
    }

    lst = await client.get(f"/api/engagements/{eid}/assets")
    assert len(lst.json()) == 4

    # Re-posting an existing identifier is skipped.
    again = await client.post(
        f"/api/engagements/{eid}/assets/bulk",
        headers={"X-CSRF-Token": csrf},
        json={"text": "10.0.0.1 newhost"},
    )
    assert {a["identifier"] for a in again.json()} == {"newhost"}


async def test_state_transition_and_activity_autostamp(client):
    csrf, eid = await _admin_engagement(client)
    asset = (
        await client.post(
            f"/api/engagements/{eid}/assets",
            headers={"X-CSRF-Token": csrf},
            json={"identifier": "dc01", "type": "host"},
        )
    ).json()
    assert asset["state"] == "untouched"

    upd = await client.patch(
        f"/api/engagements/{eid}/assets/{asset['id']}",
        headers={"X-CSRF-Token": csrf},
        json={"state": "compromised", "tags": ["dc", "win2019"]},
    )
    assert upd.json()["state"] == "compromised"
    assert upd.json()["tags"] == ["dc", "win2019"]

    act = await client.post(
        f"/api/engagements/{eid}/activity",
        headers={"X-CSRF-Token": csrf},
        json={"description": "Dumped NTDS", "action_type": "exploit",
              "target_asset_id": asset["id"]},
    )
    assert act.status_code == 201
    body = act.json()
    assert body["operator_name"] == "Cap"
    assert body["ts"] is not None

    feed = await client.get(f"/api/engagements/{eid}/activity")
    assert feed.json()[0]["description"] == "Dumped NTDS"


async def test_invalid_state_rejected(client):
    csrf, eid = await _admin_engagement(client)
    asset = (
        await client.post(
            f"/api/engagements/{eid}/assets",
            headers={"X-CSRF-Token": csrf},
            json={"identifier": "h1"},
        )
    ).json()
    bad = await client.patch(
        f"/api/engagements/{eid}/assets/{asset['id']}",
        headers={"X-CSRF-Token": csrf},
        json={"state": "pwned"},
    )
    assert bad.status_code == 422
