"""기관 API (/api/v1/org) — 기관 정보, 공고(activities + activity_details) 등록·수정, 대시보드"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app import models as m
from app import schemas as s
from app.config import settings
from app.db import get_db
from app.deps import OrgContext, activity_out, org_out, own_activity, require_org, require_org_any
from app.domain import REGION_CODE, judge_difficulty

router = APIRouter(prefix="/org")


@router.get("/me", response_model=s.OrganizationOut)
def me(ctx: OrgContext = Depends(require_org_any)):
    return org_out(ctx.org)


@router.post("/demo/approve-review", response_model=s.OrganizationOut)
def demo_approve_review(ctx: OrgContext = Depends(require_org_any), db: Session = Depends(get_db)):
    """데모 전용 — 운영자 심사 화면이 생기기 전까지 심사 승인을 흉내 (DEMO_MODE=false 이면 404)"""
    if not settings.demo_mode:
        raise HTTPException(404, "찾을 수 없습니다.")
    ctx.org.verification_status = "APPROVED"
    db.commit()
    db.refresh(ctx.org)
    return org_out(ctx.org)


# ───────── 공고 ─────────


def _validate(body: s.ActivityIn) -> None:
    if body.region_code not in REGION_CODE.values():
        raise HTTPException(400, "시·도를 선택해 주세요.")
    if not body.region_name.strip():
        raise HTTPException(400, "지역명을 입력해 주세요.")
    if body.recruit_start_date > body.recruit_end_date:
        raise HTTPException(400, "모집 시작일은 모집 마감일 이전이어야 합니다.")
    if body.activity_start_date > body.activity_end_date:
        raise HTTPException(400, "활동 기간을 확인해 주세요.")
    if body.recruit_end_date > body.activity_end_date:
        raise HTTPException(400, "모집 마감일은 활동 종료일 이전이어야 합니다.")


def _apply(a: m.Activity, body: s.ActivityIn) -> None:
    """activities 컬럼 + activity_details 컬럼에 입력값 반영. 가중치는 서버가 판정"""
    a.title = body.title.strip()
    a.description = body.description.strip()
    a.category = body.category
    a.region_code = body.region_code
    a.region_name = body.region_name.strip()
    a.address = body.address.strip()
    a.recruit_start_date = body.recruit_start_date
    a.recruit_end_date = body.recruit_end_date
    a.activity_start_date = body.activity_start_date
    a.activity_end_date = body.activity_end_date
    a.capacity = body.capacity
    a.status = body.status

    d = a.details or m.ActivityDetail()
    a.details = d
    i = body.details
    d.summary = i.summary.strip()
    d.hours_per_session = Decimal(str(i.hours_per_session))
    d.target_group = i.target_group.strip()
    d.tasks = i.tasks.strip()
    d.individual_support = i.individual_support

    r = judge_difficulty(d.target_group, d.tasks, d.individual_support)
    d.difficulty_reason = r.reason
    if d.weight_status == "CONFIRMED" and r.candidate:
        return  # 운영자 확정 유지
    d.weight_status = "CANDIDATE" if r.candidate else "NONE"
    d.weight_difficulty = False
    d.weight = Decimal("1.0")


@router.get("/activities", response_model=list[s.ActivityOut])
def list_activities(ctx: OrgContext = Depends(require_org), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(m.Activity).where(m.Activity.organization_id == ctx.org.organization_id).order_by(m.Activity.updated_at.desc())
    ).unique()
    return [activity_out(a) for a in rows]


@router.get("/activities/{activity_id}", response_model=s.ActivityOut)
def get_activity(activity_id: str, ctx: OrgContext = Depends(require_org), db: Session = Depends(get_db)):
    return activity_out(own_activity(db, ctx, activity_id))


@router.post("/activities", response_model=s.ActivityOut, status_code=201)
def create_activity(body: s.ActivityIn, ctx: OrgContext = Depends(require_org), db: Session = Depends(get_db)):
    _validate(body)
    a = m.Activity(organization_id=ctx.org.organization_id, source_type="GREENSTEP", applicant_count=0)
    _apply(a, body)
    db.add(a)
    db.commit()
    db.refresh(a)
    return activity_out(a)


@router.put("/activities/{activity_id}", response_model=s.ActivityOut)
def update_activity(activity_id: str, body: s.ActivityIn, ctx: OrgContext = Depends(require_org), db: Session = Depends(get_db)):
    a = own_activity(db, ctx, activity_id)
    if a.status in ("CLOSED", "CANCELLED"):
        raise HTTPException(400, "마감·취소된 활동은 수정할 수 없습니다.")
    _validate(body)
    if body.capacity < a.applicant_count:
        raise HTTPException(400, f"이미 {a.applicant_count}명이 신청했습니다. 정원을 그보다 적게 줄일 수 없습니다.")
    if body.status == "DRAFT" and a.status == "RECRUITING" and a.applicant_count > 0:
        raise HTTPException(400, "신청자가 있는 공고는 임시저장으로 내릴 수 없습니다.")
    _apply(a, body)
    db.commit()
    db.refresh(a)
    return activity_out(a)


@router.patch("/activities/{activity_id}/status", response_model=s.ActivityOut)
def set_status(activity_id: str, body: s.ActivityStatusIn, ctx: OrgContext = Depends(require_org), db: Session = Depends(get_db)):
    a = own_activity(db, ctx, activity_id)
    if body.status == "DRAFT" and a.applicant_count > 0:
        raise HTTPException(400, "신청자가 있는 공고는 임시저장으로 내릴 수 없습니다.")
    a.status = body.status
    db.commit()
    db.refresh(a)
    return activity_out(a)


@router.delete("/activities/{activity_id}", status_code=204)
def delete_activity(activity_id: str, ctx: OrgContext = Depends(require_org), db: Session = Depends(get_db)) -> None:
    a = own_activity(db, ctx, activity_id)
    if a.status != "DRAFT":
        raise HTTPException(400, "임시저장 상태의 활동만 삭제할 수 있습니다. 게시된 활동은 마감 처리해 주세요.")
    db.delete(a)
    db.commit()


# ───────── 대시보드 (기관 승인 기록만 집계) ─────────


@router.get("/dashboard", response_model=s.OrgDashboardOut)
def dashboard(ctx: OrgContext = Depends(require_org), db: Session = Depends(get_db)):
    row = db.execute(
        text(
            """
            SELECT
              COALESCE(SUM(v.estimated_value_krw) FILTER (WHERE p.status = 'APPROVED'), 0)      AS total_value,
              COALESCE(SUM(p.approved_minutes)   FILTER (WHERE p.status = 'APPROVED'), 0) / 60.0 AS total_hours,
              COUNT(DISTINCT p.user_id)          FILTER (WHERE p.status = 'APPROVED')             AS youth_count,
              COUNT(*)                           FILTER (WHERE p.status = 'PENDING')              AS pending_count,
              COUNT(*)                           FILTER (WHERE p.status = 'APPROVED')             AS approved,
              COUNT(*)                           FILTER (WHERE p.status = 'REJECTED')             AS rejected
            FROM participations p
            JOIN activities a ON a.activity_id = p.activity_id
            LEFT JOIN LATERAL (
              SELECT estimated_value_krw FROM social_value_calculations c
              WHERE c.participation_id = p.participation_id ORDER BY c.calculated_at DESC LIMIT 1
            ) v ON true
            WHERE a.organization_id = :org
            """
        ),
        {"org": ctx.org.organization_id},
    ).one()
    decided = row.approved + row.rejected
    active = db.scalar(
        select(func.count()).select_from(m.Activity).where(
            m.Activity.organization_id == ctx.org.organization_id, m.Activity.status == "RECRUITING"
        )
    )
    return s.OrgDashboardOut(
        total_value=float(row.total_value), total_hours=float(row.total_hours), youth_count=row.youth_count,
        pending_count=row.pending_count, approval_rate=(row.approved / decided) if decided else 0, active_activities=active or 0,
    )
