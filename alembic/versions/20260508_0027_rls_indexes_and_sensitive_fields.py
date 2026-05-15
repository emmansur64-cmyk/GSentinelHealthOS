"""enforce tenant isolation, add perf indexes and prep sensitive fields encryption

Revision ID: 20260508_0027
Revises: 20260508_0026
Create Date: 2026-05-08 03:10:00
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260508_0027"
down_revision: Union[str, None] = "20260508_0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return inspector.has_table(table_name)


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    if not _has_table(inspector, table_name):
        return False
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _has_index_on_column(bind: sa.Connection, table_name: str, column_name: str) -> bool:
    query = sa.text(
        """
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = :table_name
          AND indexdef ILIKE :column_pattern
        LIMIT 1
        """
    )
    return bind.execute(
        query,
        {
            "table_name": table_name,
            "column_pattern": f"%({column_name})%",
        },
    ).fetchone() is not None


def _enable_rls_with_clinic_policy(table_name: str) -> None:
    op.execute(sa.text(f'ALTER TABLE "{table_name}" ENABLE ROW LEVEL SECURITY'))
    op.execute(sa.text(f'ALTER TABLE "{table_name}" FORCE ROW LEVEL SECURITY'))
    op.execute(sa.text(f'DROP POLICY IF EXISTS rls_clinic_isolation ON "{table_name}"'))
    op.execute(
        sa.text(
            f'''
            CREATE POLICY rls_clinic_isolation ON "{table_name}"
            USING (
                current_setting('app.tenant_bypass', true) = '1'
                OR (
                    NULLIF(current_setting('app.current_clinic_id', true), '') IS NOT NULL
                    AND clinic_id::text = current_setting('app.current_clinic_id', true)
                )
            )
            WITH CHECK (
                current_setting('app.tenant_bypass', true) = '1'
                OR (
                    NULLIF(current_setting('app.current_clinic_id', true), '') IS NOT NULL
                    AND clinic_id::text = current_setting('app.current_clinic_id', true)
                )
            )
            '''
        )
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # 1) Ajustes de tipos para soportar cifrado de campos sensibles.
    if _has_column(inspector, "patients", "dni"):
        op.alter_column(
            "patients",
            "dni",
            existing_type=sa.String(length=20),
            type_=sa.Text(),
            existing_nullable=True,
        )

    if _has_column(inspector, "appointments", "patient_dni"):
        op.alter_column(
            "appointments",
            "patient_dni",
            existing_type=sa.String(length=20),
            type_=sa.Text(),
            existing_nullable=True,
        )

    if _has_column(inspector, "appointments", "patient_phone"):
        op.alter_column(
            "appointments",
            "patient_phone",
            existing_type=sa.String(length=30),
            type_=sa.Text(),
            existing_nullable=True,
        )

    # 2) Indices de performance de auditoria.
    if _has_column(inspector, "doctors", "specialization") and not _has_index_on_column(bind, "doctors", "specialization"):
        op.create_index("ix_doctors_specialization", "doctors", ["specialization"], unique=False)

    if _has_column(inspector, "appointments", "patient_id") and not _has_index_on_column(bind, "appointments", "patient_id"):
        op.create_index("ix_appointments_patient_id", "appointments", ["patient_id"], unique=False)

    # 3) Aislamiento de tenant por politica RLS a nivel PostgreSQL.
    for table_name in [
        "appointments",
        "patients",
        "doctors",
        "bot_knowledge_base",
        "notification_outbox",
        "google_outbox",
        "client_whatsapp_accounts",
        "clinic_members",
    ]:
        if _has_column(inspector, table_name, "clinic_id"):
            _enable_rls_with_clinic_policy(table_name)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    for table_name in [
        "appointments",
        "patients",
        "doctors",
        "bot_knowledge_base",
        "notification_outbox",
        "google_outbox",
        "client_whatsapp_accounts",
        "clinic_members",
    ]:
        if _has_table(inspector, table_name):
            op.execute(sa.text(f'DROP POLICY IF EXISTS rls_clinic_isolation ON "{table_name}"'))
            op.execute(sa.text(f'ALTER TABLE "{table_name}" NO FORCE ROW LEVEL SECURITY'))
            op.execute(sa.text(f'ALTER TABLE "{table_name}" DISABLE ROW LEVEL SECURITY'))

    if _has_table(inspector, "doctors"):
        op.execute(sa.text("DROP INDEX IF EXISTS ix_doctors_specialization"))

    if _has_table(inspector, "appointments"):
        op.execute(sa.text("DROP INDEX IF EXISTS ix_appointments_patient_id"))
