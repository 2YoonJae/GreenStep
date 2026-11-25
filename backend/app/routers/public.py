"""누구나 보는 API — 공고 목록·상세, 플랫폼 통계 (+ 아직 DB 테이블이 없는 공지·FAQ 는 빈 목록)"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app import models as m
from app import schemas as s
from app.db import get_db
from app.deps import activity_out, parse_uuid
from app.domain import CATEGORY_RATE, REGION_CODE
from app.security import Principal, optional_principal

router = APIRouter()


def _days_left(d: date | None) -> int:
    return (d - date.today()).days if d else -1


def _is_open(a: m.Activity) -> bool:
    return a.status == "RECRUITING" and _days_left(a.recruit_end_date) >= 0


def _expected_value(a: m.Activity) -> float:
    d = a.details
    return float(d.hours_per_session) * CATEGORY_RATE.get(a.category, 0) * float(d.weight) if d else 0


@router.get("/activities", response_model=s.PageOut[s.ActivityOut])
def list_activities(
    q: str = "",
    region: str = "",
    category: str = "",
    source: str = "",  # GREENSTEP | 1365 (빈 값 = 전체)
    sort: str = "recommended",
    bonus: bool = False,
    closing: int | None = None,
    page: int = 1,
    pageSize: int = 12,  # noqa: N803 — 프론트 쿼리 이름 그대로
    db: Session = Depends(get_db),
):
    rows = list(db.scalars(select(m.Activity).where(m.Activity.status == "RECRUITING")).unique())
    code = REGION_CODE.get(region)
    kw = " ".join(q.split()).lower()

    def keep(a: m.Activity) -> bool:
        d = a.details
        if region and a.region_code != code:
            return False
        if category and a.category != category:
            return False
        if source and a.source_type != source:
            return False
        if bonus and (not d or d.weight_status == "NONE"):
            return False
        if closing is not None and not (0 <= _days_left(a.recruit_end_date) <= closing):
            return False
        if kw:
            org = a.organization.name if a.organization else (a.external_org_name or "")
            hay = " ".join(f"{a.title} {org} {d.summary if d else ''} {a.region_name or ''} {d.tasks if d else ''}".split()).lower()
            if kw not in hay:
                return False
        return True

    rows = [a for a in rows if keep(a)]
    views = lambda a: a.details.view_count if a.details else 0  # noqa: E731
    open_first = lambda a: 0 if _is_open(a) else 1  # noqa: E731
    if sort == "popular":
        rows.sort(key=lambda a: (open_first(a), -views(a)))
    elif sort == "deadline":
        rows = sorted((a for a in rows if _is_open(a)), key=lambda a: a.recruit_end_date)
    elif sort == "value":
        rows.sort(key=lambda a: (open_first(a), -_expected_value(a)))
    elif sort == "latest":
        rows.sort(key=lambda a: a.created_at, reverse=True)
    else:  # 추천: 모집 중 우선 → 조회수 + 가산 조건 보너스
        rows.sort(key=lambda a: (open_first(a), -(views(a) + (30 if a.details and a.details.weight_status != "NONE" else 0))))

    page = max(page, 1)
    start = (page - 1) * pageSize
    return s.PageOut[s.ActivityOut](
        items=[activity_out(a) for a in rows[start : start + pageSize]], total=len(rows), page=page, page_size=pageSize,
    )


@router.get("/activities/{activity_id}", response_model=s.ActivityDetailOut)
def get_activity(activity_id: str, p: Principal | None = Depends(optional_principal), db: Session = Depends(get_db)):
    a = db.get(m.Activity, parse_uuid(activity_id))
    if a is None:
        raise HTTPException(404, "활동을 찾을 수 없습니다.")
    if a.status == "DRAFT":
        # 임시저장 공고는 작성 기관에게만
        member = db.get(m.OrgMember, p.member_id) if p and p.role == "ORG" and p.member_id else None
        if not member or member.organization_id != a.organization_id:
            raise HTTPException(404, "활동을 찾을 수 없습니다.")
    if a.details:
        a.details.view_count += 1
        db.commit()
        db.refresh(a)
    applied = False
    if p and p.role == "YOUTH":
        applied = bool(
            db.scalar(
                select(func.count()).select_from(m.Application).where(
                    m.Application.activity_id == a.activity_id, m.Application.user_id == p.user_id, m.Application.status == "APPLIED"
                )
            )
        )
    return activity_out(a, s.ActivityDetailOut, applied=applied)


@router.get("/stats", response_model=s.PlatformStatsOut)
def stats(db: Session = Depends(get_db)):
    row = db.execute(
        text(
            """
            SELECT
              COUNT(DISTINCT p.user_id)                AS youth_count,
              COALESCE(SUM(p.approved_minutes), 0) / 60.0 AS total_hours,
              COALESCE(SUM(v.estimated_value_krw), 0)  AS total_value
            FROM participations p
            LEFT JOIN LATERAL (
              SELECT estimated_value_krw FROM social_value_calculations c
              WHERE c.participation_id = p.participation_id ORDER BY c.calculated_at DESC LIMIT 1
            ) v ON true
            WHERE p.status = 'APPROVED'
            """
        )
    ).one()
    orgs = db.scalar(select(func.count()).select_from(m.Organization).where(m.Organization.verification_status == "APPROVED"))
    return s.PlatformStatsOut(youth_count=row.youth_count, org_count=orgs or 0, total_hours=float(row.total_hours), total_value=float(row.total_value))


# 공지·FAQ 는 아직 DB 테이블이 없음 → 빈 목록
@router.get("/notices")
def notices() -> list:
    return []


@router.get("/faqs")
def faqs() -> list:
    return []

