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
import re
from datetime import date
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import uuid
    from app.models.client import Client
    from app.models.engagement import Engagement
    from app.models.finding import FindingDraft
    from app.models.report import EngagementReport
    from app.models.user import User


# ── CVSS v3.1 base-score calculator ──────────────────────────────────────────

def _compute_cvss_score(vector: str | None) -> float | None:
    """Parse a CVSS v3.x vector string and return the numeric base score."""
    if not vector:
        return None
    _AV  = {"N": 0.85, "A": 0.62, "L": 0.55, "P": 0.2}
    _AC  = {"L": 0.77, "H": 0.44}
    _PR_U = {"N": 0.85, "L": 0.62, "H": 0.27}
    _PR_C = {"N": 0.85, "L": 0.68, "H": 0.50}
    _UI  = {"N": 0.85, "R": 0.62}
    _CIA = {"H": 0.56, "L": 0.22, "N": 0.0}

    m: dict[str, str] = {}
    for part in vector.split("/"):
        if ":" in part:
            k, v = part.split(":", 1)
            m[k] = v
    try:
        av = _AV[m["AV"]]
        ac = _AC[m["AC"]]
        scope_changed = m.get("S", "U") == "C"
        pr = (_PR_C if scope_changed else _PR_U)[m["PR"]]
        ui = _UI[m["UI"]]
        c  = _CIA[m["C"]]
        i  = _CIA[m["I"]]
        a  = _CIA[m["A"]]
    except KeyError:
        return None

    isc = 1 - (1 - c) * (1 - i) * (1 - a)
    if scope_changed:
        impact = 7.52 * (isc - 0.029) - 3.25 * (isc - 0.02) ** 15
    else:
        impact = 6.42 * isc

    if impact <= 0:
        return 0.0

    exploit = 8.22 * av * ac * pr * ui
    raw = min((1.08 if scope_changed else 1.0) * (impact + exploit), 10)

    # CVSS 3.x "roundup" — smallest 1-decimal value >= input
    i_raw = round(raw * 100000)
    if i_raw % 10000 == 0:
        return i_raw / 100000
    return (i_raw // 10000 + 1) / 10


def _format_date(d) -> str:
    """Format a date object or ISO string as 'Month DD, YYYY' (e.g. 'May 21, 2026')."""
    if d is None:
        return ""
    if isinstance(d, date):
        return d.strftime("%B %d, %Y").replace(" 0", " ")
    try:
        parsed = date.fromisoformat(str(d))
        return parsed.strftime("%B %d, %Y").replace(" 0", " ")
    except (ValueError, TypeError):
        return str(d)


_SEVERITY_DISPLAY = {
    "critical": "Critical",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
    "informational": "Informational",
}


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


# ── Markdown → docxtpl RichText ───────────────────────────────────────────────

# Regex patterns used by _md_to_richtext
_CODE_BLOCK_RE  = re.compile(r"```[^\n]*\n?([\s\S]*?)```", re.DOTALL)
_INLINE_PAT     = re.compile(r"(!\[[^\]]*\]\([^)]+\)|`[^`\n]+`|\*\*[^*\n]+\*\*)")
_IMAGE_RE       = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
_INLINE_CODE_RE = re.compile(r"`([^`\n]+)`")
_BOLD_RE        = re.compile(r"\*\*([^*\n]+)\*\*")
_EV_URL_RE      = re.compile(r"/evidence/([0-9a-f-]{36})/download")
# Jinja2 delimiter lookalikes
_JINJA_ESC = str.maketrans({
    "{%": None, "%}": None, "{{": None, "}}": None,
})


def _escape_jinja(text: str) -> str:
    return (
        text
        .replace("{%", "｛%")
        .replace("%}", "%｝")
        .replace("{{", "｛{")
        .replace("}}", "}｝")
    )


def _md_to_richtext(
    md: str | None,
    tpl=None,
    evidence_map: "dict[str, str] | None" = None,
):
    """Convert markdown to a docxtpl RichText object.

    Handles:
    - Fenced code blocks (``` … ```) → Courier New, dark blue
    - Inline code (`…`) → Courier New
    - Bold (**…**) → bold run
    - Images (![alt](url)) → InlineImage when stored file found, else [Image: alt]
    All other text is added as plain runs. Jinja2 delimiters are escaped so
    user content cannot corrupt template rendering.
    """
    from docxtpl import RichText

    raw = md or ""
    text = _escape_jinja(raw)

    rt = RichText()

    def _add_inline(segment: str) -> None:
        pos = 0
        for m in _INLINE_PAT.finditer(segment):
            if m.start() > pos:
                rt.add(segment[pos:m.start()])
            token = m.group(0)
            if token.startswith("!["):
                img_m = _IMAGE_RE.match(token)
                if img_m:
                    alt = img_m.group(1)
                    url = img_m.group(2)
                    img_path: str | None = None
                    if evidence_map:
                        ev_m = _EV_URL_RE.search(url)
                        if ev_m:
                            img_path = evidence_map.get(ev_m.group(1))
                    if img_path and Path(img_path).exists():
                        from docxtpl import InlineImage
                        from docx.shared import Inches
                        rt.add(InlineImage(tpl, img_path, width=Inches(5.5)))
                    else:
                        rt.add(f"[Image: {alt or 'screenshot'}]", italic=True, color="888888")
            elif token.startswith("`"):
                ic = _INLINE_CODE_RE.match(token)
                if ic:
                    rt.add(ic.group(1), font="Courier New", color="1a3a6b")
            elif token.startswith("**"):
                bd = _BOLD_RE.match(token)
                if bd:
                    rt.add(bd.group(1), bold=True)
            pos = m.end()
        if pos < len(segment):
            rt.add(segment[pos:])

    pos = 0
    for m in _CODE_BLOCK_RE.finditer(text):
        before = text[pos:m.start()]
        if before:
            _add_inline(before)
        code = m.group(1).rstrip("\n")
        if code:
            rt.add("\n" + code + "\n", font="Courier New", color="1a3a6b")
        pos = m.end()

    remaining = text[pos:]
    if remaining:
        _add_inline(remaining)

    return rt


def _md_to_text(md: str | None) -> str:
    """Return plain text from markdown with Jinja2 delimiters escaped.
    Kept for contexts where a RichText is not appropriate (e.g. plain-string fields)."""
    return _escape_jinja(md or "")


# ── Main report builder ───────────────────────────────────────────────────────

async def build_report(
    engagement: "Engagement",
    report: "EngagementReport",
    findings: "list[FindingDraft]",
    client: "Client | None",
    users: "dict[uuid.UUID, User] | None" = None,
    evidence_map: "dict[str, str] | None" = None,
) -> bytes:
    try:
        from docxtpl import DocxTemplate
    except ImportError as e:
        raise RuntimeError("docxtpl is not installed") from e

    tpl = DocxTemplate(report.template_file_path)

    client_name = (client.name if client else engagement.client) or ""
    client_short_name = (client.short_name if client else None) or client_name

    team = []
    for member in (engagement.members or []):
        u = (users or {}).get(member.user_id)
        team.append({
            "name": u.display_name if u else str(member.user_id),
            "username": u.username if u else "",
            "role": member.role,
        })

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

        # Resolve CVSS score: prefer stored → compute from vector → None.
        stored_score = f.cvss_score
        if (stored_score is None or stored_score == 0.0) and f.cvss_vector:
            stored_score = _compute_cvss_score(f.cvss_vector)

        cvss_display = f"{stored_score:.1f}" if stored_score is not None else ""
        # Derive severity label from score when possible, fall back to stored severity field.
        cvss_sev = _cvss_score_to_severity(stored_score)
        if not cvss_sev and f.severity:
            cvss_sev = _SEVERITY_DISPLAY.get(f.severity.lower(), f.severity.title())

        def _rt(field: str | None):
            return _md_to_richtext(field, tpl, evidence_map)

        finding_list.append({
            "title":               f.title,
            "severity":            f.severity,
            "status":              f.status,
            "cvss_score":          cvss_display,
            "cvss_vector":         f.cvss_vector or "",
            "cvss_severity":       cvss_sev,
            "cwe":                 f.cwe or "",
            "cve":                 f.cve or "",
            "tags":                list(f.tags or []),
            "tags_str":            ", ".join(f.tags or []),
            "description":         _rt(f.description_md),
            "impact":              _rt(f.impact_md),
            "reproduction":        _rt(f.reproduction_md),
            "remediation":         _rt(f.remediation_md),
            "host_detection":      _rt(f.host_detection_md),
            "network_detection":   _rt(f.network_detection_md),
            "references":          _rt(f.references_md),
            "affected_assets":     asset_identifiers,
            "affected_assets_str": ", ".join(asset_identifiers),
        })

    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "informational": 0}
    for f_dict in finding_list:
        sev = (f_dict.get("severity") or "").lower()
        if sev in severity_counts:
            severity_counts[sev] += 1

    appendix_list = []
    for a in (report.appendix_config or []):
        if not a.get("included", True):
            continue
        appendix_list.append({
            "title":   a.get("title", "Appendix"),
            "content": _md_to_richtext(a.get("custom_md"), tpl, evidence_map),
        })

    def _rt_plain(field: str | None):
        return _md_to_richtext(field, tpl, evidence_map)

    context = {
        "client_name":        client_name,
        "client_short_name":  client_short_name,
        "engagement_name":    engagement.name if engagement else "",
        "engagement_type":    engagement.type if engagement else "",
        "engagement_status":  engagement.status if engagement else "",
        "start_date":         _format_date(engagement.start_date) if engagement else "",
        "end_date":           _format_date(engagement.end_date) if engagement else "",
        "report_date":        _format_date(date.today()),
        "scope":              _rt_plain(engagement.scope_md if engagement else None),
        "roe":                _rt_plain(engagement.roe_md if engagement else None),
        "exec_summary":       _rt_plain(report.exec_summary_md),
        "recommendations":    _rt_plain(report.recommendations_md),
        "team":               team,
        "contacts":           contacts,
        "findings":           finding_list,
        "finding_count":      len(finding_list),
        "severity_counts":    severity_counts,
        "appendixes":         appendix_list,
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
