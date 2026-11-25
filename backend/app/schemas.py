"""API 요청·응답 모양. JSON 키는 camelCase — 프론트 web/src/data/types.ts, web/src/api/types.ts 와 같습니다.
응답(…Out)은 테이블 + 1:1 확장 테이블을 합친 한 행이고, 입력(…In)은 테이블별로 나눠 받습니다."""
from datetime import date, datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

T = TypeVar("T")

OrgType = Literal["WELFARE_CENTER", "WELFARE_FACILITY", "NONPROFIT", "PUBLIC", "COMPANY", "OTHER"]
Category = Literal["education", "care", "environment", "health"]
ActivityStatus = Literal["DRAFT", "RECRUITING", "CLOSED", "CANCELLED"]


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ───────── 응답 ─────────


class UserOut(Camel):
    # users
    id: str
    email: str
    name: str
    account_status: str
    created_at: datetime
    updated_at: datetime
    # user_profiles
    school: str
    target_field: str
    marketing_consent: bool


class OrganizationOut(Camel):
    # organizations
    id: str
    name: str
    organization_type: str
    verification_status: str
    address: str
    contact_email: str
    created_at: datetime
    business_no: str
    # organization_profiles
    intro: str
    shortage: bool
    difficulty: bool
    vulnerable: bool


class OrgMemberOut(Camel):
    # org_members
    id: str
    user_id: str
    organization_id: str
    role: str
    membership_status: str
    joined_at: datetime
    # users
    email: str
    name: str


class SessionOut(Camel):
    role: Literal["YOUTH", "ORG"]
    access_token: str
    user: UserOut | None = None
    member: OrgMemberOut | None = None
    org: OrganizationOut | None = None


class WeightFlags(Camel):
    difficulty: bool
    shortage: bool
    vulnerable: bool


class ActivityOut(Camel):
    # activities
    id: str
    organization_id: str | None
    source_type: str
    external_activity_id: str | None
    external_url: str | None
    external_org_name: str | None
    title: str
    description: str
    category: str
    source_category: str | None
    region_code: str
    region_name: str
    address: str
    recruit_start_date: date | None
    recruit_end_date: date | None
    activity_start_date: date | None
    activity_end_date: date | None
    capacity: int
    applicant_count: int
    status: str
    created_at: datetime
    updated_at: datetime
    # organizations.name 또는 external_org_name
    org_name: str
    # activity_details
    summary: str
    hours_per_session: float
    target_group: str
    tasks: str
    individual_support: bool
    difficulty_reason: str | None
    weight: float
    weight_status: str
    weight_flags: WeightFlags
    views: int


class ActivityDetailOut(ActivityOut):
    applied: bool = False


class PageOut(Camel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class OrgDashboardOut(Camel):
    total_value: float
    total_hours: float
    youth_count: int
    pending_count: int
    approval_rate: float
    active_activities: int


class PlatformStatsOut(Camel):
    youth_count: int
    org_count: int
    total_hours: float
    total_value: float


# ───────── 입력 ─────────

EMAIL = r"^\S+@\S+\.\S+$"


class LoginIn(Camel):
    email: str
    password: str


class UserProfileIn(Camel):
    """user_profiles"""

    school: str = Field("", max_length=200)
    target_field: str = Field("", max_length=50)
    marketing_consent: bool = False


class YouthSignupIn(Camel):
    """users + user_profiles"""

    email: str = Field(pattern=EMAIL, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)
    profile: UserProfileIn = UserProfileIn()


class OrganizationIn(Camel):
    """organizations (organization_id · verification_status · created_at 은 서버가 정함)"""

    name: str = Field(min_length=1, max_length=200)
    organization_type: OrgType
    address: str = Field(min_length=1, max_length=255)
    contact_email: str = Field(pattern=EMAIL, max_length=255)
    business_no: str = Field(max_length=12)


class OrganizationProfileIn(Camel):
    """organization_profiles (가중치 플래그는 운영자 전용이라 받지 않음)"""

    intro: str = ""


class ManagerIn(Camel):
    """기관 담당자 계정 → users + org_members(role=OWNER)"""

    name: str = Field(min_length=1, max_length=100)
    email: str = Field(pattern=EMAIL, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class OrgSignupIn(Camel):
    organization: OrganizationIn
    profile: OrganizationProfileIn = OrganizationProfileIn()
    manager: ManagerIn


class MeUpdateIn(Camel):
    name: str | None = Field(None, min_length=1, max_length=100)
    profile: UserProfileIn | None = None


class ActivityDetailsIn(Camel):
    """activity_details (weight·weight_status·difficulty_reason·view_count 는 서버가 정함)"""

    summary: str = Field("", max_length=80)
    hours_per_session: float = Field(ge=0.5, le=12)
    target_group: str = Field(min_length=1, max_length=100)
    tasks: str = Field(min_length=1, max_length=200)
    individual_support: bool = False


class ActivityIn(Camel):
    """activities (activity_id · organization_id · source_type · external_* · applicant_count · 일시는 서버가 정함)"""

    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    category: Category
    region_code: str = Field(max_length=20)
    region_name: str = Field(max_length=100)
    address: str = Field("", max_length=255)
    recruit_start_date: date
    recruit_end_date: date
    activity_start_date: date
    activity_end_date: date
    capacity: int = Field(ge=1, le=500)
    status: Literal["DRAFT", "RECRUITING"]
    details: ActivityDetailsIn


class ActivityStatusIn(Camel):
    status: ActivityStatus
