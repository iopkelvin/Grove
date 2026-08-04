"""add room_messages

Revision ID: b9e2a6d5f0c1
Revises: a7d4f1b8c3e6
Create Date: 2026-08-03
"""

from alembic import op
import sqlalchemy as sa


revision = "b9e2a6d5f0c1"
down_revision = "a7d4f1b8c3e6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "room_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room_id", sa.Integer(), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_room_messages_room_id", "room_messages", ["room_id"])


def downgrade():
    op.drop_index("ix_room_messages_room_id", table_name="room_messages")
    op.drop_table("room_messages")
