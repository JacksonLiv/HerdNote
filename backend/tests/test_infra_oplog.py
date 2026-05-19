async def _setup(client):
    await client.post(
        "/api/auth/register",
        json={"username": "cap", "password": "supersecret", "display_name": "Cap"},
    )
    csrf = (
        await client.post(
            "/api/auth/login", json={"username": "cap", "password": "supersecret"}
        )
    ).json()["csrf_token"]
    h = {"X-CSRF-Token": csrf}
    eid = (
        await client.post("/api/engagements", headers=h, json={"name": "E"})
    ).json()["id"]
    return h, eid


async def test_infrastructure_crud(client):
    h, eid = await _setup(client)
    r = await client.post(
        f"/api/engagements/{eid}/infrastructure",
        headers=h,
        json={"name": "evil.example", "kind": "domain", "status": "active"},
    )
    assert r.status_code == 201
    iid = r.json()["id"]

    upd = await client.patch(
        f"/api/engagements/{eid}/infrastructure/{iid}",
        headers=h,
        json={"status": "burned"},
    )
    assert upd.json()["status"] == "burned"

    bad = await client.post(
        f"/api/engagements/{eid}/infrastructure",
        headers=h,
        json={"name": "x", "kind": "spaceship"},
    )
    assert bad.status_code == 422

    lst = await client.get(f"/api/engagements/{eid}/infrastructure")
    assert len(lst.json()) == 1


async def test_oplog_autostamps_operator(client):
    h, eid = await _setup(client)
    e = await client.post(
        f"/api/engagements/{eid}/oplog",
        headers=h,
        json={
            "description": "ran secretsdump",
            "source_host": "kali",
            "dest_host": "dc01",
            "tool": "impacket",
            "command": "secretsdump.py ...",
            "mitre_technique": "T1003",
        },
    )
    assert e.status_code == 201
    body = e.json()
    assert body["operator_name"] == "Cap"
    assert body["ts"] is not None
    assert body["mitre_technique"] == "T1003"

    feed = await client.get(f"/api/engagements/{eid}/oplog")
    assert feed.json()[0]["description"] == "ran secretsdump"
