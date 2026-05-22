"""
Build a .docx report from a docxtpl template.

Template variables available:
  {{ client_name }}           full client name
  {{ client_short_name }}     client short name or same as client_name
  {{ engagement_name }}       engagement name
  {{ engagement_type }}       pentest | redteam | ...
  {{ engagement_status }}     planning | active | reporting | closed
  {{ start_date }}            human-formatted start date (e.g. "May 21, 2026")
  {{ end_date }}              human-formatted end date
  {{ report_date }}           today's date in human format
  {{ scope }}                 scope markdown as plain text
  {{ roe }}                   rules of engagement as plain text
  {{ exec_summary }}          executive summary markdown as plain text
  {{ recommendations }}       recommendations markdown as plain text
  {{ team }}                  list of {name, username, role}
  {{ contacts }}              list of {name, role, email, phone}
  {{ findings }}              list of finding dicts (see below)
  {{ appendixes }}            list of {title, content}
  {{ finding_count }}         total number of findings in the report
  {{ severity_counts }}       dict with keys: critical, high, medium, low, informational

Finding dict keys:
  title, severity, status, cvss_score, cvss_vector, cvss_severity,
  cwe, cve, tags_str, description, impact, reproduction, remediation,
  host_detection, network_detection, references,
  affected_assets (list of identifier strings),
  affected_assets_str (comma-joined string)

Appendix types auto-populated from engagement data:
  host_inventory, creds, artifacts, methodology, attack_paths,
  evidence, oplog, custom
"""

import io
from datetime import date
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import uuid
    from app.models.client import Client
    from app.models.engagement import Engagement
    from app.models.finding import FindingDraft
    from app.models.report import EngagementReport
    from app.models.user import User


def _md_to_text(md: str | None) -> str:
    """Return plain text from markdown, escaping Jinja2 delimiters so that
    pentest notes containing {{ }} or {% %} don't corrupt the template render."""
    text = md or ""
    # Replace Jinja2 delimiters with visually identical Unicode lookalikes
    # so they survive template rendering without being interpreted.
    return (
        text
        .replace("{%", "｛%")   # ｛
        .replace("%}", "%｝")   # ｝
        .replace("{{", "｛{")
        .replace("}}", "}｝")
    )


def _format_date(d) -> str:
    """Format a date object or ISO string as 'Month DD, YYYY' (e.g. 'May 21, 2026')."""
    if d is None:
        return ""
    if isinstance(d, date):
        return d.strftime("%B %d, %Y").replace(" 0", " ")  # remove zero-padding on day
    # Try to parse ISO string
    try:
        parsed = date.fromisoformat(str(d))
        return parsed.strftime("%B %d, %Y").replace(" 0", " ")
    except (ValueError, TypeError):
        return str(d)


def _cvss_score_to_severity(score: float | None) -> str:
    """Derive the CVSS v3.x severity label from a numeric base score."""
    if score is None:
        return ""
    if score >= 9.0:
        return "Critical"
    if score >= 7.0:
        return "High"
    if score >= 4.0:
        return "Medium"
    if score > 0.0:
        return "Low"
    return "Informational"


async def build_report(
    engagement: "Engagement",
    report: "EngagementReport",
    findings: "list[FindingDraft]",
    client: "Client | None",
    users: "dict[uuid.UUID, User] | None" = None,
) -> bytes:
    try:
        from docxtpl import DocxTemplate
    except ImportError as e:
        raise RuntimeError("docxtpl is not installed") from e

    tpl = DocxTemplate(report.template_file_path)

    client_name = (client.name if client else engagement.client) or ""
    client_short_name = (client.short_name if client else None) or client_name

    team = []
    for m in (engagement.members or []):
        u = (users or {}).get(m.user_id)
        team.append(
            {
                "name": u.display_name if u else str(m.user_id),
                "username": u.username if u else "",
                "role": m.role,
            }
        )

    contacts = []
    if client:
        contacts = [
            {
                "name": c.name,
                "role": c.role or "",
                "email": c.email or "",
                "phone": c.phone or "",
            }
            for c in (client.contacts or [])
        ]

    finding_list = []
    for f in findings:
        asset_identifiers = [a.identifier for a in (f.assets or [])]
        finding_list.append(
            {
                "title": f.title,
                "severity": f.severity,
                "status": f.status,
                # cvss_score: use None-check, not truthiness — 0.0 is a valid score
                "cvss_score": f"{f.cvss_score:.1f}" if f.cvss_score is not None else "",
                "cvss_vector": f.cvss_vector or "",
                "cvss_severity": _cvss_score_to_severity(f.cvss_score),
                "cwe": f.cwe or "",
                "cve": f.cve or "",
                "tags": list(f.tags or []),
                "tags_str": ", ".join(f.tags or []),
                "description": _md_to_text(f.description_md),
                "impact": _md_to_text(f.impact_md),
                "reproduction": _md_to_text(f.reproduction_md),
                "remediation": _md_to_text(f.remediation_md),
                "host_detection": _md_to_text(f.host_detection_md),
                "network_detection": _md_to_text(f.network_detection_md),
                "references": _md_to_text(f.references_md),
                "affected_assets": asset_identifiers,
                "affected_assets_str": ", ".join(asset_identifiers),
            }
        )

    # Severity distribution counts
    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "informational": 0}
    for f_dict in finding_list:
        sev = (f_dict.get("severity") or "").lower()
        if sev in severity_counts:
            severity_counts[sev] += 1

    appendix_list = []
    for a in (report.appendix_config or []):
        if not a.get("included", True):
            continue
        appendix_list.append(
            {
                "title": a.get("title", "Appendix"),
                "content": _md_to_text(a.get("custom_md")),
            }
        )

    context = {
        "client_name": client_name,
        "client_short_name": client_short_name,
        "engagement_name": engagement.name if engagement else "",
        "engagement_type": engagement.type if engagement else "",
        "engagement_status": engagement.status if engagement else "",
        "start_date": _format_date(engagement.start_date) if engagement else "",
        "end_date": _format_date(engagement.end_date) if engagement else "",
        "report_date": _format_date(date.today()),
        "scope": _md_to_text(engagement.scope_md if engagement else None),
        "roe": _md_to_text(engagement.roe_md if engagement else None),
        "exec_summary": _md_to_text(report.exec_summary_md),
        "recommendations": _md_to_text(report.recommendations_md),
        "team": team,
        "contacts": contacts,
        "findings": finding_list,
        "finding_count": len(finding_list),
        "severity_counts": severity_counts,
        "appendixes": appendix_list,
    }

    try:
        tpl.render(context)
    except Exception as exc:
        raise RuntimeError(
            f"Template rendering failed: {exc}. "
            "Check that all {{ }} placeholders in your template match the available variables."
        ) from exc

    buf = io.BytesIO()
    tpl.save(buf)
    return buf.getvalue()
