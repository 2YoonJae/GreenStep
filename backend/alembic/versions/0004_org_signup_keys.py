"""기관 코드 키: 운영자가 발급한 키가 있어야 기관 회원가입 가능

- organization_keys          : GreenStep 이 발급한 기관 코드 키 목록 (한 키는 한 기관만 사용)
- organizations.business_api_key : 노션 표의 businiess_api_key(고유 기관 API 키, VARCHAR(20)).
                                   0001 에서는 ERD 에 없어 만들지 않았으나 가입 키 도입으로 추가.
                                   철자는 business 로 바로잡음. 기존 기관은 NULL.

Revision ID: 0004
Revises: 0003
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE organization_keys (
            key_code        VARCHAR(20) PRIMARY KEY
                            CHECK (key_code ~ '^[A-Z0-9-]{4,20}$'),          -- 대문자·숫자·하이픈
            organization_id UUID        UNIQUE
                            REFERENCES organizations (organization_id) ON DELETE CASCADE,  -- 사용한 기관 (미사용이면 NULL)
            issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            used_at         TIMESTAMPTZ,
            CONSTRAINT organization_keys_used_ck CHECK ((organization_id IS NULL) = (used_at IS NULL))
        )
        """
    )
    # 키 ↔ 기관 연결은 organization_keys.organization_id 가 기준. 여기는 노션 컬럼(조회용 사본)
    op.execute("ALTER TABLE organizations ADD COLUMN business_api_key VARCHAR(20) UNIQUE")


def downgrade() -> None:
    op.execute("ALTER TABLE organizations DROP COLUMN IF EXISTS business_api_key")
    op.execute("DROP TABLE IF EXISTS organization_keys")
