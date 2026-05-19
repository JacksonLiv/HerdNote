from datetime import UTC, datetime, timedelta


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
                    {"name": "Injects", "kind": "inject"},
                    {"name": "AD", "kind": "active_directory"},
                ],
            },
        )
    ).json()
    ws = {w["kind"]: w["id"] for w in eng["workstreams"]}
    return h, eng["id"], ws


async def test_inject_crud_and_responded_stamp(client):
    h, eid, ws = await _setup(client)
    body = {
        "workstream_id": ws["inject"],
        "source": "remote_email",
        "subject": "Craft phishing email",
        "category": "phishing_create",
        "body_md": "Please craft a phishing email targeting finance.",
        "priority": "high",
    }
    r = await client.post(f"/api/engagements/{eid}/injects", headers=h, json=body)
    assert r.status_code == 201, r.text
    inj = r.json()
    assert inj["status"] == "open"
    assert inj["responded_at"] is None

    # Patch — flip status to responded should stamp responded_at + by.
    upd = await client.patch(
        f"/api/engagements/{eid}/injects/{inj['id']}",
        headers=h,
        json={"status": "responded", "response_md": "Draft attached."},
    )
    assert upd.status_code == 200
    out = upd.json()
    assert out["status"] == "responded"
    assert out["responded_at"] is not None
    assert out["responded_by"] is not None


async def test_inject_must_belong_to_inject_workstream(client):
    h, eid, ws = await _setup(client)
    bad = await client.post(
        f"/api/engagements/{eid}/injects",
        headers=h,
        json={
            "workstream_id": ws["active_directory"],
            "subject": "x",
        },
    )
    assert bad.status_code == 422


async def test_inject_filters(client):
    h, eid, ws = await _setup(client)
    for i in range(3):
        await client.post(
            f"/api/engagements/{eid}/injects",
            headers=h,
            json={
                "workstream_id": ws["inject"],
                "subject": f"q{i}",
                "category": "network_question" if i % 2 == 0 else "phishing_classify",
            },
        )
    by_cat = (
        await client.get(
            f"/api/engagements/{eid}/injects",
            params={"category": "phishing_classify"},
        )
    ).json()
    assert all(x["category"] == "phishing_classify" for x in by_cat)
    assert len(by_cat) == 1


async def test_inject_template_crud_global_and_scoped(client):
    h, eid, _ws = await _setup(client)
    # engagement-scoped
    a = await client.post(
        f"/api/engagements/{eid}/inject-templates",
        headers=h,
        json={
            "category": "phishing_classify",
            "title": "Stock reply",
            "body_md": "Header analysis says...",
            "tags": ["stock"],
            "is_global": False,
        },
    )
    assert a.status_code == 201
    assert a.json()["engagement_id"] is not None

    # global
    b = await client.post(
        f"/api/engagements/{eid}/inject-templates",
        headers=h,
        json={
            "category": "phishing_classify",
            "title": "Global ref",
            "body_md": "Generic guidance.",
            "is_global": True,
        },
    )
    assert b.json()["engagement_id"] is None

    listing = (
        await client.get(
            f"/api/engagements/{eid}/inject-templates",
            params={"include_global": "true"},
        )
    ).json()
    titles = {t["title"] for t in listing}
    assert {"Stock reply", "Global ref"}.issubset(titles)

    only_eng = (
        await client.get(
            f"/api/engagements/{eid}/inject-templates",
            params={"include_global": "false"},
        )
    ).json()
    assert {t["title"] for t in only_eng} == {"Stock reply"}


async def test_dashboard_surfaces_open_and_overdue_inject_counts(client):
    h, eid, ws = await _setup(client)
    # one open, one overdue.
    await client.post(
        f"/api/engagements/{eid}/injects",
        headers=h,
        json={"workstream_id": ws["inject"], "subject": "still open"},
    )
    past = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    await client.post(
        f"/api/engagements/{eid}/injects",
        headers=h,
        json={
            "workstream_id": ws["inject"],
            "subject": "overdue",
            "deadline": past,
        },
    )
    d = (await client.get(f"/api/engagements/{eid}/dashboard")).json()
    assert d["open_injects"] == 2
    assert d["overdue_injects"] == 1
    assert d["first_inject_workstream_id"] == ws["inject"]
