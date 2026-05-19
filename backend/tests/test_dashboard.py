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
                    {"name": "Web", "kind": "web"},
                ],
            },
        )
    ).json()
    eid = eng["id"]
    ws = {w["kind"]: w["id"] for w in eng["workstreams"]}
    return h, eid, ws


async def test_dashboard_summary_and_workstream_scope(client):
    h, eid, ws = await _setup(client)

    dc = (
        await client.post(
            f"/api/engagements/{eid}/assets",
            headers=h,
            json={
                "identifier": "dc01",
                "workstream_ids": [ws["active_directory"]],
            },
        )
    ).json()
    assert dc["workstream_ids"] == [ws["active_directory"]]
    await client.patch(
        f"/api/engagements/{eid}/assets/{dc['id']}",
        headers=h,
        json={"state": "compromised"},
    )
    # A host can be in multiple workstreams (AD + Web).
    multi = (
        await client.post(
            f"/api/engagements/{eid}/assets",
            headers=h,
            json={
                "identifier": "web01",
                "workstream_ids": [ws["web"], ws["active_directory"]],
            },
        )
    ).json()
    assert set(multi["workstream_ids"]) == {ws["web"], ws["active_directory"]}
    await client.post(
        f"/api/engagements/{eid}/compromised-users",
        headers=h,
        json={"username": "svc", "privilege": "service", "secret": "x"},
    )

    # Dashboard is ALWAYS global (ignores workstream).
    full = (await client.get(f"/api/engagements/{eid}/dashboard")).json()
    assert full["asset_total"] == 2
    assert len(full["compromised_hosts"]) == 1
    assert full["compromised_hosts"][0]["identifier"] == "dc01"
    assert len(full["compromised_users"]) == 1
    wsmap = {w["name"]: w for w in full["workstreams"]}
    assert wsmap["AD"]["asset_count"] == 2  # dc01 + web01 both in AD
    assert wsmap["Web"]["asset_count"] == 1

    # Scoped Hosts list: only hosts assigned to that workstream.
    web_hosts = (
        await client.get(
            f"/api/engagements/{eid}/assets",
            params={"workstream_id": ws["web"]},
        )
    ).json()
    assert {x["identifier"] for x in web_hosts} == {"web01"}
    ad_hosts = (
        await client.get(
            f"/api/engagements/{eid}/assets",
            params={"workstream_id": ws["active_directory"]},
        )
    ).json()
    assert {x["identifier"] for x in ad_hosts} == {"dc01", "web01"}


async def test_path_can_be_scoped_to_workstream(client):
    h, eid, ws = await _setup(client)
    p = await client.post(
        f"/api/engagements/{eid}/paths",
        headers=h,
        json={"name": "DA path", "workstream_id": ws["active_directory"]},
    )
    assert p.status_code == 201
    assert p.json()["workstream_id"] == ws["active_directory"]

    only_ad = await client.get(
        f"/api/engagements/{eid}/paths",
        params={"workstream_id": ws["active_directory"]},
    )
    assert len(only_ad.json()) == 1
    only_web = await client.get(
        f"/api/engagements/{eid}/paths", params={"workstream_id": ws["web"]}
    )
    assert only_web.json() == []


async def test_web_workstream_domains_and_webapps(client):
    h, eid, ws = await _setup(client)
    web = ws["web"]
    host = (
        await client.post(
            f"/api/engagements/{eid}/assets",
            headers=h,
            json={"identifier": "web01", "workstream_ids": [web]},
        )
    ).json()["id"]

    d = await client.post(
        f"/api/engagements/{eid}/domains",
        headers=h,
        json={"name": "shop.corp.com", "is_subdomain": True, "workstream_id": web},
    )
    assert d.status_code == 201
    w = await client.post(
        f"/api/engagements/{eid}/webapps",
        headers=h,
        json={
            "url": "https://shop.corp.com",
            "name": "Shop",
            "host_asset_id": host,
            "domain_id": d.json()["id"],
            "workstream_id": web,
        },
    )
    assert w.status_code == 201
    assert w.json()["host_asset_id"] == host

    only_web = await client.get(
        f"/api/engagements/{eid}/webapps", params={"workstream_id": web}
    )
    assert len(only_web.json()) == 1
    only_ad = await client.get(
        f"/api/engagements/{eid}/webapps",
        params={"workstream_id": ws["active_directory"]},
    )
    assert only_ad.json() == []
