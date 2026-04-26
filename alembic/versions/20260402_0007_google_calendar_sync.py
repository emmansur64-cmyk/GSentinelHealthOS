"""Add google_event_id to appointments for Calendar sync.

Revision ID: 20260402_0007
Revises: 20260402_0006
Create Date: 2026-04-02 21:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260402_0007"
down_revision = "20260402_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    apt_columns = {col["name"] for col in inspector.get_columns("appointments")}
    
    if "google_event_id" not in apt_columns:
        op.add_column(
            "appointments",
            sa.Column("google_event_id", sa.String(length=255), nullable=True),
        )
        apt_indexes = {idx["name"] for idx in inspector.get_indexes("appointments")}
        if "ix_appointments_google_event_id" not in apt_indexes:
            op.create_index("ix_appointments_google_event_id", "appointments", ["google_event_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_appointments_google_event_id", table_name="appointments")
    op.drop_column("appointments", "google_event_id")
