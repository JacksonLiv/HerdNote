"""
Generate a default .docx pentest report template using python-docx.

The output file uses docxtpl Jinja2-style placeholders ({{ var }}, {% for %}...{% endfor %})
so it can be rendered by report_builder.build_report().
"""

import io


def build_default_template() -> bytes:
    try:
        from docx import Document
        from docx.shared import Pt
        from docx.oxml.ns import qn
    except ImportError as e:
        raise RuntimeError("python-docx is not installed (bundled with docxtpl)") from e

    doc = Document()

    # ── Cover Page ──────────────────────────────────────────────────────────────
    doc.add_heading("{{ engagement_name }}", 0)

    p = doc.add_paragraph()
    p.add_run("Client: ").bold = True
    p.add_run("{{ client_name }}")

    p = doc.add_paragraph()
    p.add_run("Engagement Type: ").bold = True
    p.add_run("{{ engagement_type }}")

    p = doc.add_paragraph()
    p.add_run("Assessment Period: ").bold = True
    p.add_run("{{ start_date }} – {{ end_date }}")

    p = doc.add_paragraph()
    p.add_run("Status: ").bold = True
    p.add_run("{{ engagement_status }}")

    doc.add_page_break()

    # ── Executive Summary ────────────────────────────────────────────────────────
    doc.add_heading("Executive Summary", 1)
    doc.add_paragraph("{{ exec_summary }}")

    # ── Scope ────────────────────────────────────────────────────────────────────
    doc.add_heading("Scope", 1)
    doc.add_paragraph("{{ scope }}")

    # ── Rules of Engagement ──────────────────────────────────────────────────────
    doc.add_heading("Rules of Engagement", 1)
    doc.add_paragraph("{{ roe }}")

    # ── Assessment Team ──────────────────────────────────────────────────────────
    doc.add_heading("Assessment Team", 1)
    doc.add_paragraph("{% for m in team %}")
    p = doc.add_paragraph(style="List Bullet")
    p.add_run("{{ m.name }}").bold = True
    p.add_run(" — {{ m.role }}")
    doc.add_paragraph("{% endfor %}")

    # ── Client Contacts ──────────────────────────────────────────────────────────
    doc.add_heading("Client Contacts", 1)
    doc.add_paragraph("{% for c in contacts %}")
    p = doc.add_paragraph(style="List Bullet")
    p.add_run("{{ c.name }}").bold = True
    p.add_run(" ({{ c.role }})  |  {{ c.email }}  |  {{ c.phone }}")
    doc.add_paragraph("{% endfor %}")

    # ── High-Level Recommendations ───────────────────────────────────────────────
    doc.add_heading("High-Level Recommendations", 1)
    doc.add_paragraph("{{ recommendations }}")

    # ── Technical Findings ───────────────────────────────────────────────────────
    doc.add_heading("Technical Findings", 1)
    doc.add_paragraph("{% for f in findings %}")

    doc.add_heading("{{ f.title }}", 2)

    # Finding metadata table
    tbl = doc.add_table(rows=0, cols=2)
    tbl.style = "Table Grid"
    for label, value in [
        ("Severity", "{{ f.severity }}"),
        ("CVSS Score", "{{ f.cvss_score }}"),
        ("CVSS Vector", "{{ f.cvss_vector }}"),
        ("CWE", "{{ f.cwe }}"),
        ("CVE", "{{ f.cve }}"),
    ]:
        row = tbl.add_row().cells
        row[0].paragraphs[0].add_run(label).bold = True
        row[1].text = value

    # Affected assets row
    row = tbl.add_row().cells
    row[0].paragraphs[0].add_run("Affected Assets").bold = True
    row[1].text = "{% for a in f.affected_assets %}{{ a }}{% if not loop.last %}, {% endif %}{% endfor %}"

    doc.add_paragraph()  # spacer after table

    doc.add_heading("Description", 3)
    doc.add_paragraph("{{ f.description }}")

    doc.add_heading("Impact", 3)
    doc.add_paragraph("{{ f.impact }}")

    doc.add_heading("Replication Steps", 3)
    doc.add_paragraph("{{ f.reproduction }}")

    doc.add_heading("Remediation", 3)
    doc.add_paragraph("{{ f.remediation }}")

    doc.add_heading("References", 3)
    doc.add_paragraph("{{ f.references }}")

    doc.add_paragraph("{% endfor %}")

    # ── Appendixes ───────────────────────────────────────────────────────────────
    doc.add_heading("Appendixes", 1)
    doc.add_paragraph("{% for a in appendixes %}")
    doc.add_heading("{{ a.title }}", 2)
    doc.add_paragraph("{{ a.content }}")
    doc.add_paragraph("{% endfor %}")

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
