"""add pronouns to users

Revision ID: d3e7a9c1f4b2
Revises: c8d1f6a4b2e7
Create Date: 2026-08-01
"""

from alembic import op
import sqlalchemy as sa


revision = "d3e7a9c1f4b2"
down_revision = "c8d1f6a4b2e7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("pronouns", sa.String(length=30), nullable=True),
    )


def downgrade():
    op.drop_column("users", "pronouns")
