"""Ghostwriter v3 GraphQL integration service.

Pushes HerdNote findings into a Ghostwriter report. Client/project/report are
created if they don't already exist; findings are matched by title so repeated
exports update rather than duplicate.

Ghostwriter exposes Hasura at {url}/api/graphql with Bearer token auth.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import httpx

from app.schemas.ghostwriter import GhostwriterExportResult

if TYPE_CHECKING:
    from app.models.engagement import Engagement
    from app.models.finding import FindingDraft
    from app.models.ghostwriter import GhostwriterSettings

# ---------------------------------------------------------------------------
# Severity mapping — HerdNote string → Ghostwriter severity display name
# (matched case-insensitively against GW's severity list)
# ---------------------------------------------------------------------------
_SEVERITY_DISPLAY: dict[str, str] = {
    "critical": "Critical",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
    "informational": "Informational",
}


# ---------------------------------------------------------------------------
# Low-level GraphQL helper
# ---------------------------------------------------------------------------

async def _gql(
    client: httpx.AsyncClient,
    query: str,
    variables: dict[str, Any] | None = None,
) -> dict[str, Any]:
    resp = await client.post(
        "/api/graphql",
        json={"query": query, "variables": variables or {}},
    )
    resp.raise_for_status()
    body = resp.json()
    if "errors" in body:
        msgs = "; ".join(e.get("message", str(e)) for e in body["errors"])
        raise RuntimeError(f"Ghostwriter GraphQL error: {msgs}")
    return body.get("data", {})


# ---------------------------------------------------------------------------
# Severity
# ---------------------------------------------------------------------------

async def get_severity_map(client: httpx.AsyncClient) -> dict[str, int]:
    """Return a mapping like {"critical": 4, "high": 3, ...} using GW severity IDs."""
    data = await _gql(
        client,
        """
        query GetSeverities {
          severity(order_by: {weight: asc}) {
            id
            severity
          }
        }
        """,
    )
    mapping: dict[str, int] = {}
    for row in data.get("severity", []):
        label = row["severity"].lower()
        mapping[label] = row["id"]
    return mapping


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

async def find_or_create_client(client: httpx.AsyncClient, name: str) -> int:
    data = await _gql(
        client,
        """
        query FindClient($name: String!) {
          client(where: {name: {_eq: $name}}, limit: 1) { id }
        }
        """,
        {"name": name},
    )
    rows = data.get("client", [])
    if rows:
        return rows[0]["id"]

    data = await _gql(
        client,
        """
        mutation CreateClient($name: String!) {
          insert_client_one(object: {name: $name}) { id }
        }
        """,
        {"name": name},
    )
    return data["insert_client_one"]["id"]


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

async def find_or_create_project(
    client: httpx.AsyncClient,
    gw_client_id: int,
    name: str,
    start_date: str | None,
    end_date: str | None,
) -> int:
    data = await _gql(
        client,
        """
        query FindProject($client_id: bigint!, $name: String!) {
          project(where: {client_id: {_eq: $client_id}, name: {_eq: $name}}, limit: 1) { id }
        }
        """,
        {"client_id": gw_client_id, "name": name},
    )
    rows = data.get("project", [])
    if rows:
        return rows[0]["id"]

    obj: dict[str, Any] = {
        "client_id": gw_client_id,
        "name": name,
    }
    if start_date:
        obj["start_date"] = start_date
    if end_date:
        obj["end_date"] = end_date

    # project_type required — default to "Penetration Testing"
    data2 = await _gql(
        client,
        """
        query GetProjectType($name: String!) {
          projecttype(where: {project_type: {_ilike: $name}}, limit: 1) { id }
        }
        """,
        {"name": "%Penetration%"},
    )
    pt_rows = data2.get("projecttype", [])
    if pt_rows:
        obj["project_type_id"] = pt_rows[0]["id"]

    data = await _gql(
        client,
        """
        mutation CreateProject($obj: project_insert_input!) {
          insert_project_one(object: $obj) { id }
        }
        """,
        {"obj": obj},
    )
    return data["insert_project_one"]["id"]


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

async def find_or_create_report(
    client: httpx.AsyncClient,
    project_id: int,
) -> int:
    data = await _gql(
        client,
        """
        query FindReport($project_id: bigint!) {
          report(where: {project_id: {_eq: $project_id}}, limit: 1, order_by: {id: asc}) { id }
        }
        """,
        {"project_id": project_id},
    )
    rows = data.get("report", [])
    if rows:
        return rows[0]["id"]

    # fetch any report template to satisfy the FK
    tpl = await _gql(
        client,
        """
        query GetReportTemplate {
          reporttemplate(limit: 1, order_by: {id: asc}) { id }
        }
        """,
    )
    tpl_rows = tpl.get("reporttemplate", [])
    obj: dict[str, Any] = {"project_id": project_id, "title": "HerdNote Export"}
    if tpl_rows:
        obj["template_id"] = tpl_rows[0]["id"]

    data = await _gql(
        client,
        """
        mutation CreateReport($obj: report_insert_input!) {
          insert_report_one(object: $obj) { id }
        }
        """,
        {"obj": obj},
    )
    return data["insert_report_one"]["id"]


# ---------------------------------------------------------------------------
# Findings push
# ---------------------------------------------------------------------------

def _format_affected_entities(assets: list) -> str:
    """Build an 'Affected Scope' bullet list from linked Asset objects.

    Produces lines like:
        - 10.0.1.21:445/SMB (Deckhand-02.allports.local)
        - 10.0.1.11:80/HTTP
        - https://portal.allports.tours
    """
    lines: list[str] = []
    for a in assets:
        base = a.identifier or ""
        if a.services:
            for svc in a.services:
                lines.append(f"- {base}:{svc}")
        else:
            lines.append(f"- {base}")
    return "\n".join(lines)


def _build_finding_obj(
    f: "FindingDraft",
    report_id: int,
    severity_map: dict[str, int],
) -> dict[str, Any]:
    obj: dict[str, Any] = {
        "report_id": report_id,
        "title": f.title,
    }
    sev_id = severity_map.get(f.severity or "informational")
    if sev_id is not None:
        obj["severity_id"] = sev_id
    if f.description_md:
        obj["description"] = f.description_md
    if f.impact_md:
        obj["impact"] = f.impact_md
    if f.remediation_md:
        obj["recommendation"] = f.remediation_md
    if f.reproduction_md:
        obj["replication_steps"] = f.reproduction_md
    if f.references_md:
        obj["references"] = f.references_md
    if f.host_detection_md:
        obj["host_detection_techniques"] = f.host_detection_md
    if f.network_detection_md:
        obj["net_detection_techniques"] = f.network_detection_md
    if f.cvss_score is not None:
        obj["cvss_score"] = str(f.cvss_score)
    if f.cvss_vector:
        obj["cvss_vector"] = f.cvss_vector
    if f.cwe:
        obj["cwe"] = f.cwe
    if f.cve:
        obj["cve"] = f.cve
    # Affected Scope — linked assets formatted as "- IP:port/proto" bullets
    if f.assets:
        obj["affected_entities"] = _format_affected_entities(f.assets)
    return obj


async def push_findings(
    client: httpx.AsyncClient,
    report_id: int,
    findings: list["FindingDraft"],
    severity_map: dict[str, int],
) -> GhostwriterExportResult:
    # Fetch titles of existing report findings
    data = await _gql(
        client,
        """
        query ExistingFindings($report_id: bigint!) {
          reportfindinglink(where: {report_id: {_eq: $report_id}}) { id title }
        }
        """,
        {"report_id": report_id},
    )
    existing: dict[str, int] = {
        row["title"]: row["id"]
        for row in data.get("reportfindinglink", [])
    }

    pushed = 0
    updated = 0
    errors: list[str] = []

    for f in findings:
        try:
            obj = _build_finding_obj(f, report_id, severity_map)
            if f.title in existing:
                gw_id = existing[f.title]
                update_obj = {k: v for k, v in obj.items() if k not in ("report_id", "title")}
                await _gql(
                    client,
                    """
                    mutation UpdateFinding($id: bigint!, $set: reportfindinglink_set_input!) {
                      update_reportfindinglink_by_pk(pk_columns: {id: $id}, _set: $set) { id }
                    }
                    """,
                    {"id": gw_id, "set": update_obj},
                )
                updated += 1
            else:
                await _gql(
                    client,
                    """
                    mutation InsertFinding($obj: reportfindinglink_insert_input!) {
                      insert_reportfindinglink_one(object: $obj) { id }
                    }
                    """,
                    {"obj": obj},
                )
                pushed += 1
        except Exception as exc:
            errors.append(f"{f.title}: {exc}")

    return GhostwriterExportResult(pushed=pushed, updated=updated, errors=errors)


# ---------------------------------------------------------------------------
# Top-level orchestrator
# ---------------------------------------------------------------------------

async def export_engagement_to_ghostwriter(
    settings: "GhostwriterSettings",
    engagement: "Engagement",
    findings: list["FindingDraft"],
) -> GhostwriterExportResult:
    async with httpx.AsyncClient(
        base_url=settings.url,
        headers={"Authorization": f"Bearer {settings.api_token}"},
        timeout=30.0,
    ) as gw:
        severity_map = await get_severity_map(gw)

        client_name = engagement.client or engagement.name
        gw_client_id = await find_or_create_client(gw, client_name)

        start = str(engagement.start_date) if engagement.start_date else None
        end = str(engagement.end_date) if engagement.end_date else None
        gw_project_id = await find_or_create_project(
            gw, gw_client_id, engagement.name, start, end
        )

        gw_report_id = await find_or_create_report(gw, gw_project_id)

        return await push_findings(gw, gw_report_id, findings, severity_map)
