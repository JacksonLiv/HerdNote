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
    eid = (
        await client.post(
            "/api/engagements", headers={"X-CSRF-Token": csrf}, json={"name": "E"}
        )
    ).json()["id"]
    h = {"X-CSRF-Token": csrf}
    a1 = (
        await client.post(
            f"/api/engagements/{eid}/assets", headers=h, json={"identifier": "kali"}
        )
    ).json()["id"]
    a2 = (
        await client.post(
            f"/api/engagements/{eid}/assets", headers=h, json={"identifier": "web01"}
        )
    ).json()["id"]
    a3 = (
        await client.post(
            f"/api/engagements/{eid}/assets", headers=h, json={"identifier": "dc01"}
        )
    ).json()["id"]
    return csrf, eid, (a1, a2, a3)


async def test_path_steps_reorder_and_graph(client):
    csrf, eid, (a1, a2, a3) = await _setup(client)
    h = {"X-CSRF-Token": csrf}

    path = (
        await client.post(
            f"/api/engagements/{eid}/paths",
            headers=h,
            json={"name": "Foothold → DA", "target_asset_id": a3},
        )
    ).json()
    pid = path["id"]

    s1 = (
        await client.post(
            f"/api/engagements/{eid}/paths/{pid}/steps",
            headers=h,
            json={"title": "Exploit web01", "from_asset_id": a1, "to_asset_id": a2},
        )
    ).json()
    s2 = (
        await client.post(
            f"/api/engagements/{eid}/paths/{pid}/steps",
            headers=h,
            json={"title": "Pivot to DC", "from_asset_id": a2, "to_asset_id": a3},
        )
    ).json()
    assert s1["order_index"] == 0
    assert s2["order_index"] == 1

    # Reorder: swap.
    re = await client.post(
        f"/api/engagements/{eid}/paths/{pid}/steps/reorder",
        headers=h,
        json={"step_ids": [s2["id"], s1["id"]]},
    )
    assert re.status_code == 200
    order = {s["title"]: s["order_index"] for s in re.json()["steps"]}
    assert order == {"Pivot to DC": 0, "Exploit web01": 1}

    graph = (
        await client.get(f"/api/engagements/{eid}/paths/{pid}/graph")
    ).json()
    nodes = [e for e in graph["elements"] if e["group"] == "nodes"]
    edges = [e for e in graph["elements"] if e["group"] == "edges"]
    assert {n["data"]["label"] for n in nodes} == {"kali", "web01", "dc01"}
    assert len(edges) == 2
    assert any(n["data"]["target"] for n in nodes if n["data"]["label"] == "dc01")


async def test_reorder_rejects_mismatched_ids(client):
    csrf, eid, _ = await _setup(client)
    h = {"X-CSRF-Token": csrf}
    pid = (
        await client.post(
            f"/api/engagements/{eid}/paths", headers=h, json={"name": "P"}
        )
    ).json()["id"]
    bad = await client.post(
        f"/api/engagements/{eid}/paths/{pid}/steps/reorder",
        headers=h,
        json={"step_ids": ["00000000-0000-0000-0000-000000000000"]},
    )
    assert bad.status_code == 400
