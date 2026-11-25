"""수집 워커 테이블: sync_runs, external_sync_state

스키마 본문은 같은 폴더의 0002_collector_tables.sql 에 있습니다.

Revision ID: 0002
Revises: 0001
"""
from pathlib import Path

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).with_suffix(".sql")


def upgrade() -> None:
    op.get_bind().exec_driver_sql(SQL_FILE.read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS external_sync_state")
    op.execute("DROP TABLE IF EXISTS sync_runs")
