import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.core.deps import get_current_user, verify_csrf
from app.models.engagement import Engagement
from app.models.finding import FindingDraft
from app.models.report import EngagementReport
from app.schemas.report import ReportOut, ReportUpdate

router = APIRouter(prefix="/engagements/{engagement_id}/report", tags=["report"])

TEMPLATE_DIR = Path("/data/report_templates")


async def _require_engagement(
    engagement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
) -> Engagement:
    eng = await db.get(Engagement, engagement_id)
    if eng is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Engagement not found")
    return eng


async def _get_or_create_report(
    engagement_id: uuid.UUID, db: AsyncSession
) -> EngagementReport:
    report = await db.scalar(
        select(EngagementReport).where(
            EngagementReport.engagement_id == engagement_id
        )
    )
    if report is None:
        report = EngagementReport(
            engagement_id=engagement_id,
            selected_finding_ids=[],
            appendix_config=[],
        )
        db.add(report)
        await db.commit()
        await db.refresh(report)
    return report


@router.get("", response_model=ReportOut)
async def get_report(
    engagement_id: uuid.UUID,
    eng: Engagement = Depends(_require_engagement),
    db: AsyncSession = Depends(get_db),
) -> EngagementReport:
    return await _get_or_create_report(engagement_id, db)


@router.put("", response_model=ReportOut, dependencies=[Depends(verify_csrf)])
async def update_report(
    engagement_id: uuid.UUID,
    payload: ReportUpdate,
    eng: Engagement = Depends(_require_engagement),
    db: AsyncSession = Depends(get_db),
) -> EngagementReport:
    report = await _get_or_create_report(engagement_id, db)
    if payload.exec_summary_md is not None:
        report.exec_summary_md = payload.exec_summary_md
    if payload.recommendations_md is not None:
        report.recommendations_md = payload.recommendations_md
    if payload.selected_finding_ids is not None:
        report.selected_finding_ids = payload.selected_finding_ids
    if payload.appendix_config is not None:
        report.appendix_config = [a.model_dump() for a in payload.appendix_config]
    await db.commit()
    await db.refresh(report)
    return report


@router.post(
    "/template",
    response_model=ReportOut,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_csrf)],
)
async def upload_template(
    engagement_id: uuid.UUID,
    file: UploadFile = File(...),
    eng: Engagement = Depends(_require_engagement),
    db: AsyncSession = Depends(get_db),
) -> EngagementReport:
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only .docx files are accepted")

    TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)
    dest = TEMPLATE_DIR / f"{engagement_id}.docx"
    content = await file.read()
    dest.write_bytes(content)

    report = await _get_or_create_report(engagement_id, db)
    report.template_file_path = str(dest)
    await db.commit()
    await db.refresh(report)
    return report


@router.post(
    "/template/default",
    response_model=ReportOut,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_csrf)],
)
async def use_default_template(
    engagement_id: uuid.UUID,
    eng: Engagement = Depends(_require_engagement),
    db: AsyncSession = Depends(get_db),
) -> EngagementReport:
    from app.services.default_template import build_default_template

    TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)
    dest = TEMPLATE_DIR / f"{engagement_id}.docx"
    dest.write_bytes(build_default_template())

    report = await _get_or_create_report(engagement_id, db)
    report.template_file_path = str(dest)
    await db.commit()
    await db.refresh(report)
    return report


@router.post(
    "/generate",
    dependencies=[Depends(verify_csrf)],
)
async def generate_report(
    engagement_id: uuid.UUID,
    eng: Engagement = Depends(_require_engagement),
    db: AsyncSession = Depends(get_db),
) -> Response:
    from app.services.report_builder import build_report

    report = await _get_or_create_report(engagement_id, db)

    if not report.template_file_path or not Path(report.template_file_path).exists():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "No template uploaded for this engagement. Upload a .docx template first.",
        )

    # Load findings in the selected order.
    findings = []
    if report.selected_finding_ids:
        rows = await db.scalars(
            select(FindingDraft)
            .where(FindingDraft.id.in_([uuid.UUID(f) for f in report.selected_finding_ids]))
            .options(selectinload(FindingDraft.assets))
        )
        by_id = {str(f.id): f for f in rows}
        findings = [by_id[fid] for fid in report.selected_finding_ids if fid in by_id]

    # Load full engagement with members for context fields.
    from app.models.client import Client
    from app.models.user import User

    full_eng = await db.scalar(
        select(Engagement)
        .where(Engagement.id == engagement_id)
        .options(
            selectinload(Engagement.workstreams),
            selectinload(Engagement.members),
        )
    )

    # Build user name map for team section.
    users: dict[uuid.UUID, User] = {}
    if full_eng:
        member_uids = [m.user_id for m in full_eng.members]
        if member_uids:
            user_rows = await db.scalars(
                select(User).where(User.id.in_(member_uids))
            )
            users = {u.id: u for u in user_rows}

    client = None
    if full_eng and full_eng.client_id:
        client = await db.scalar(
            select(Client)
            .where(Client.id == full_eng.client_id)
            .options(selectinload(Client.contacts))
        )

    try:
        docx_bytes = await build_report(
            engagement=full_eng,
            report=report,
            findings=findings,
            client=client,
            users=users,
        )
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    safe_name = (full_eng.name if full_eng else "report").replace(" ", "_")
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}_report.docx"'
        },
    )
