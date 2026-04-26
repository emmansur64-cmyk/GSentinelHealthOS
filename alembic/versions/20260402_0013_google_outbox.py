"""Create dedicated google_outbox table for Google Calendar sync.

Revision ID: 20260402_0013
Revises: 20260402_0012
Create Date: 2026-04-03 01:10:00.000000
"""

from typing import Any, Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260402_0013"
down_revision: Union[str, None] = "20260402_0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        uuid_type: Any = postgresql.UUID(as_uuid=True)
        payload_type: Any = postgresql.JSONB(astext_type=sa.Text())
    else:
        uuid_type = sa.String(length=36)
        payload_type = sa.JSON()

    if not inspector.has_table("google_outbox"):
        op.create_table(
            "google_outbox",
            sa.Column("id", uuid_type, primary_key=True, nullable=False),
            sa.Column("appointment_id", sa.Integer(), nullable=False),
            sa.Column("action", sa.String(length=20), nullable=False),
            sa.Column("payload", payload_type, nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("retries", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("next_attempt_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("idempotency_key", sa.String(length=255), nullable=False),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column("processed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("idempotency_key", name="uq_google_outbox_idempotency_key"),
            sa.CheckConstraint("action IN ('create', 'update', 'delete')", name="ck_google_outbox_action_valid"),
            sa.CheckConstraint("status IN ('pending', 'processing', 'done', 'failed')", name="ck_google_outbox_status_valid"),
        )

        op.create_index("ix_google_outbox_appointment_id", "google_outbox", ["appointment_id"], unique=False)
        op.create_index("ix_google_outbox_action", "google_outbox", ["action"], unique=False)
        op.create_index("ix_google_outbox_status", "google_outbox", ["status"], unique=False)
        op.create_index("ix_google_outbox_next_attempt_at", "google_outbox", ["next_attempt_at"], unique=False)
        op.create_index("ix_google_outbox_idempotency_key", "google_outbox", ["idempotency_key"], unique=True)
        op.create_index("idx_google_outbox_status_next", "google_outbox", ["status", "next_attempt_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_google_outbox_status_next", table_name="google_outbox")
    op.drop_index("ix_google_outbox_idempotency_key", table_name="google_outbox")
    op.drop_index("ix_google_outbox_next_attempt_at", table_name="google_outbox")
    op.drop_index("ix_google_outbox_status", table_name="google_outbox")
    op.drop_index("ix_google_outbox_action", table_name="google_outbox")
    op.drop_index("ix_google_outbox_appointment_id", table_name="google_outbox")
    op.drop_table("google_outbox")
