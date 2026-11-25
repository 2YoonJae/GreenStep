"""공고 사진 기능 제거: activity_details.image_url 삭제

Revision ID: 0003
Revises: 0002
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE activity_details DROP COLUMN IF EXISTS image_url")


def downgrade() -> None:
    op.execute("ALTER TABLE activity_details ADD COLUMN IF NOT EXISTS image_url TEXT")
