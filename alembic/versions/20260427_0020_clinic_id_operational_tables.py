"""add clinic_id to operational tables

Revision ID: 20260427_0020_clinic
Revises: 20260427_0020
Create Date: 2026-04-27 00:10:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260427_0020_clinic"
down_revision: Union[str, None] = "20260427_0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLES_WITH_CLINIC_ID = (
    "patients",
    "doctors",
    "appointments",
    "notification_outbox",
    "google_outbox",
    "bot_knowledge_base",
    "time_slots",
    "slot_audit_log",
    "doctor_schedule_config",
    "appointments_v2",
    "audit_logs",
    "whatsapp_sessions",
    "whatsapp_messages",
    "medical_files",
)


def _clinic_id_type() -> sa.types.TypeEngine:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        return postgresql.UUID(as_uuid=True)
    return sa.String(length=36)


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table_name):
        return False
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    clinic_id_type = _clinic_id_type()

    for table_name in TABLES_WITH_CLINIC_ID:
        if not inspector.has_table(table_name):
            continue
        if not _has_column(table_name, "clinic_id"):
            op.add_column(table_name, sa.Column("clinic_id", clinic_id_type, nullable=True))

        index_name = f"ix_{table_name}_clinic_id"
        existing_indexes = {index["name"] for index in inspector.get_indexes(table_name)}
        if index_name not in existing_indexes:
            op.create_index(index_name, table_name, ["clinic_id"], unique=False)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    for table_name in reversed(TABLES_WITH_CLINIC_ID):
        if not inspector.has_table(table_name):
            continue
        index_name = f"ix_{table_name}_clinic_id"
        existing_indexes = {index["name"] for index in inspector.get_indexes(table_name)}
        if index_name in existing_indexes:
            op.drop_index(index_name, table_name=table_name)
        if _has_column(table_name, "clinic_id"):
            op.drop_column(table_name, "clinic_id")
