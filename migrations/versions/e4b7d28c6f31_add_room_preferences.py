"""add room preferences

Revision ID: e4b7d28c6f31
Revises: 1972d2c1b807
Create Date: 2026-07-31
"""

from alembic import op
import sqlalchemy as sa


revision = "e4b7d28c6f31"
down_revision = "1972d2c1b807"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "rooms",
        sa.Column("setting", sa.String(length=40), nullable=False, server_default="campsite"),
    )
    op.add_column(
        "rooms",
        sa.Column("music_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "rooms",
        sa.Column("chat_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "rooms",
        sa.Column("focus_minutes", sa.Integer(), nullable=False, server_default="50"),
    )


def downgrade():
    op.drop_column("rooms", "focus_minutes")
    op.drop_column("rooms", "chat_enabled")
    op.drop_column("rooms", "music_enabled")
    op.drop_column("rooms", "setting")
