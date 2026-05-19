import hashlib


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
    eid = eng.json()["id"]
    asset = await client.post(
        f"/api/engagements/{eid}/assets",
        headers={"X-CSRF-Token": csrf},
        json={"identifier": "dc01"},
    )
    return csrf, eid, asset.json()["id"]


async def test_upload_list_download_roundtrip(client):
    csrf, eid, asset_id = await _admin_engagement(client)
    blob = b"\x89PNG fake screenshot bytes \x00\x01\x02"
    expected = hashlib.sha256(blob).hexdigest()

    up = await client.post(
        f"/api/engagements/{eid}/evidence",
        headers={"X-CSRF-Token": csrf},
        data={"parent_type": "asset", "parent_id": asset_id, "caption": "shell popped"},
        files={"file": ("proof.png", blob, "image/png")},
    )
    assert up.status_code == 201
    ev = up.json()
    assert ev["sha256"] == expected
    assert ev["parent_type"] == "asset"
    assert ev["url"].endswith("/download")

    lst = await client.get(
        f"/api/engagements/{eid}/evidence",
        params={"parent_type": "asset", "parent_id": asset_id},
    )
    assert len(lst.json()) == 1

    dl = await client.get(ev["url"])
    assert dl.status_code == 200
    assert dl.content == blob
    assert hashlib.sha256(dl.content).hexdigest() == expected

    rm = await client.delete(
        f"/api/engagements/{eid}/evidence/{ev['id']}",
        headers={"X-CSRF-Token": csrf},
    )
    assert rm.status_code == 204
    assert (
        await client.get(
            f"/api/engagements/{eid}/evidence",
            params={"parent_type": "asset", "parent_id": asset_id},
        )
    ).json() == []


async def test_bad_parent_type_rejected(client):
    csrf, eid, _ = await _admin_engagement(client)
    r = await client.post(
        f"/api/engagements/{eid}/evidence",
        headers={"X-CSRF-Token": csrf},
        data={"parent_type": "banana", "parent_id": eid},
        files={"file": ("x.txt", b"hi", "text/plain")},
    )
    assert r.status_code == 422
