"""SQLAlchemy 모델. 테이블 정의의 기준은 alembic/versions/0001_initial_schema.sql 입니다.
여기에는 API 가 읽고 쓰는 테이블만 매핑합니다 (실적·검증·계산 테이블은 집계 SQL 로만 사용)."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())


def _now() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


# ───────── 노션 테이블 ─────────


class User(Base):
    __tablename__ = "users"
    user_id: Mapped[uuid.UUID] = _pk()
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(100))
    account_status: Mapped[str] = mapped_column(String(20), server_default="ACTIVE")
    created_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime] = _now()

    profile: Mapped["UserProfile | None"] = relationship(back_populates="user", uselist=False, lazy="joined")


class Organization(Base):
    __tablename__ = "organizations"
    organization_id: Mapped[uuid.UUID] = _pk()
    name: Mapped[str] = mapped_column(String(200))
    organization_type: Mapped[str] = mapped_column(String(50))
    verification_status: Mapped[str] = mapped_column(String(20), server_default="PENDING")
    address: Mapped[str] = mapped_column(String(255))
    contact_email: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = _now()
    business_no: Mapped[str] = mapped_column(String(10), unique=True)
    business_api_key: Mapped[str | None] = mapped_column(String(20), unique=True)  # 가입에 쓴 기관 코드 키 (0004)

    profile: Mapped["OrganizationProfile | None"] = relationship(back_populates="organization", uselist=False, lazy="joined")


class OrganizationKey(Base):
    """GreenStep 이 발급한 기관 코드 키 (0004). 미사용 키만 가입에 쓸 수 있고, 한 키는 한 기관만"""

    __tablename__ = "organization_keys"
    key_code: Mapped[str] = mapped_column(String(20), primary_key=True)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organizations.organization_id"), unique=True)
    issued_at: Mapped[datetime] = _now()
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class OrgMember(Base):
    __tablename__ = "org_members"
    member_id: Mapped[uuid.UUID] = _pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id"))
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.organization_id"))
    role: Mapped[str] = mapped_column(String(30), server_default="MANAGER")
    membership_status: Mapped[str] = mapped_column(String(20), server_default="PENDING")
    joined_at: Mapped[datetime] = _now()

    user: Mapped[User] = relationship(lazy="joined")
    organization: Mapped[Organization] = relationship(lazy="joined")


class Activity(Base):
    __tablename__ = "activities"
    activity_id: Mapped[uuid.UUID] = _pk()
    organization_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organizations.organization_id"))
    source_type: Mapped[str] = mapped_column(String(20), server_default="GREENSTEP")
    external_activity_id: Mapped[str | None] = mapped_column(String(100))
    external_url: Mapped[str | None] = mapped_column(Text)
    external_org_name: Mapped[str | None] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, server_default="")
    category: Mapped[str] = mapped_column(String(100))
    source_category: Mapped[str | None] = mapped_column(String(100))
    region_code: Mapped[str | None] = mapped_column(String(20))
    region_name: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(String(255))
    recruit_start_date: Mapped[date | None] = mapped_column(Date)
    recruit_end_date: Mapped[date | None] = mapped_column(Date)
    activity_start_date: Mapped[date | None] = mapped_column(Date)
    activity_end_date: Mapped[date | None] = mapped_column(Date)
    capacity: Mapped[int | None] = mapped_column(Integer)
    applicant_count: Mapped[int] = mapped_column(Integer, server_default="0")
    status: Mapped[str] = mapped_column(String(20), server_default="DRAFT")
    created_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime] = _now()

    organization: Mapped[Organization | None] = relationship(lazy="joined")
    details: Mapped["ActivityDetail | None"] = relationship(back_populates="activity", uselist=False, lazy="joined", cascade="all, delete-orphan")


class Application(Base):
    __tablename__ = "applications"
    application_id: Mapped[uuid.UUID] = _pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id"))
    activity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("activities.activity_id"))
    status: Mapped[str] = mapped_column(String(20), server_default="APPLIED")
    applied_at: Mapped[datetime] = _now()
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ───────── 확장 테이블 (1:1) ─────────


class UserProfile(Base):
    __tablename__ = "user_profiles"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id"), primary_key=True)
    school: Mapped[str] = mapped_column(String(200), server_default="")
    target_field: Mapped[str] = mapped_column(String(50), server_default="")
    marketing_consent: Mapped[bool] = mapped_column(Boolean, server_default="false")
    updated_at: Mapped[datetime] = _now()

    user: Mapped[User] = relationship(back_populates="profile")


class OrganizationProfile(Base):
    __tablename__ = "organization_profiles"
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.organization_id"), primary_key=True)
    intro: Mapped[str] = mapped_column(Text, server_default="")
    weight_shortage: Mapped[bool] = mapped_column(Boolean, server_default="false")
    weight_difficulty: Mapped[bool] = mapped_column(Boolean, server_default="false")
    weight_vulnerable: Mapped[bool] = mapped_column(Boolean, server_default="false")

    organization: Mapped[Organization] = relationship(back_populates="profile")


class ActivityDetail(Base):
    __tablename__ = "activity_details"
    activity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("activities.activity_id"), primary_key=True)
    summary: Mapped[str] = mapped_column(String(80), server_default="")
    hours_per_session: Mapped[Decimal] = mapped_column(Numeric(3, 1))
    target_group: Mapped[str] = mapped_column(String(100), server_default="")
    tasks: Mapped[str] = mapped_column(String(200), server_default="")
    individual_support: Mapped[bool] = mapped_column(Boolean, server_default="false")
    difficulty_reason: Mapped[str | None] = mapped_column(Text)
    weight: Mapped[Decimal] = mapped_column(Numeric(2, 1), server_default="1.0")
    weight_status: Mapped[str] = mapped_column(String(20), server_default="NONE")
    weight_difficulty: Mapped[bool] = mapped_column(Boolean, server_default="false")
    weight_shortage: Mapped[bool] = mapped_column(Boolean, server_default="false")
    weight_vulnerable: Mapped[bool] = mapped_column(Boolean, server_default="false")
    view_count: Mapped[int] = mapped_column(Integer, server_default="0")

    activity: Mapped[Activity] = relationship(back_populates="details")
