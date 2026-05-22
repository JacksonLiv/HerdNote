"""
Generate a default .docx pentest report template using python-docx.

The output file uses docxtpl Jinja2-style placeholders ({{ var }}, {% for %}...{% endfor %})
so it can be rendered by report_builder.build_report().
"""

import io


# ── Shared colour palette (hex strings used by python-docx RGBColor) ──────────
_DARK_NAVY   = "0D1B2A"   # cover background, heading accents
_MID_NAVY    = "1B3A5C"   # H1 text
_ACCENT_BLUE = "2E6DA4"   # H2, table header fill
_LIGHT_GREY  = "F2F4F6"   # alternating row fill, infobox background
_WHITE       = "FFFFFF"
_TEXT_DARK   = "1A1A2E"   # body text
_RED_CRIT    = "C0392B"
_ORANGE_HIGH = "E67E22"
_YELLOW_MED  = "F1C40F"
_BLUE_LOW    = "2980B9"
_GREY_INFO   = "7F8C8D"
_GREEN_OK    = "27AE60"


def _hex(h: str):
    """Convert 6-char hex string to docx RGBColor."""
    from docx.shared import RGBColor
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return RGBColor(r, g, b)


def _pt(n: float):
    from docx.shared import Pt
    return Pt(n)


def _inches(n: float):
    from docx.shared import Inches
    return Inches(n)


def _set_cell_bg(cell, hex_color: str):
    """Fill a table cell background with a solid colour."""
    from docx.oxml.ns import qn
    from lxml import etree
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = tcPr.find(qn("w:shd"))
    if shd is None:
        shd = etree.SubElement(tcPr, qn("w:shd"))
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)


def _set_para_spacing(para, before: int = 0, after: int = 0, line: int | None = None):
    """Set paragraph spacing (values in twips: 1pt = 20 twips)."""
    from docx.oxml.ns import qn
    from lxml import etree
    pPr = para._p.get_or_add_pPr()
    spacing = pPr.find(qn("w:spacing"))
    if spacing is None:
        spacing = etree.SubElement(pPr, qn("w:spacing"))
    if before is not None:
        spacing.set(qn("w:before"), str(before * 20))
    if after is not None:
        spacing.set(qn("w:after"), str(after * 20))
    if line is not None:
        spacing.set(qn("w:line"), str(line * 20))
        spacing.set(qn("w:lineRule"), "exact")


def _add_styled_heading(doc, text: str, level: int, color_hex: str = _MID_NAVY,
                         size_pt: float = 14, bold: bool = True, space_before: int = 12,
                         space_after: int = 4):
    from docx.oxml.ns import qn
    p = doc.add_paragraph()
    _set_para_spacing(p, before=space_before, after=space_after)
    # Apply Word built-in heading style so TOC can pick it up.
    style_name = f"Heading {level}"
    try:
        p.style = doc.styles[style_name]
    except KeyError:
        pass
    run = p.add_run(text)
    run.bold = bold
    run.font.size = _pt(size_pt)
    run.font.color.rgb = _hex(color_hex)
    return p


def _add_body(doc, text: str, size_pt: float = 10.5, space_after: int = 6):
    p = doc.add_paragraph()
    _set_para_spacing(p, before=0, after=space_after)
    run = p.add_run(text)
    run.font.size = _pt(size_pt)
    run.font.color.rgb = _hex(_TEXT_DARK)
    return p


