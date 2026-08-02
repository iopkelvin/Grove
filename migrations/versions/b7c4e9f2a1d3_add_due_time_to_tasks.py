"""add due_time to tasks

Revision ID: b7c4e9f2a1d3
Revises: a3f9c1d4e7b2
Create Date: 2026-08-02
"""

from alembic import op
import sqlalchemy as sa


revision = "b7c4e9f2a1d3"
down_revision = "a3f9c1d4e7b2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tasks", sa.Column("due_time", sa.Time(), nullable=True))


def downgrade():
    op.drop_column("tasks", "due_time")
