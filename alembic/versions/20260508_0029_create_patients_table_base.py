"""create patients table base in gsentinel

Revision ID: 20260508_0029
Revises: 20260508_0028
Create Date: 2026-05-08 05:10:00
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260508_0029"
down_revision: Union[str, None] = "20260508_0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return inspector.has_table(table_name)


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

    if _has_table(inspector, "patients"):
        return

    op.create_table(
        "patients",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("dni", sa.Text(), nullable=True),
        sa.Column("phone", sa.Text(), nullable=False),
        sa.Column("phone_hash", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_patients_client_id", "patients", ["client_id"], unique=False)
    op.create_index("ix_patients_clinic_id", "patients", ["clinic_id"], unique=False)
    op.create_index("ix_patients_dni", "patients", ["dni"], unique=False)
    op.create_index("ix_patients_phone_hash", "patients", ["phone_hash"], unique=True)
    op.create_index("ix_patients_email", "patients", ["email"], unique=True)

    _enable_rls_with_clinic_policy("patients")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not _has_table(inspector, "patients"):
        return

    op.execute(sa.text('DROP POLICY IF EXISTS rls_clinic_isolation ON "patients"'))
    op.execute(sa.text('ALTER TABLE "patients" NO FORCE ROW LEVEL SECURITY'))
    op.execute(sa.text('ALTER TABLE "patients" DISABLE ROW LEVEL SECURITY'))
    op.drop_index("ix_patients_email", table_name="patients")
    op.drop_index("ix_patients_phone_hash", table_name="patients")
    op.drop_index("ix_patients_dni", table_name="patients")
    op.drop_index("ix_patients_clinic_id", table_name="patients")
    op.drop_index("ix_patients_client_id", table_name="patients")
    op.drop_table("patients")
