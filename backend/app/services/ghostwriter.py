"""Ghostwriter v6 GraphQL integration service.

Pushes HerdNote findings into a Ghostwriter report. Uses the Hasura GraphQL
endpoint exposed by Ghostwriter with either a Bearer JWT (from Profile → API
Tokens) or an x-hasura-admin-secret header.

In Ghostwriter v6, table names have custom aliases:
  reporting_severity       → findingSeverity
  reporting_report         → report
  reporting_reporttemplate → template
  reporting_reportfindinglink → reportedFinding
  rolodex_client           → client
  rolodex_project          → project
  rolodex_projecttype      → projectType

Insert/update field names are camelCase (Hasura column_config renames).
Client and project creation are not available via GraphQL in v6 — users must
select an existing project from the export modal.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import httpx
import markdown as _md

from app.schemas.ghostwriter import GhostwriterExportResult, GhostwriterProject

_MD = _md.Markdown(extensions=["nl2br", "fenced_code", "tables"])


def _md_to_html(text: str | None) -> str | None:
    """Convert Markdown to HTML for Ghostwriter's rich-text fields.

    Ghostwriter's DOCX generator requires content wrapped in block elements
    (<p>, <ul>, etc.). Raw text causes a ReportExportError at generation time.
    """
    if not text:
        return None
    _MD.reset()
    return _MD.convert(text)

if TYPE_CHECKING:
    from app.models.engagement import Engagement
    from app.models.finding import FindingDraft
    from app.models.ghostwriter import GhostwriterSettings

_SEVERITY_DISPLAY: dict[str, str] = {
    "critical": "Critical",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
    "informational": "Informational",
}


# ---------------------------------------------------------------------------
# Auth headers
# ---------------------------------------------------------------------------

def _gw_headers(settings: "GhostwriterSettings") -> dict:
    if settings.hasura_admin_secret:
        return {"x-hasura-admin-secret": settings.hasura_admin_secret}
    return {"Authorization": f"Bearer {settings.api_token}"}


# ---------------------------------------------------------------------------
# Low-level GraphQL helper
# ---------------------------------------------------------------------------

async def _gql(
    client: httpx.AsyncClient,
    query: str,
    variables: dict[str, Any] | None = None,
) -> dict[str, Any]:
    resp = await client.post(
        "/v1/graphql",
        json={"query": query, "variables": variables or {}},
    )
    resp.raise_for_status()
    body = resp.json()
    if "errors" in body:
        msgs = "; ".join(e.get("message", str(e)) for e in body["errors"])
        raise RuntimeError(f"Ghostwriter GraphQL error: {msgs}")
    return body.get("data", {})


# ---------------------------------------------------------------------------
# Project listing (for the "use existing project" modal picker)
# ---------------------------------------------------------------------------

async def list_projects(client: httpx.AsyncClient) -> list[GhostwriterProject]:
    data = await _gql(
        client,
        """
        query ListProjects {
          project(order_by: [{client: {name: asc}}, {startDate: desc}]) {
            id
            codename
            startDate
            endDate
            client { name }
            reports(limit: 1, order_by: {id: asc}) { id title }
          }
        }
        """,
    )
    results: list[GhostwriterProject] = []
    for row in data.get("project", []):
        reports = row.get("reports", [])
        first = reports[0] if reports else None
        start = (row.get("startDate") or "")[:10]
        end = (row.get("endDate") or "")[:10]
        date_range = f"{start} – {end}" if start else ""
        codename = row.get("codename") or f"Project {row['id']}"
        project_name = f"{codename} ({date_range})" if date_range else codename
        results.append(
            GhostwriterProject(
                project_id=row["id"],
                project_name=project_name,
                client_name=row["client"]["name"],
                report_id=first["id"] if first else None,
                report_title=first["title"] if first else None,
            )
        )
    return results


# ---------------------------------------------------------------------------
# Severity map + finding type map
# ---------------------------------------------------------------------------

# Maps HerdNote finding_type values to Ghostwriter finding type labels (case-insensitive prefix match)
_FINDING_TYPE_HINTS: dict[str, list[str]] = {
    "network": ["network"],
    "web": ["web"],
    "webapp": ["web"],
    "web_app": ["web"],
    "mobile": ["mobile"],
    "physical": ["physical"],
    "cloud": ["cloud"],
    "active_directory": ["network"],
    "ad": ["network"],
    "wireless": ["network"],
    "social_engineering": ["physical"],
}


async def get_finding_type_map(client: httpx.AsyncClient) -> dict[str, int]:
    """Returns {label_lower: id} for all Ghostwriter finding types."""
    data = await _gql(
        client,
        """
        query GetFindingTypes {
          findingType(order_by: {id: asc}) {
            id
            findingType
          }
        }
        """,
    )
    mapping: dict[str, int] = {}
    for row in data.get("findingType", []):
        label = (row.get("findingType") or "").lower()
        mapping[label] = row["id"]
    return mapping


def _resolve_finding_type_id(
    herdnote_type: str | None,
    finding_type_map: dict[str, int],
    default_id: int,
) -> int:
    if not herdnote_type or not finding_type_map:
        return default_id
    key = herdnote_type.lower()
    hints = _FINDING_TYPE_HINTS.get(key, [key])
    for hint in hints:
        for label, fid in finding_type_map.items():
            if hint in label:
                return fid
    return default_id


async def get_severity_map(client: httpx.AsyncClient) -> dict[str, int]:
    data = await _gql(
        client,
        """
        query GetSeverities {
          findingSeverity(order_by: {weight: asc}) {
            id
            severity
          }
        }
        """,
    )
    mapping: dict[str, int] = {}
    for row in data.get("findingSeverity", []):
        label = row["severity"].lower()
        mapping[label] = row["id"]
    return mapping


# ---------------------------------------------------------------------------
# Report: find existing or create new
# ---------------------------------------------------------------------------

async def find_or_create_report(client: httpx.AsyncClient, project_id: int) -> int:
    data = await _gql(
        client,
        """
        query FindReport($project_id: bigint!) {
          report(where: {projectId: {_eq: $project_id}}, limit: 1, order_by: {id: asc}) { id }
        }
        """,
        {"project_id": project_id},
    )
    rows = data.get("report", [])
    if rows:
        return rows[0]["id"]

    tpl = await _gql(
        client,
        """
        query GetTemplate {
          template(limit: 1, order_by: {id: asc}) { id }
        }
        """,
    )
    obj: dict[str, Any] = {"projectId": project_id, "title": "HerdNote Export"}
    tpl_rows = tpl.get("template", [])
    if tpl_rows:
        obj["docxTemplateId"] = tpl_rows[0]["id"]

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
    """Return an HTML unordered list of affected assets for Ghostwriter's rich-text field."""
    items: list[str] = []
    for a in assets:
        base = a.identifier or ""
        if a.services:
            for svc in a.services:
                items.append(f"<li>{base}:{svc}</li>")
        else:
            items.append(f"<li>{base}</li>")
    if not items:
        return ""
    return "<ul>" + "".join(items) + "</ul>"


