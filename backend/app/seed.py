"""데모 데이터 (DEMO_MODE=true 이고 users 테이블이 비어 있을 때만 1회 적재).
웹 mock 모드와 같은 데모 계정: 청년 youth@demo.kr / 기관 org@demo.kr, 비밀번호 demo1234
가상 데이터이며 실제 기관·인물과 무관합니다."""
from datetime import date, timedelta

from sqlalchemy import func, select

from app import models as m
from app.config import settings
from app.db import SessionLocal
from app.domain import REGION_CODE, judge_difficulty
from app.security import hash_password

DEMO_PASSWORD = "demo1234"
# 기관 회원가입 시연용 기관 코드 키 (웹 mock 의 seedOrgKeys 와 같은 값). 실제 키는 운영자가 organization_keys 에 직접 발급
DEMO_ORG_KEYS = ("GS-DEMO-0001", "GS-DEMO-0002", "GS-DEMO-0003")


def _activity(org: m.Organization, **kw) -> m.Activity:
    details = kw.pop("details")
    a = m.Activity(organization=org, source_type="GREENSTEP", status="RECRUITING", applicant_count=0, **kw)
    r = judge_difficulty(details["target_group"], details["tasks"], details["individual_support"])
    a.details = m.ActivityDetail(**details, difficulty_reason=r.reason, weight_status="CANDIDATE" if r.candidate else "NONE")
    return a


def _seed_org_keys(db) -> None:
    """데모용 기관 코드 키 (없는 것만 추가). 이미 데이터가 있는 DB 에도 적용"""
    have = set(db.scalars(select(m.OrganizationKey.key_code).where(m.OrganizationKey.key_code.in_(DEMO_ORG_KEYS))))
    new = [m.OrganizationKey(key_code=k) for k in DEMO_ORG_KEYS if k not in have]
    if new:
        db.add_all(new)
        db.commit()
        print(f"[seed] 데모 기관 코드 키 {len(new)}개를 추가했습니다.")


def run() -> None:
    if not settings.demo_mode:
        return
    with SessionLocal() as db:
        _seed_org_keys(db)
        if db.scalar(select(func.count()).select_from(m.User)):
            return
        pw = hash_password(DEMO_PASSWORD)
        today = date.today()

        youth = m.User(email="youth@demo.kr", password_hash=pw, name="김지원")
        youth.profile = m.UserProfile(school="한국대학교 사회복지학과", target_field="복지관")

        org = m.Organization(
            name="성남 이웃돌봄복지관", organization_type="WELFARE_CENTER", verification_status="APPROVED",
            address="경기 성남시 수정구 이웃로 12", contact_email="contact@demo.kr", business_no="1298210001",
        )
        org.profile = m.OrganizationProfile(intro="성남 지역 어르신과 아동을 위한 돌봄·여가 프로그램을 운영하는 종합사회복지관입니다.")
        manager = m.User(email="org@demo.kr", password_hash=pw, name="한지민")
        member = m.OrgMember(user=manager, organization=org, role="OWNER", membership_status="ACTIVE")

        acts = [
            _activity(
                org, title="방과후 아동 1:1 돌봄 교실", category="care", region_code=REGION_CODE["경기"], region_name="경기 성남시",
                address="경기 성남시 수정구 이웃로 12", description="평일 오후 3시~6시. 아동 한 명을 맡아 숙제 지도와 정서 지원을 합니다.",
                recruit_start_date=today - timedelta(days=7), recruit_end_date=today + timedelta(days=17),
                activity_start_date=today + timedelta(days=7), activity_end_date=today + timedelta(days=63), capacity=8,
                details=dict(summary="맞벌이 가정 아동과 1:1로 숙제와 놀이를 함께합니다.", hours_per_session=3,
                             target_group="초등 저학년 아동", tasks="1:1 돌봄, 숙제 지도, 정서 지원", individual_support=True),
            ),
            _activity(
                org, title="어르신과 나누는 따뜻한 일상", category="care", region_code=REGION_CODE["경기"], region_name="경기 성남시",
                address="경기 성남시 수정구 이웃로 12 프로그램실", description="어르신 여가 프로그램(만들기·노래교실) 준비와 진행을 돕습니다.",
                recruit_start_date=today - timedelta(days=3), recruit_end_date=today + timedelta(days=10),
                activity_start_date=today + timedelta(days=14), activity_end_date=today + timedelta(days=35), capacity=10,
                details=dict(summary="복지관 프로그램실에서 어르신들과 여가 활동을 함께합니다.", hours_per_session=3,
                             target_group="지역 어르신", tasks="여가 프로그램 진행 보조, 말벗", individual_support=False),
            ),
        ]
        db.add_all([youth, org, manager, member, *acts])
        db.commit()
        print("[seed] 데모 계정·공고를 적재했습니다.")


if __name__ == "__main__":
    run()
