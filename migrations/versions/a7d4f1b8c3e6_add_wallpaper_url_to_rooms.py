"""add wallpaper_url to rooms

Revision ID: a7d4f1b8c3e6
Revises: e9a1c5f7b3d0
Create Date: 2026-08-03
"""

from alembic import op
import sqlalchemy as sa


revision = "a7d4f1b8c3e6"
down_revision = "e9a1c5f7b3d0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("rooms", sa.Column("wallpaper_url", sa.String(length=500), nullable=True))


def downgrade():
    op.drop_column("rooms", "wallpaper_url")
