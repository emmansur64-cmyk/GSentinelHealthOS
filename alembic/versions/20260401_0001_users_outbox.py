"""create users and notification_outbox

Revision ID: 20260401_0001
Revises: 
Create Date: 2026-04-01 00:00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260401_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        uuid_type = postgresql.UUID(as_uuid=True)
        payload_type = postgresql.JSONB(astext_type=sa.Text())
    else:
        uuid_type = sa.String(length=36)
        payload_type = sa.JSON()

    doctor_id_type = uuid_type
    create_doctor_fk = False
    if inspector.has_table("doctors"):
        doctor_columns = {col["name"]: col for col in inspector.get_columns("doctors")}
        doctor_id_column = doctor_columns.get("id")
        if doctor_id_column is not None:
            doctor_id_type = doctor_id_column["type"]
            create_doctor_fk = True

    user_columns = [
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="doctor"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("doctor_id", doctor_id_type, nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.CheckConstraint("role IN ('admin', 'doctor', 'receptionist')", name="ck_users_role_valid"),
    ]

    op.create_table("users", *user_columns)
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_role", "users", ["role"], unique=False)
    op.create_index("ix_users_doctor_id", "users", ["doctor_id"], unique=False)

    op.create_table(
        "notification_outbox",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("aggregate_type", sa.String(length=50), nullable=False, server_default="appointment"),
        sa.Column("aggregate_id", uuid_type, nullable=False),
        sa.Column("payload", payload_type, nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_notification_outbox_event_type", "notification_outbox", ["event_type"], unique=False)
    op.create_index("ix_notification_outbox_aggregate_id", "notification_outbox", ["aggregate_id"], unique=False)
    op.create_index("ix_notification_outbox_status", "notification_outbox", ["status"], unique=False)
    op.create_index("ix_notification_outbox_next_attempt_at", "notification_outbox", ["next_attempt_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_notification_outbox_next_attempt_at", table_name="notification_outbox")
    op.drop_index("ix_notification_outbox_status", table_name="notification_outbox")
    op.drop_index("ix_notification_outbox_aggregate_id", table_name="notification_outbox")
    op.drop_index("ix_notification_outbox_event_type", table_name="notification_outbox")
    op.drop_table("notification_outbox")

    op.drop_index("ix_users_doctor_id", table_name="users")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
