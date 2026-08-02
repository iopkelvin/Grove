"""add last_room to users

Revision ID: e9a1c5f7b3d0
Revises: d3e7a9c1f4b2
Create Date: 2026-08-01
"""

from alembic import op
import sqlalchemy as sa


revision = "e9a1c5f7b3d0"
down_revision = "d3e7a9c1f4b2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("last_room_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("last_room_visited_at", sa.DateTime(), nullable=True))
    op.create_foreign_key(
        "fk_users_last_room_id_rooms",
        "users",
        "rooms",
        ["last_room_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint("fk_users_last_room_id_rooms", "users", type_="foreignkey")
    op.drop_column("users", "last_room_visited_at")
    op.drop_column("users", "last_room_id")
