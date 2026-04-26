"""Add google_sync_status to appointments.

Revision ID: 20260402_0012
Revises: 20260402_0011
Create Date: 2026-04-03 00:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260402_0012"
down_revision = "20260402_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    apt_columns = {col["name"] for col in inspector.get_columns("appointments")}
    
    if "google_sync_status" not in apt_columns:
        op.add_column(
            "appointments",
            sa.Column("google_sync_status", sa.String(length=20), nullable=False, server_default="pending"),
        )
        apt_indexes = {idx["name"] for idx in inspector.get_indexes("appointments")}
        if "ix_appointments_google_sync_status" not in apt_indexes:
            op.create_index(
                "ix_appointments_google_sync_status",
                "appointments",
                ["google_sync_status"],
                unique=False,
            )


def downgrade() -> None:
    op.drop_index("ix_appointments_google_sync_status", table_name="appointments")
    op.drop_column("appointments", "google_sync_status")
