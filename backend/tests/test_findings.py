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
    asset = (
        await client.post(
            f"/api/engagements/{eid}/assets", headers=h, json={"identifier": "web01"}
        )
    ).json()["id"]
    return h, eid, asset


async def test_template_then_instantiate_finding(client):
    h, eid, asset = await _setup(client)

    tpl = await client.post(
        "/api/finding-templates",
        headers=h,
        json={
            "name": "SQL Injection",
            "category": "web",
            "severity_default": "high",
            "cwe": "CWE-89",
            "description_md": "User input concatenated into SQL.",
            "remediation_md": "Use parameterized queries.",
        },
    )
    assert tpl.status_code == 201
    tid = tpl.json()["id"]

    # Create a finding from the template, overriding only the title.
    f = await client.post(
        f"/api/engagements/{eid}/findings",
        headers=h,
        json={"title": "SQLi in /login", "template_id": tid, "asset_ids": [asset]},
    )
    assert f.status_code == 201
    body = f.json()
    assert body["severity"] == "high"  # pulled from template default
    assert body["description_md"] == "User input concatenated into SQL."
    assert body["remediation_md"] == "Use parameterized queries."
    assert body["cwe"] == "CWE-89"
    assert body["asset_ids"] == [asset]

    lst = await client.get(f"/api/engagements/{eid}/findings")
    assert len(lst.json()) == 1


async def test_finding_update_status_and_assets(client):
    h, eid, asset = await _setup(client)
    fid = (
        await client.post(
            f"/api/engagements/{eid}/findings",
            headers=h,
            json={"title": "Weak TLS", "severity": "low"},
        )
    ).json()["id"]

    upd = await client.patch(
        f"/api/engagements/{eid}/findings/{fid}",
        headers=h,
        json={"status": "open", "asset_ids": [asset]},
    )
    assert upd.json()["status"] == "open"
    assert upd.json()["asset_ids"] == [asset]

    bad = await client.patch(
        f"/api/engagements/{eid}/findings/{fid}",
        headers=h,
        json={"severity": "ultra"},
    )
    assert bad.status_code == 422


async def test_duplicate_template_rejected(client):
    h, _, _ = await _setup(client)
    await client.post(
        "/api/finding-templates", headers=h, json={"name": "Dup"}
    )
    again = await client.post(
        "/api/finding-templates", headers=h, json={"name": "Dup"}
    )
    assert again.status_code == 409


async def test_ghostwriter_fields_carry_from_template(client):
    h, eid, asset = await _setup(client)
    tpl = await client.post(
        "/api/finding-templates",
        headers=h,
        json={
            "name": "Kerberoasting",
            "finding_type": "Active Directory",
            "severity_default": "high",
            "host_detection_md": "Event 4769 with RC4",
            "network_detection_md": "TGS-REQ spikes",
            "finding_guidance_md": "Use when SPNs found",
            "tags": ["ad", "kerberos"],
            "description_md": "Crackable service tickets.",
        },
    )
    assert tpl.status_code == 201

    f = await client.post(
        f"/api/engagements/{eid}/findings",
        headers=h,
        json={"title": "Kerberoast svc_sql", "template_id": tpl.json()["id"]},
    )
    assert f.status_code == 201
    b = f.json()
    assert b["finding_type"] == "Active Directory"
    assert b["host_detection_md"] == "Event 4769 with RC4"
    assert b["network_detection_md"] == "TGS-REQ spikes"
    assert b["tags"] == ["ad", "kerberos"]
    assert b["severity"] == "high"

    # finding_guidance is template-internal, not copied onto findings.
    assert "finding_guidance_md" not in b


async def test_template_update_and_rename_conflict(client):
    h, _, _ = await _setup(client)
    a = await client.post(
        "/api/finding-templates", headers=h, json={"name": "TplA"}
    )
    b = await client.post(
        "/api/finding-templates", headers=h, json={"name": "TplB"}
    )
    aid = a.json()["id"]

    upd = await client.patch(
        f"/api/finding-templates/{aid}",
        headers=h,
        json={"description_md": "prewritten overview", "severity_default": "high"},
    )
    assert upd.status_code == 200
    assert upd.json()["description_md"] == "prewritten overview"
    assert upd.json()["severity_default"] == "high"

    # Renaming onto an existing name conflicts.
    clash = await client.patch(
        f"/api/finding-templates/{aid}", headers=h, json={"name": "TplB"}
    )
    assert clash.status_code == 409
    assert b.status_code == 201
