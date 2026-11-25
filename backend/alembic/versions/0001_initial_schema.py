"""초기 스키마: 노션 회원·기관 DB 11개 테이블 + 확장 테이블 3개

스키마 본문은 같은 폴더의 0001_initial_schema.sql 에 있습니다 (읽기 쉬운 SQL 한 곳에서 관리).

Revision ID: 0001
Revises:
"""
from pathlib import Path

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).with_suffix(".sql")

TABLES = [
    # 참조하는 쪽부터 삭제
    "activity_details",
    "organization_profiles",
    "user_profiles",
    "social_value_calculations",
    "valuation_rules",
    "record_attributions",
    "verification_logs",
    "evidence_documents",
    "participations",
    "applications",
    "activities",
    "org_members",
    "organizations",
    "users",
]


def upgrade() -> None:
    # exec_driver_sql: SQLAlchemy 의 :name 바인딩 해석 없이 SQL 파일을 그대로 실행
    op.get_bind().exec_driver_sql(SQL_FILE.read_text(encoding="utf-8"))


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at()")
