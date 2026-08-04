"""enable realtime on room_messages

Revision ID: d4e8b3a7c5f2
Revises: b9e2a6d5f0c1
Create Date: 2026-08-04
"""

from alembic import op


revision = "d4e8b3a7c5f2"
down_revision = "b9e2a6d5f0c1"
branch_labels = None
depends_on = None

POLICY_NAME = "Authenticated users can read room messages"


def upgrade():
    op.execute("ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;")
    op.execute(
        f"""
        CREATE POLICY "{POLICY_NAME}"
          ON room_messages FOR SELECT
          TO authenticated
          USING (true);
        """
    )
    op.execute("ALTER PUBLICATION supabase_realtime ADD TABLE room_messages;")


def downgrade():
    op.execute("ALTER PUBLICATION supabase_realtime DROP TABLE room_messages;")
    op.execute(f'DROP POLICY "{POLICY_NAME}" ON room_messages;')
    op.execute("ALTER TABLE room_messages DISABLE ROW LEVEL SECURITY;")
