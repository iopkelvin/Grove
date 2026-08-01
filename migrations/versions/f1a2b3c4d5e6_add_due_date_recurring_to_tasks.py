"""add due_date and recurring to tasks

Revision ID: f1a2b3c4d5e6
Revises: e4b7d28c6f31
Create Date: 2026-08-01
"""

from alembic import op
import sqlalchemy as sa


revision = "f1a2b3c4d5e6"
down_revision = "e4b7d28c6f31"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tasks", sa.Column("due_date", sa.Date(), nullable=True))
    op.add_column(
        "tasks",
        sa.Column("recurring", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("tasks", sa.Column("last_completed_date", sa.Date(), nullable=True))


def downgrade():
    op.drop_column("tasks", "last_completed_date")
    op.drop_column("tasks", "recurring")
    op.drop_column("tasks", "due_date")
