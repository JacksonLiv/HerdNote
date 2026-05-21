"""
Build a .docx report from a docxtpl template.

Template variables available:
  {{ client_name }}          full client name
  {{ client_short_name }}    client short name or same as client_name
  {{ engagement_name }}      engagement name
  {{ engagement_type }}      pentest | redteam | ...
  {{ engagement_status }}    planning | active | reporting | closed
  {{ start_date }}           ISO date string or ""
  {{ end_date }}             ISO date string or ""
  {{ scope }}                scope markdown as plain text
  {{ roe }}                  rules of engagement as plain text
  {{ exec_summary }}         executive summary markdown as plain text
  {{ recommendations }}      recommendations markdown as plain text
  {{ team }}                 list of {name, username, role}
  {{ contacts }}             list of {name, role, email, phone}
  {{ findings }}             list of finding dicts (see below)
  {{ appendixes }}           list of {title, content}

Finding dict keys:
  title, severity, status, cvss_score, cvss_vector, cwe, cve,
  description, impact, reproduction, remediation, references,
  affected_assets (list of identifier strings)

Appendix types auto-populated from engagement data:
  host_inventory, creds, artifacts, methodology, attack_paths,
  evidence, oplog, custom
"""

import io
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
        finding_list.append(
            {
                "title": f.title,
                "severity": f.severity,
                # cvss_score: use None-check, not truthiness — 0.0 is a valid score
                "cvss_score": f"{f.cvss_score:.1f}" if f.cvss_score is not None else "",
                "cvss_vector": f.cvss_vector or "",
                "cwe": f.cwe or "",
                "cve": f.cve or "",
                "description": _md_to_text(f.description_md),
                "impact": _md_to_text(f.impact_md),
                "reproduction": _md_to_text(f.reproduction_md),
                "remediation": _md_to_text(f.remediation_md),
                "host_detection": _md_to_text(f.host_detection_md),
                "network_detection": _md_to_text(f.network_detection_md),
                "references": _md_to_text(f.references_md),
                "affected_assets": [a.identifier for a in (f.assets or [])],
            }
        )

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
        "start_date": str(engagement.start_date) if engagement and engagement.start_date else "",
        "end_date": str(engagement.end_date) if engagement and engagement.end_date else "",
        "scope": _md_to_text(engagement.scope_md if engagement else None),
        "roe": _md_to_text(engagement.roe_md if engagement else None),
        "exec_summary": _md_to_text(report.exec_summary_md),
        "recommendations": _md_to_text(report.recommendations_md),
        "team": team,
        "contacts": contacts,
        "findings": finding_list,
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
