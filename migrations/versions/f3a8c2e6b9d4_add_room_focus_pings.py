"""add room_focus_pings

Revision ID: f3a8c2e6b9d4
Revises: e9a1c5f7b3d0
Create Date: 2026-08-03
"""

from alembic import op
import sqlalchemy as sa


revision = "f3a8c2e6b9d4"
down_revision = "e9a1c5f7b3d0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "room_focus_pings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room_id", sa.Integer(), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("last_ping_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("room_id", "user_id", name="uq_room_focus_ping"),
    )


def downgrade():
    op.drop_table("room_focus_pings")
