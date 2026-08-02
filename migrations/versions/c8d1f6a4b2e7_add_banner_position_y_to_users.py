"""add banner_position_y to users

Revision ID: c8d1f6a4b2e7
Revises: b7c4e9f2a1d3
Create Date: 2026-08-02
"""

from alembic import op
import sqlalchemy as sa


revision = "c8d1f6a4b2e7"
down_revision = "b7c4e9f2a1d3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("banner_position_y", sa.Integer(), nullable=False, server_default="50"),
    )


def downgrade():
    op.drop_column("users", "banner_position_y")
