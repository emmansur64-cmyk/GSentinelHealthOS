"""PHI compliance: patient_consents, patient_access_logs, soft-delete columns

Revision ID: 20260516_0022
Revises: 20260516_0021
Create Date: 2026-05-16

Cambios:
- NUEVA TABLA patient_consents   — consentimiento informado por tipo y versión de política
- NUEVA TABLA patient_access_logs — audit trail de acceso a datos PHI
- NUEVA COLUMNA patients.deleted_at         (nullable DateTime) — soft-delete RGPD art.17
- NUEVA COLUMNA appointments.deleted_at     (nullable DateTime) — soft-delete RGPD art.17

Todas las operaciones son ADITIVAS (nuevas tablas + nuevas columnas nullable).
Rollback seguro: drop de tablas nuevas + drop de columnas (no hay pérdida de datos).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260516_0022"
down_revision: Union[str, None] = "20260516_0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── patient_consents ──────────────────────────────────────────────────────
    op.create_table(
        "patient_consents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "patient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("consent_type", sa.String(64), nullable=False),
        sa.Column("policy_version", sa.String(32), nullable=False, server_default="1.0"),
        sa.Column("channel", sa.String(32), nullable=False, server_default="web"),
        sa.Column("given_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("withdrawn_at", sa.DateTime, nullable=True),
        sa.Column("withdrawn_reason", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "consent_type IN ('data_processing','clinical_history','whatsapp_communications','ai_processing')",
            name="ck_patient_consents_type_valid",
        ),
        sa.UniqueConstraint(
            "patient_id", "consent_type", "policy_version",
            name="uq_patient_consent_type_version",
        ),
    )
    op.create_index("ix_patient_consents_patient_id", "patient_consents", ["patient_id"])
    op.create_index("ix_patient_consents_clinic_id", "patient_consents", ["clinic_id"])
    op.create_index("ix_patient_consents_given_at", "patient_consents", ["given_at"])

    # ── patient_access_logs ───────────────────────────────────────────────────
    op.create_table(
        "patient_access_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("timestamp", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("accessor_id", sa.String(255), nullable=False),
        sa.Column("accessor_role", sa.String(64), nullable=True),
        sa.Column("access_type", sa.String(32), nullable=False),
        sa.Column("resource_path", sa.String(255), nullable=True),
        sa.Column("request_id", sa.String(128), nullable=True),
        sa.Column("success", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("failure_reason", sa.String(255), nullable=True),
        sa.CheckConstraint(
            "access_type IN ('read','list','create','update','delete','export','search')",
            name="ck_patient_access_logs_type_valid",
        ),
    )
    op.create_index("ix_patient_access_logs_timestamp", "patient_access_logs", ["timestamp"])
    op.create_index("ix_patient_access_logs_patient_id", "patient_access_logs", ["patient_id"])
    op.create_index("ix_patient_access_logs_accessor_id", "patient_access_logs", ["accessor_id"])

    # ── patients.deleted_at (soft-delete) ─────────────────────────────────────
    op.add_column(
        "patients",
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_patients_deleted_at", "patients", ["deleted_at"])

    # ── appointments.deleted_at (soft-delete) ─────────────────────────────────
    op.add_column(
        "appointments",
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_appointments_deleted_at", "appointments", ["deleted_at"])


def downgrade() -> None:
    # Revertir en orden inverso
    op.drop_index("ix_appointments_deleted_at", table_name="appointments")
    op.drop_column("appointments", "deleted_at")

    op.drop_index("ix_patients_deleted_at", table_name="patients")
    op.drop_column("patients", "deleted_at")

    op.drop_index("ix_patient_access_logs_accessor_id", table_name="patient_access_logs")
    op.drop_index("ix_patient_access_logs_patient_id", table_name="patient_access_logs")
    op.drop_index("ix_patient_access_logs_timestamp", table_name="patient_access_logs")
    op.drop_table("patient_access_logs")

    op.drop_index("ix_patient_consents_given_at", table_name="patient_consents")
    op.drop_index("ix_patient_consents_clinic_id", table_name="patient_consents")
    op.drop_index("ix_patient_consents_patient_id", table_name="patient_consents")
    op.drop_table("patient_consents")