def _make_two_col_table(doc, rows_data: list, header_fill: str = _ACCENT_BLUE):
    """Create a compact two-column label/value table with styled header row."""
    from docx.oxml.ns import qn
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    tbl = doc.add_table(rows=0, cols=2)
    tbl.style = "Table Grid"

    # Set column widths: label ~1.6", value fills rest
    tbl.columns[0].width = _inches(1.6)
    tbl.columns[1].width = _inches(4.9)

    for i, (label, value) in enumerate(rows_data):
        row = tbl.add_row().cells
        _set_cell_bg(row[0], _LIGHT_GREY)
        _set_cell_bg(row[1], _WHITE)

        p0 = row[0].paragraphs[0]
        p0.clear()
        r0 = p0.add_run(label)
        r0.bold = True
        r0.font.size = _pt(9.5)
        r0.font.color.rgb = _hex(_MID_NAVY)

        p1 = row[1].paragraphs[0]
        p1.clear()
        r1 = p1.add_run(value)
        r1.font.size = _pt(9.5)
        r1.font.color.rgb = _hex(_TEXT_DARK)

    return tbl


def _add_severity_summary_table(doc):
    """Risk Rating Summary table: Critical / High / Medium / Low / Info columns."""
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    # Header instruction paragraph
    p = doc.add_paragraph()
    _set_para_spacing(p, before=6, after=4)
    run = p.add_run(
        "The following table summarises the number of findings by severity rating identified "
        "during this engagement."
    )
    run.font.size = _pt(10)
    run.font.color.rgb = _hex(_TEXT_DARK)

    cols = ["Critical", "High", "Medium", "Low", "Informational", "Total"]
    fill  = [_RED_CRIT, _ORANGE_HIGH, _YELLOW_MED, _BLUE_LOW, _GREY_INFO, _ACCENT_BLUE]
    vals  = [
        "{{ severity_counts.critical }}",
        "{{ severity_counts.high }}",
        "{{ severity_counts.medium }}",
        "{{ severity_counts.low }}",
        "{{ severity_counts.informational }}",
        "{{ finding_count }}",
    ]

    tbl = doc.add_table(rows=2, cols=len(cols))
    tbl.style = "Table Grid"

    for j, (col_label, col_fill) in enumerate(zip(cols, fill)):
        cell = tbl.rows[0].cells[j]
        _set_cell_bg(cell, col_fill)
        p = cell.paragraphs[0]
        p.clear()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(col_label)
        run.bold = True
        run.font.size = _pt(9)
        run.font.color.rgb = _hex(_WHITE)

    for j, val in enumerate(vals):
        cell = tbl.rows[1].cells[j]
        _set_cell_bg(cell, _WHITE)
        p = cell.paragraphs[0]
        p.clear()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(val)
        run.bold = True
        run.font.size = _pt(14)
        run.font.color.rgb = _hex(fill[j])

    return tbl


def _add_page_break(doc):
    doc.add_page_break()


def _add_horizontal_rule(doc):
    """Add a thin horizontal rule paragraph."""
    from docx.oxml.ns import qn
    from lxml import etree
    p = doc.add_paragraph()
    _set_para_spacing(p, before=4, after=4)
    pPr = p._p.get_or_add_pPr()
    pBdr = etree.SubElement(pPr, qn("w:pBdr"))
    bottom = etree.SubElement(pBdr, qn("w:bottom"))
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), _ACCENT_BLUE)
    return p


def _configure_document_defaults(doc):
    """Set document-wide defaults: margins, default font."""
    from docx.oxml.ns import qn
    from lxml import etree

    # Margins: 1" top/bottom, 1.25" left/right
    for section in doc.sections:
        section.top_margin    = _inches(1.0)
        section.bottom_margin = _inches(1.0)
        section.left_margin   = _inches(1.25)
        section.right_margin  = _inches(1.25)

    # Default body font
    doc.styles["Normal"].font.name = "Calibri"
    doc.styles["Normal"].font.size = _pt(10.5)
    doc.styles["Normal"].font.color.rgb = _hex(_TEXT_DARK)


def _set_heading_style(doc, style_name: str, size_pt: float, color_hex: str,
                        bold: bool = True, space_before: int = 12, space_after: int = 4):
    """Override a built-in heading style with project colours."""
    try:
        style = doc.styles[style_name]
        style.font.name = "Calibri"
        style.font.size = _pt(size_pt)
        style.font.color.rgb = _hex(color_hex)
        style.font.bold = bold
        pf = style.paragraph_format
        pf.space_before = _pt(space_before)
        pf.space_after  = _pt(space_after)
    except KeyError:
        pass


