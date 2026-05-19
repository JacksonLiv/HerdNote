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
    eng = (
        await client.post(
            "/api/engagements",
            headers=h,
            json={
                "name": "E",
                "workstreams": [
                    {"name": "AD", "kind": "active_directory"},
                ],
            },
        )
    ).json()
    return h, eng["id"], eng["workstreams"][0]["id"]


async def test_playbook_state_upsert_and_notes_round_trip(client):
    h, eid, wsid = await _setup(client)

    # Fresh playbook is empty.
    empty = await client.get(f"/api/engagements/{eid}/workstreams/{wsid}/playbook")
    assert empty.status_code == 200
    assert empty.json()["state"] == []
    assert empty.json()["notes"] == []

    # Upsert a task to in_progress + notes.
    r1 = await client.patch(
        f"/api/engagements/{eid}/workstreams/{wsid}/playbook/state/ad.foothold.kerberoast",
        headers=h,
        json={"status": "in_progress", "notes_md": "running rubeus"},
    )
    assert r1.status_code == 200
    assert r1.json()["status"] == "in_progress"
    assert r1.json()["notes_md"] == "running rubeus"

    # Flip to done — second PATCH must update in place (unique constraint).
    r2 = await client.patch(
        f"/api/engagements/{eid}/workstreams/{wsid}/playbook/state/ad.foothold.kerberoast",
        headers=h,
        json={"status": "done"},
    )
    assert r2.json()["status"] == "done"

    # Add a structured capture.
    note = await client.post(
        f"/api/engagements/{eid}/workstreams/{wsid}/playbook/notes",
        headers=h,
        json={
            "category": "ad.foothold",
            "task_key": "ad.foothold.kerberoast",
            "title": "MSSQLSvc/sqlsrv hash",
            "data": {"spn": "MSSQLSvc/sqlsrv", "hash": "$krb5tgs$23$..."},
        },
    )
    assert note.status_code == 201

    # Get back state + notes.
    full = (
        await client.get(f"/api/engagements/{eid}/workstreams/{wsid}/playbook")
    ).json()
    assert len(full["state"]) == 1
    assert full["state"][0]["task_key"] == "ad.foothold.kerberoast"
    assert len(full["notes"]) == 1
    assert full["notes"][0]["data"]["spn"] == "MSSQLSvc/sqlsrv"

    # Delete the note.
    nid = full["notes"][0]["id"]
    d = await client.delete(
        f"/api/engagements/{eid}/workstreams/{wsid}/playbook/notes/{nid}",
        headers=h,
    )
    assert d.status_code == 204


async def test_playbook_wrong_engagement_404(client):
    h, eid, _ = await _setup(client)
    eng2 = (
        await client.post(
            "/api/engagements",
            headers=h,
            json={
                "name": "E2",
                "workstreams": [{"name": "AD", "kind": "active_directory"}],
            },
        )
    ).json()
    foreign_ws = eng2["workstreams"][0]["id"]
    bad = await client.get(
        f"/api/engagements/{eid}/workstreams/{foreign_ws}/playbook"
    )
    assert bad.status_code == 404


async def test_inject_workstream_kind_accepted(client):
    h, eid, _ = await _setup(client)
    # Add an inject workstream via the engagements endpoint.
    r = await client.post(
        f"/api/engagements/{eid}/workstreams",
        headers=h,
        json={"name": "Injects", "kind": "inject"},
    )
    assert r.status_code in (200, 201)
    kinds = {w["kind"] for w in r.json()["workstreams"]}
    assert "inject" in kinds
