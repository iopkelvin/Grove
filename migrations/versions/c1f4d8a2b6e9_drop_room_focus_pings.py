"""drop room_focus_pings

Revision ID: c1f4d8a2b6e9
Revises: b9e2a6d5f0c1
Create Date: 2026-08-04
"""

from alembic import op
import sqlalchemy as sa


revision = "c1f4d8a2b6e9"
down_revision = "b9e2a6d5f0c1"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table("room_focus_pings")


def downgrade():
    op.create_table(
        "room_focus_pings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room_id", sa.Integer(), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("last_ping_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("room_id", "user_id", name="uq_room_focus_ping"),
    )