def _build_finding_obj(
    f: "FindingDraft",
    report_id: int,
    severity_map: dict[str, int],
    finding_type_map: dict[str, int],
    default_type_id: int,
) -> dict[str, Any]:
    obj: dict[str, Any] = {
        "reportId": report_id,
        "title": f.title,
        "findingTypeId": _resolve_finding_type_id(f.finding_type, finding_type_map, default_type_id),
    }
    sev_id = severity_map.get(f.severity or "informational")
    if sev_id is not None:
        obj["severityId"] = sev_id
    if desc := _md_to_html(f.description_md):
        obj["description"] = desc
    if impact := _md_to_html(f.impact_md):
        obj["impact"] = impact
    if rem := _md_to_html(f.remediation_md):
        obj["mitigation"] = rem
    if repro := _md_to_html(f.reproduction_md):
        obj["replication_steps"] = repro
    if refs := _md_to_html(f.references_md):
        obj["references"] = refs
    if host := _md_to_html(f.host_detection_md):
        obj["hostDetectionTechniques"] = host
    if net := _md_to_html(f.network_detection_md):
        obj["networkDetectionTechniques"] = net
    if f.cvss_score is not None:
        obj["cvssScore"] = float(f.cvss_score)
    if f.cvss_vector:
        obj["cvssVector"] = f.cvss_vector
    obj["affectedEntities"] = _format_affected_entities(f.assets)
    return obj


async def push_findings(
    client: httpx.AsyncClient,
    report_id: int,
    findings: list["FindingDraft"],
    severity_map: dict[str, int],
) -> GhostwriterExportResult:
    finding_type_map = await get_finding_type_map(client)
    default_type_id = next(iter(finding_type_map.values()), 1)

    data = await _gql(
        client,
        """
        query ExistingFindings($report_id: bigint!) {
          reportedFinding(where: {reportId: {_eq: $report_id}}) { id title }
        }
        """,
        {"report_id": report_id},
    )
    existing: dict[str, int] = {
        row["title"]: row["id"]
        for row in data.get("reportedFinding", [])
    }

    pushed = 0
    updated = 0
    errors: list[str] = []

    for f in findings:
        try:
            obj = _build_finding_obj(f, report_id, severity_map, finding_type_map, default_type_id)
            if f.title in existing:
                gw_id = existing[f.title]
                update_obj = {k: v for k, v in obj.items() if k not in ("reportId", "title")}
                await _gql(
                    client,
                    """
                    mutation UpdateFinding($id: bigint!, $set: reportedFinding_set_input!) {
                      update_reportedFinding_by_pk(pk_columns: {id: $id}, _set: $set) { id }
                    }
                    """,
                    {"id": gw_id, "set": update_obj},
                )
                updated += 1
            else:
                await _gql(
                    client,
                    """
                    mutation InsertFinding($obj: reportedFinding_insert_input!) {
                      insert_reportedFinding_one(object: $obj) { id }
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
    gw_report_id: int | None = None,
) -> GhostwriterExportResult:
    async with httpx.AsyncClient(
        base_url=settings.url,
        headers=_gw_headers(settings),
        timeout=30.0,
        verify=False,
    ) as gw:
        severity_map = await get_severity_map(gw)

        if gw_report_id is None:
            raise RuntimeError(
                "Ghostwriter v6 does not support auto-creating clients and projects via GraphQL. "
                "Please select an existing Ghostwriter project from the export modal."
            )

        return await push_findings(gw, gw_report_id, findings, severity_map)
