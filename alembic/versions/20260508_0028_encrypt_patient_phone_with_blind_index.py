"""encrypt patients.phone and add blind index phone_hash

Revision ID: 20260508_0028
Revises: 20260508_0027
Create Date: 2026-05-08 03:45:00
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from shared.security.secrets import (
    SecretEncryptionError,
    decrypt_secret,
    encrypt_secret,
    hash_phone,
    is_secret_encryption_key_configured,
    normalize_phone,
)


revision: str = "20260508_0028"
down_revision: Union[str, None] = "20260508_0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return inspector.has_table(table_name)


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    if not _has_table(inspector, table_name):
        return False
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _looks_encrypted(value: str) -> bool:
    return value.startswith("gAAAA")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_table(inspector, "patients"):
        return

    if not _has_column(inspector, "patients", "phone_hash"):
        op.add_column("patients", sa.Column("phone_hash", sa.String(length=64), nullable=True))

    if not is_secret_encryption_key_configured():
        raise RuntimeError("SECRET_ENCRYPTION_KEY no configurada; no se puede cifrar patients.phone")

    rows = bind.execute(sa.text("SELECT id, phone FROM patients WHERE phone IS NOT NULL AND phone <> ''")).fetchall()

    for row in rows:
        current_value = str(row.phone).strip()
        if not current_value:
            continue

        plain_phone = current_value
        if _looks_encrypted(current_value):
            try:
                plain_phone = decrypt_secret(current_value)
            except SecretEncryptionError:
                plain_phone = current_value

        normalized_phone = normalize_phone(plain_phone)
        encrypted_phone = encrypt_secret(normalized_phone)
        blind_index = hash_phone(normalized_phone)

        bind.execute(
            sa.text(
                """
                UPDATE patients
                SET phone = :phone,
                    phone_hash = :phone_hash
                WHERE id = :id
                """
            ),
            {
                "id": row.id,
                "phone": encrypted_phone,
                "phone_hash": blind_index,
            },
        )

    op.alter_column("patients", "phone", existing_type=sa.String(length=20), type_=sa.Text(), existing_nullable=False)
    op.execute(sa.text("DROP INDEX IF EXISTS ix_patients_phone"))
    op.execute(sa.text("ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_phone_key"))
    op.execute(sa.text("CREATE UNIQUE INDEX IF NOT EXISTS ix_patients_phone_hash ON patients (phone_hash)"))
    op.alter_column("patients", "phone_hash", existing_type=sa.String(length=64), nullable=False)


def downgrade() -> None:
    # No se revierte por seguridad: no es seguro restaurar datos sensibles en claro.
    pass
