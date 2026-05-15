"""backfill clinic_id and enforce not null on operational tables

Revision ID: 20260508_0025
Revises: 20260501_0024
Create Date: 2026-05-08 00:25:00

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260508_0025"
down_revision: Union[str, None] = "20260501_0024"
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


def _get_backfill_clinic_id() -> object | None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("clinics"):
        # Con bases separadas, clinics está en gsentinel_saas (Prisma), no aquí
        # Retornar None para skippear backfill
        return None

    clinic_id = bind.execute(sa.text("SELECT id FROM clinics ORDER BY id ASC LIMIT 1")).scalar_one_or_none()
    if clinic_id is None:
        # No hay clínicas disponibles aún, skippear backfill
        return None
    return clinic_id


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    clinic_id_type = _clinic_id_type()
    backfill_clinic_id = _get_backfill_clinic_id()

    # Si no hay clínicas, no podemos hacer backfill. Dejar clinic_id nullable.
    if backfill_clinic_id is None:
        return

    for table_name in TABLES_WITH_CLINIC_ID:
        if not inspector.has_table(table_name):
            continue

        columns = {column["name"]: column for column in inspector.get_columns(table_name)}
        clinic_column = columns.get("clinic_id")
        if clinic_column is None:
            continue

        if clinic_column["nullable"]:
            bind.execute(
                sa.text(f"UPDATE {table_name} SET clinic_id = :clinic_id WHERE clinic_id IS NULL"),
                {"clinic_id": backfill_clinic_id},
            )
            op.alter_column(
                table_name,
                "clinic_id",
                existing_type=clinic_id_type,
                nullable=False,
            )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    clinic_id_type = _clinic_id_type()

    for table_name in reversed(TABLES_WITH_CLINIC_ID):
        if not inspector.has_table(table_name):
            continue

        columns = {column["name"]: column for column in inspector.get_columns(table_name)}
        clinic_column = columns.get("clinic_id")
        if clinic_column is None:
            continue

        if not clinic_column["nullable"]:
            op.alter_column(
                table_name,
                "clinic_id",
                existing_type=clinic_id_type,
                nullable=True,
            )
