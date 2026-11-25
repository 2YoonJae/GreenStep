"""권한 검사와 응답 변환. 기관 API 는 토큰의 기관과 대상 데이터의 기관이 같을 때만 허용합니다."""
import uuid
from dataclasses import dataclass

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app import schemas as s
from app.db import get_db
from app.security import Principal, current_principal

# ───────── 응답 변환 (테이블 행 → API JSON) ─────────


def user_out(u: m.User) -> s.UserOut:
    p = u.profile
    return s.UserOut(
        id=str(u.user_id), email=u.email, name=u.name, account_status=u.account_status,
        created_at=u.created_at, updated_at=u.updated_at,
        school=p.school if p else "", target_field=p.target_field if p else "", marketing_consent=p.marketing_consent if p else False,
    )


def org_out(o: m.Organization) -> s.OrganizationOut:
    p = o.profile
    return s.OrganizationOut(
        id=str(o.organization_id), name=o.name, organization_type=o.organization_type, verification_status=o.verification_status,
        address=o.address, contact_email=o.contact_email, created_at=o.created_at, business_no=o.business_no,
        intro=p.intro if p else "",
        shortage=p.weight_shortage if p else False, difficulty=p.weight_difficulty if p else False, vulnerable=p.weight_vulnerable if p else False,
    )


def member_out(mb: m.OrgMember) -> s.OrgMemberOut:
    return s.OrgMemberOut(
        id=str(mb.member_id), user_id=str(mb.user_id), organization_id=str(mb.organization_id), role=mb.role,
        membership_status=mb.membership_status, joined_at=mb.joined_at, email=mb.user.email, name=mb.user.name,
    )


def activity_out(a: m.Activity, cls: type[s.ActivityOut] = s.ActivityOut, **extra) -> s.ActivityOut:
    d = a.details
    return cls(
        id=str(a.activity_id), organization_id=str(a.organization_id) if a.organization_id else None, source_type=a.source_type,
        external_activity_id=a.external_activity_id, external_url=a.external_url, external_org_name=a.external_org_name,
        title=a.title, description=a.description, category=a.category, source_category=a.source_category,
        region_code=a.region_code or "", region_name=a.region_name or "", address=a.address or "",
        recruit_start_date=a.recruit_start_date, recruit_end_date=a.recruit_end_date,
        activity_start_date=a.activity_start_date, activity_end_date=a.activity_end_date,
        capacity=a.capacity or 0, applicant_count=a.applicant_count, status=a.status, created_at=a.created_at, updated_at=a.updated_at,
        org_name=a.organization.name if a.organization else (a.external_org_name or ""),
        summary=d.summary if d else "", hours_per_session=float(d.hours_per_session) if d else 0,
        target_group=d.target_group if d else "", tasks=d.tasks if d else "", individual_support=d.individual_support if d else False,
        difficulty_reason=d.difficulty_reason if d else None,
        weight=float(d.weight) if d else 1.0, weight_status=d.weight_status if d else "NONE",
        weight_flags=s.WeightFlags(
            difficulty=d.weight_difficulty if d else False, shortage=d.weight_shortage if d else False, vulnerable=d.weight_vulnerable if d else False,
        ),
        views=d.view_count if d else 0,
        **extra,
    )


# ───────── 권한 ─────────


def require_youth(p: Principal = Depends(current_principal), db: Session = Depends(get_db)) -> m.User:
    if p.role != "YOUTH":
        raise HTTPException(403, "청년 회원만 이용할 수 있습니다.")
    user = db.get(m.User, p.user_id)
    if not user or user.account_status != "ACTIVE" or user.profile is None:
        raise HTTPException(401, "계정을 찾을 수 없습니다.")
    return user


@dataclass
class OrgContext:
    member: m.OrgMember
    org: m.Organization


def _org_context(p: Principal, db: Session) -> OrgContext:
    if p.role != "ORG" or p.member_id is None:
        raise HTTPException(403, "기관 회원만 이용할 수 있습니다.")
    member = db.get(m.OrgMember, p.member_id)
    if not member or member.membership_status != "ACTIVE" or member.user.account_status != "ACTIVE":
        raise HTTPException(401, "계정을 찾을 수 없습니다.")
    return OrgContext(member, member.organization)


def require_org_any(p: Principal = Depends(current_principal), db: Session = Depends(get_db)) -> OrgContext:
    """심사 중인 기관도 허용 (기관 정보 조회용)"""
    return _org_context(p, db)


def require_org(p: Principal = Depends(current_principal), db: Session = Depends(get_db)) -> OrgContext:
    """운영자 심사 승인(APPROVED)된 기관만"""
    ctx = _org_context(p, db)
    if ctx.org.verification_status != "APPROVED":
        raise HTTPException(403, "운영자 심사가 끝난 뒤 이용할 수 있습니다.")
    return ctx


def own_activity(db: Session, ctx: OrgContext, activity_id: str) -> m.Activity:
    a = db.scalar(select(m.Activity).where(m.Activity.activity_id == parse_uuid(activity_id)))
    if a is None:
        raise HTTPException(404, "활동을 찾을 수 없습니다.")
    if a.organization_id != ctx.org.organization_id:
        raise HTTPException(403, "다른 기관의 활동입니다.")
    return a


def parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(404, "찾을 수 없습니다.") from None