def build_default_template() -> bytes:
    try:
        from docx import Document
        from docx.shared import Pt, Inches, RGBColor
        from docx.oxml.ns import qn
        from docx.enum.text import WD_ALIGN_PARAGRAPH
    except ImportError as e:
        raise RuntimeError("python-docx is not installed (bundled with docxtpl)") from e

    doc = Document()
    _configure_document_defaults(doc)

    # Style overrides for built-in heading levels
    _set_heading_style(doc, "Heading 1", 16, _MID_NAVY,   bold=True,  space_before=16, space_after=6)
    _set_heading_style(doc, "Heading 2", 13, _ACCENT_BLUE, bold=True,  space_before=12, space_after=4)
    _set_heading_style(doc, "Heading 3", 11, _MID_NAVY,   bold=True,  space_before=8,  space_after=3)

    # ── COVER PAGE ────────────────────────────────────────────────────────────
    # Engagement name — large display heading
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    _set_para_spacing(p, before=48, after=6)
    run = p.add_run("{{ engagement_name }}")
    run.bold = True
    run.font.size = _pt(28)
    run.font.color.rgb = _hex(_MID_NAVY)

    p2 = doc.add_paragraph()
    _set_para_spacing(p2, before=0, after=40)
    run2 = p2.add_run("Penetration Test Report")
    run2.font.size = _pt(14)
    run2.font.color.rgb = _hex(_ACCENT_BLUE)
    run2.italic = True

    _add_horizontal_rule(doc)

    _make_two_col_table(doc, [
        ("Client",             "{{ client_name }}"),
        ("Short Name",         "{{ client_short_name }}"),
        ("Engagement Type",    "{{ engagement_type }}"),
        ("Assessment Period",  "{{ start_date }} – {{ end_date }}"),
        ("Engagement Status",  "{{ engagement_status }}"),
        ("Report Date",        "{{ report_date }}"),
        ("Classification",     "CONFIDENTIAL – For Authorised Recipients Only"),
    ])

    _add_page_break(doc)

    # ── TABLE OF CONTENTS PLACEHOLDER ─────────────────────────────────────────
    doc.add_heading("Table of Contents", 1)
    p = doc.add_paragraph()
    _set_para_spacing(p, before=0, after=4)
    run = p.add_run(
        "[Insert Table of Contents here — in Word: References > Table of Contents > Automatic Table 1]"
    )
    run.italic = True
    run.font.size = _pt(9.5)
    run.font.color.rgb = _hex(_GREY_INFO)

    _add_page_break(doc)

    # ── EXECUTIVE SUMMARY ─────────────────────────────────────────────────────
    doc.add_heading("Executive Summary", 1)

    _add_body(doc,
        "This section provides a high-level overview of the engagement findings "
        "written for non-technical stakeholders. Avoid technical jargon. "
        "Summarise the overall risk posture, highlight the most critical issues, "
        "and close with a forward-looking recommendation statement.",
        size_pt=9, space_after=4
    ).runs[0].italic = True

    _add_body(doc, "{{ exec_summary }}")

    # Risk Rating Summary
    doc.add_heading("Risk Rating Summary", 2)
    _add_severity_summary_table(doc)

    _add_page_break(doc)

    # ── ENGAGEMENT OVERVIEW ───────────────────────────────────────────────────
    doc.add_heading("Engagement Overview", 1)

    doc.add_heading("Scope", 2)
    _add_body(doc,
        "The following assets and systems were included in scope for this assessment.",
        size_pt=9
    ).runs[0].italic = True
    _add_body(doc, "{{ scope }}")

    doc.add_heading("Rules of Engagement", 2)
    _add_body(doc, "{{ roe }}")

    doc.add_heading("Assessment Team", 2)
    # docxtpl loop — tester list
    doc.add_paragraph("{% for m in team %}")
    p = doc.add_paragraph(style="List Bullet")
    p.runs[0].text if p.runs else None
    r = p.add_run()
    r.text = "{{ m.name }}"
    r.bold = True
    r2 = p.add_run("  —  {{ m.role }}")
    r2.font.size = _pt(10)
    doc.add_paragraph("{% endfor %}")

    doc.add_heading("Client Contacts", 2)
    doc.add_paragraph("{% for c in contacts %}")
    p = doc.add_paragraph(style="List Bullet")
    r = p.add_run("{{ c.name }}")
    r.bold = True
    r2 = p.add_run("  ({{ c.role }})  |  {{ c.email }}  |  {{ c.phone }}")
    r2.font.size = _pt(10)
    doc.add_paragraph("{% endfor %}")

    _add_page_break(doc)

    # ── HIGH-LEVEL RECOMMENDATIONS ────────────────────────────────────────────
    doc.add_heading("High-Level Recommendations", 1)
    _add_body(doc,
        "This section presents strategic, prioritised recommendations. "
        "Lead with the highest-impact items. Frame recommendations in business terms "
        "where possible (risk reduction, compliance, operational continuity).",
        size_pt=9
    ).runs[0].italic = True
    _add_body(doc, "{{ recommendations }}")

    _add_page_break(doc)

    # ── TECHNICAL FINDINGS ────────────────────────────────────────────────────
    doc.add_heading("Technical Findings", 1)
    _add_body(doc,
        "Each finding below follows a standard structure: metadata, description, "
        "business impact, proof of concept, remediation guidance, and references. "
        "Findings are ordered by severity (Critical first).",
        size_pt=9
    ).runs[0].italic = True

    # Begin Jinja2 loop over findings
    doc.add_paragraph("{% for f in findings %}")

    # Finding title — Heading 2
    doc.add_heading("{{ loop.index }}. {{ f.title }}", 2)

    # Severity / metadata table
    _add_horizontal_rule(doc)

    tbl = doc.add_table(rows=0, cols=4)
    tbl.style = "Table Grid"
    tbl.columns[0].width = _inches(1.2)
    tbl.columns[1].width = _inches(2.3)
    tbl.columns[2].width = _inches(1.2)
    tbl.columns[3].width = _inches(1.8)

    metadata_pairs = [
        ("Severity",     "{{ f.severity | upper }}",    "CVSS Score",    "{{ f.cvss_score }}"),
        ("CVSS Vector",  "{{ f.cvss_vector }}",          "CVSS Severity", "{{ f.cvss_severity }}"),
        ("CWE",          "{{ f.cwe }}",                  "CVE",           "{{ f.cve }}"),
        ("Status",       "{{ f.status }}",               "Tags",          "{{ f.tags_str }}"),
    ]
    for (l1, v1, l2, v2) in metadata_pairs:
        row = tbl.add_row().cells
        _set_cell_bg(row[0], _LIGHT_GREY)
        _set_cell_bg(row[2], _LIGHT_GREY)
        for cell, text, bold, size in [
            (row[0], l1, True,  9.0),
            (row[1], v1, False, 9.5),
            (row[2], l2, True,  9.0),
            (row[3], v2, False, 9.5),
        ]:
            p = cell.paragraphs[0]
            p.clear()
            r = p.add_run(text)
            r.bold = bold
            r.font.size = _pt(size)
            r.font.color.rgb = _hex(_MID_NAVY if bold else _TEXT_DARK)

    # Affected assets row (full width via merged cells)
    row = tbl.add_row().cells
    _set_cell_bg(row[0], _LIGHT_GREY)
    p = row[0].paragraphs[0]
    p.clear()
    r = p.add_run("Affected Assets")
    r.bold = True
    r.font.size = _pt(9.0)
    r.font.color.rgb = _hex(_MID_NAVY)

    # Merge remaining cells for the value
    merged = row[1].merge(row[2]).merge(row[3])
    p2 = merged.paragraphs[0]
    p2.clear()
    r2 = p2.add_run(
        "{% for a in f.affected_assets %}{{ a }}{% if not loop.last %}, {% endif %}{% endfor %}"
    )
    r2.font.size = _pt(9.5)
    r2.font.color.rgb = _hex(_TEXT_DARK)

    doc.add_paragraph()  # spacer

    # Description
    doc.add_heading("Description", 3)
    _add_body(doc,
        "Provide a clear, concise technical description of the vulnerability. "
        "Explain what it is and why it exists. Do not describe impact here.",
        size_pt=9
    ).runs[0].italic = True
    _add_body(doc, "{{ f.description }}")

    # Business Impact
    doc.add_heading("Business Impact", 3)
    _add_body(doc,
        "Describe the real-world consequence of exploitation: data breach, "
        "privilege escalation, compliance violation, operational disruption, etc.",
        size_pt=9
    ).runs[0].italic = True
    _add_body(doc, "{{ f.impact }}")

    # Proof of Concept / Steps to Reproduce
    doc.add_heading("Steps to Reproduce", 3)
    _add_body(doc,
        "Step-by-step instructions to reproduce the finding. "
        "Include tool commands, request/response snippets, and screenshots.",
        size_pt=9
    ).runs[0].italic = True
    _add_body(doc, "{{ f.reproduction }}")

    # Remediation
    doc.add_heading("Remediation", 3)
    _add_body(doc,
        "Provide specific, actionable remediation steps. "
        "Reference patch versions, configuration changes, or architectural improvements where known.",
        size_pt=9
    ).runs[0].italic = True
    _add_body(doc, "{{ f.remediation }}")

    # Detection (host + network collapsed into one section)
    doc.add_heading("Detection Guidance", 3)
    p_hd = doc.add_paragraph()
    _set_para_spacing(p_hd, before=2, after=1)
    r_hd = p_hd.add_run("Host-Based Detection: ")
    r_hd.bold = True
    r_hd.font.size = _pt(10)
    r_hd2 = p_hd.add_run("{{ f.host_detection }}")
    r_hd2.font.size = _pt(10)

    p_nd = doc.add_paragraph()
    _set_para_spacing(p_nd, before=2, after=4)
    r_nd = p_nd.add_run("Network-Based Detection: ")
    r_nd.bold = True
    r_nd.font.size = _pt(10)
    r_nd2 = p_nd.add_run("{{ f.network_detection }}")
    r_nd2.font.size = _pt(10)

    # References
    doc.add_heading("References", 3)
    _add_body(doc, "{{ f.references }}")

    # Separator between findings
    _add_horizontal_rule(doc)
    doc.add_paragraph("{% endfor %}")

    _add_page_break(doc)

    # ── APPENDIXES ────────────────────────────────────────────────────────────
    doc.add_heading("Appendixes", 1)
    doc.add_paragraph("{% for a in appendixes %}")
    doc.add_heading("{{ a.title }}", 2)
    _add_body(doc, "{{ a.content }}")
    doc.add_paragraph("{% endfor %}")

    # ── DOCUMENT FOOTER NOTE ──────────────────────────────────────────────────
    _add_horizontal_rule(doc)
    p_foot = doc.add_paragraph()
    _set_para_spacing(p_foot, before=4, after=0)
    r_foot = p_foot.add_run(
        "This document is CONFIDENTIAL. It contains sensitive security findings "
        "and is intended solely for {{ client_name }} and authorised recipients. "
        "Unauthorised disclosure is prohibited."
    )
    r_foot.italic = True
    r_foot.font.size = _pt(8.5)
    r_foot.font.color.rgb = _hex(_GREY_INFO)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
