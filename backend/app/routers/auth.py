"""회원가입 · 로그인 · 토큰 갱신 · 로그아웃 + 내 정보 수정 (/api/v1/auth, /api/v1/me)"""
import re

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models as m
from app import schemas as s
from app.db import get_db
from app.deps import member_out, org_out, require_youth, user_out
from app.security import (
    Principal,
    access_token,
    clear_refresh_cookie,
    hash_password,
    principal_from_refresh,
    set_refresh_cookie,
    verify_password,
)

router = APIRouter()

PW_RULE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,}$")
BAD_LOGIN = "이메일 또는 비밀번호가 올바르지 않습니다."


def _check_password(pw: str) -> None:
    if not PW_RULE.match(pw):
        raise HTTPException(400, "비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다.")


def _session(db: Session, p: Principal, response: Response) -> s.SessionOut:
    """로그인 결과. access 는 본문으로, refresh 는 httpOnly 쿠키로"""
    set_refresh_cookie(response, p)
    token = access_token(p)
    if p.role == "YOUTH":
        user = db.get(m.User, p.user_id)
        if not user or user.profile is None or user.account_status != "ACTIVE":
            raise HTTPException(401, "계정을 찾을 수 없습니다.")
        return s.SessionOut(role="YOUTH", access_token=token, user=user_out(user))
    member = db.get(m.OrgMember, p.member_id) if p.member_id else None
    if not member or member.membership_status != "ACTIVE" or member.user.account_status != "ACTIVE":
        raise HTTPException(401, "계정을 찾을 수 없습니다.")
    return s.SessionOut(role="ORG", access_token=token, member=member_out(member), org=org_out(member.organization))


def _find_user(db: Session, email: str) -> m.User | None:
    return db.scalar(select(m.User).where(m.User.email == email.strip().lower()))


# ───────── 가입 ─────────


@router.post("/auth/youth/signup", response_model=s.SessionOut)
def signup_youth(body: s.YouthSignupIn, response: Response, db: Session = Depends(get_db)):
    """users + user_profiles 한 트랜잭션으로 생성"""
    _check_password(body.password)
    email = body.email.strip().lower()
    if _find_user(db, email):
        raise HTTPException(409, "이미 가입된 이메일입니다.")
    user = m.User(email=email, password_hash=hash_password(body.password), name=body.name.strip())
    user.profile = m.UserProfile(
        school=body.profile.school.strip(), target_field=body.profile.target_field, marketing_consent=body.profile.marketing_consent,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "이미 가입된 이메일입니다.") from None
    db.refresh(user)
    return _session(db, Principal("YOUTH", user.user_id, None), response)


@router.post("/auth/org/signup", response_model=s.SessionOut)
def signup_org(body: s.OrgSignupIn, response: Response, db: Session = Depends(get_db)):
    """organizations(심사 대기) + organization_profiles + 담당자 users + org_members(OWNER) 한 트랜잭션으로 생성"""
    _check_password(body.manager.password)
    biz = re.sub(r"\D", "", body.organization.business_no)
    if len(biz) != 10:
        raise HTTPException(400, "사업자등록번호 10자리를 입력해 주세요.")
    if db.scalar(select(m.Organization).where(m.Organization.business_no == biz)):
        raise HTTPException(409, "이미 등록된 사업자등록번호입니다.")
    email = body.manager.email.strip().lower()
    if _find_user(db, email):
        raise HTTPException(409, "이미 가입된 담당자 이메일입니다.")

    o = body.organization
    org = m.Organization(
        name=o.name.strip(), organization_type=o.organization_type, address=o.address.strip(),
        contact_email=o.contact_email.strip().lower(), business_no=biz, verification_status="PENDING",
    )
    org.profile = m.OrganizationProfile(intro=body.profile.intro.strip())
    user = m.User(email=email, password_hash=hash_password(body.manager.password), name=body.manager.name.strip())
    member = m.OrgMember(user=user, organization=org, role="OWNER", membership_status="ACTIVE")
    db.add_all([org, user, member])
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "이미 등록된 기관 또는 이메일입니다.") from None
    db.refresh(member)
    return _session(db, Principal("ORG", user.user_id, member.member_id), response)


# ───────── 로그인 ─────────


@router.post("/auth/youth/login", response_model=s.SessionOut)
def login_youth(body: s.LoginIn, response: Response, db: Session = Depends(get_db)):
    user = _find_user(db, body.email)
    if not user or not verify_password(user.password_hash, body.password) or user.profile is None:
        raise HTTPException(401, BAD_LOGIN)
    if user.account_status != "ACTIVE":
        raise HTTPException(403, "이용이 제한된 계정입니다.")
    return _session(db, Principal("YOUTH", user.user_id, None), response)


@router.post("/auth/org/login", response_model=s.SessionOut)
def login_org(body: s.LoginIn, response: Response, db: Session = Depends(get_db)):
    user = _find_user(db, body.email)
    if not user or not verify_password(user.password_hash, body.password):
        raise HTTPException(401, BAD_LOGIN)
    member = db.scalar(
        select(m.OrgMember).where(m.OrgMember.user_id == user.user_id, m.OrgMember.membership_status == "ACTIVE").order_by(m.OrgMember.joined_at)
    )
    if member is None:
        raise HTTPException(401, BAD_LOGIN)
    if user.account_status != "ACTIVE":
        raise HTTPException(403, "이용이 제한된 계정입니다.")
    return _session(db, Principal("ORG", user.user_id, member.member_id), response)


@router.post("/auth/refresh", response_model=s.SessionOut)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    return _session(db, principal_from_refresh(request), response)


@router.post("/auth/logout", status_code=204)
def logout(response: Response) -> None:
    clear_refresh_cookie(response)


# ───────── 내 정보 (청년) ─────────


@router.patch("/me", response_model=s.UserOut)
def update_me(body: s.MeUpdateIn, user: m.User = Depends(require_youth), db: Session = Depends(get_db)):
    if body.name is not None:
        user.name = body.name.strip()
    if body.profile is not None and user.profile is not None:
        user.profile.school = body.profile.school.strip()
        user.profile.target_field = body.profile.target_field
        user.profile.marketing_consent = body.profile.marketing_consent
    db.commit()
    db.refresh(user)
    return user_out(user)
