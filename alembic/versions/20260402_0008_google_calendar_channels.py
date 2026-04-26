"""Add google_calendar_channels table for watch/webhook validation.

Revision ID: 20260402_0008
Revises: 20260402_0007
Create Date: 2026-04-02 22:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260402_0008"
down_revision = "20260402_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    if not inspector.has_table("google_calendar_channels"):
        op.create_table(
            "google_calendar_channels",
            sa.Column("channel_id", sa.String(length=128), primary_key=True, nullable=False),
            sa.Column("resource_id", sa.String(length=255), nullable=False),
            sa.Column("calendar_id", sa.String(length=255), nullable=False, server_default="primary"),
            sa.Column("webhook_token", sa.String(length=255), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
            sa.Column("expiration", sa.DateTime(), nullable=True),
            sa.Column("last_sync_token", sa.Text(), nullable=True),
            sa.Column("last_notification_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )

        op.create_index("ix_google_calendar_channels_resource_id", "google_calendar_channels", ["resource_id"], unique=False)
        op.create_index("ix_google_calendar_channels_status", "google_calendar_channels", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_google_calendar_channels_status", table_name="google_calendar_channels")
    op.drop_index("ix_google_calendar_channels_resource_id", table_name="google_calendar_channels")
    op.drop_table("google_calendar_channels")
