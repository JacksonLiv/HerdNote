async def _full_engagement(client):
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
        await client.post(
            "/api/engagements",
            headers=h,
            json={"name": "Export E", "workstreams": [{"name": "AD", "kind": "active_directory"}]},
        )
    ).json()["id"]
    asset = (
        await client.post(
            f"/api/engagements/{eid}/assets", headers=h, json={"identifier": "dc01"}
        )
    ).json()["id"]
    await client.post(
        f"/api/engagements/{eid}/compromised-users",
        headers=h,
        json={"username": "Administrator", "privilege": "domain_admin", "secret": "P@ss"},
    )
    await client.post(
        f"/api/engagements/{eid}/findings",
        headers=h,
        json={"title": "RCE", "severity": "critical", "asset_ids": [asset]},
    )
    await client.post(
        f"/api/engagements/{eid}/artifacts",
        headers=h,
        json={"type": "webshell", "description": "shell.aspx"},
    )
    return h, eid


async def test_export_schema_and_secret_redaction(client):
    _, eid = await _full_engagement(client)

    exp = await client.get(f"/api/engagements/{eid}/export")
    assert exp.status_code == 200
    data = exp.json()
    assert data["schema_version"] == "1.0"
    for section in (
        "engagement",
        "workstreams",
        "members",
        "assets",
        "compromised_users",
        "access_paths",
        "activity_log",
        "findings",
        "artifacts",
        "evidence_manifest",
    ):
        assert section in data

    cu = data["compromised_users"][0]
    assert cu["secret"] is None  # redacted by default
    assert cu["secret_present"] is True
    assert data["findings"][0]["severity"] == "critical"


async def test_export_include_secrets_admin_only(client):
    h, eid = await _full_engagement(client)

    withsecrets = await client.get(
        f"/api/engagements/{eid}/export", params={"include_secrets": "true"}
    )
    assert withsecrets.status_code == 200
    assert withsecrets.json()["compromised_users"][0]["secret"] == "P@ss"

    # A non-admin non-member cannot pull the engagement at all.
    created = await client.post(
        "/api/auth/users",
        headers=h,
        json={"username": "operator2", "password": "supersecret", "display_name": "Op"},
    )
    assert created.status_code == 201
    op = await client.post(
        "/api/auth/login", json={"username": "operator2", "password": "supersecret"}
    )
    assert op.status_code == 200
    blocked = await client.get(
        f"/api/engagements/{eid}/export", params={"include_secrets": "true"}
    )
    assert blocked.status_code == 403
