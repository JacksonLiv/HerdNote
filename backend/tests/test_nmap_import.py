# DOCTYPE + xml-stylesheet PI are exactly what broke the old stdlib parser
# (and the user's real file). Body is well-formed here so we can assert fields.
NMAP_XML = b"""<?xml version="1.0"?>
<!DOCTYPE nmaprun>
<?xml-stylesheet href="file:///usr/share/nmap/nmap.xsl" type="text/xsl"?>
<nmaprun scanner="nmap" version="7.95">
  <host>
    <status state="up"/>
    <address addr="10.0.0.5" addrtype="ipv4"/>
    <hostnames><hostname name="dc01.corp.local" type="PTR"/></hostnames>
    <ports>
      <port protocol="tcp" portid="445">
        <state state="open"/>
        <service name="microsoft-ds" product="Samba" version="4.1"/>
      </port>
      <port protocol="tcp" portid="389">
        <state state="open"/>
        <service name="ldap"/>
      </port>
      <port protocol="tcp" portid="9999"><state state="closed"/></port>
    </ports>
    <os><osmatch name="Windows Server 2019" accuracy="96"/></os>
  </host>
  <host>
    <status state="down"/>
    <address addr="10.0.0.6" addrtype="ipv4"/>
  </host>
</nmaprun>"""

# Genuinely malformed (unclosed <service>, stray </script>) — like the
# user's corp_ad_scan.xml. Must still parse to a host via recover mode.
MALFORMED_XML = b"""<?xml version="1.0"?><!DOCTYPE nmaprun><nmaprun>
<host><status state="up"/><address addr="10.0.0.9" addrtype="ipv4"/>
<hostnames><hostname name="broken01"/></hostnames>
<ports><port protocol="tcp" portid="445"><state state="open"/>
<service name="microsoft-ds" product="X">
<script id="ssl-cert" output="..."/>
</script>
</port></ports></host></nmaprun>"""

# A real web box (no AD signals).
WEB_XML = b"""<?xml version="1.0"?><nmaprun>
<host><status state="up"/><address addr="10.0.0.30" addrtype="ipv4"/>
<hostnames><hostname name="shop01"/></hostnames>
<ports><port protocol="tcp" portid="443"><state state="open"/>
<service name="http" product="nginx"/></port></ports></host></nmaprun>"""


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


async def test_nmap_tolerant_parse_and_autosplit(client):
    h, eid = await _setup(client)

    # NMAP_XML is deliberately malformed (DOCTYPE + unclosed <service>),
    # exactly like the user's real file — must still parse.
    r = await client.post(
        f"/api/engagements/{eid}/assets/import-nmap",
        headers=h,
        files={"file": ("scan.xml", NMAP_XML, "text/xml")},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["created"] == 1  # down host skipped
    assert body["assigned_ad"] == 1  # 445/ldap → AD workstream auto-created
    assert body["assigned_web"] == 0
    assert body["hosts"][0]["identifier"] == "dc01.corp.local"
    assert body["hosts"][0]["ports"] == 2  # closed 9999 excluded
    assert body["hosts"][0]["ad"] is True

    assets = (await client.get(f"/api/engagements/{eid}/assets")).json()
    dc = next(a for a in assets if a["identifier"] == "dc01.corp.local")
    assert dc["os"] == "Windows Server 2019"
    assert {s["port"] for s in dc["services"]} == {445, 389}
    # Auto-created AD workstream is linked (M2M).
    assert len(dc["workstream_ids"]) == 1

    # Re-import via pasted text updates in place (no dup), AD already set.
    r2 = await client.post(
        f"/api/engagements/{eid}/assets/import-nmap",
        headers=h,
        data={"xml_text": NMAP_XML.decode()},
    )
    assert r2.json()["created"] == 0
    assert r2.json()["updated"] == 1
    assert r2.json()["assigned_ad"] == 0  # already assigned
    assert len((await client.get(f"/api/engagements/{eid}/assets")).json()) == 1


async def test_nmap_web_host_goes_to_web(client):
    h, eid = await _setup(client)
    r = await client.post(
        f"/api/engagements/{eid}/assets/import-nmap",
        headers=h,
        files={"file": ("w.xml", WEB_XML, "text/xml")},
    )
    assert r.status_code == 201
    assert r.json()["assigned_web"] == 1
    assert r.json()["assigned_ad"] == 0
    web_ws = (await client.get(f"/api/engagements/{eid}")).json()["workstreams"]
    assert any(w["kind"] == "web" for w in web_ws)


async def test_nmap_recovers_malformed(client):
    h, eid = await _setup(client)
    r = await client.post(
        f"/api/engagements/{eid}/assets/import-nmap",
        headers=h,
        data={"xml_text": MALFORMED_XML.decode()},
    )
    assert r.status_code == 201
    assert r.json()["created"] == 1
    assets = (await client.get(f"/api/engagements/{eid}/assets")).json()
    assert any(a["identifier"] == "broken01" for a in assets)


async def test_nmap_bad_input_rejected(client):
    h, eid = await _setup(client)
    r = await client.post(
        f"/api/engagements/{eid}/assets/import-nmap",
        headers=h,
        files={"file": ("x.txt", b"definitely not xml or hosts", "text/xml")},
    )
    assert r.status_code in (400, 422)
