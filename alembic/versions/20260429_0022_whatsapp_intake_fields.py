"""whatsapp intake fields for patients and appointments

Revision ID: 20260429_0022
Revises: 20260429_0021
Create Date: 2026-04-29 18:00:00

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260429_0022"
down_revision: Union[str, None] = "20260429_0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table_name):
        return False
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table_name):
        return False
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if _has_table(table_name) and not _has_column(table_name, column.name):
        op.add_column(table_name, column)


def upgrade() -> None:
    _add_column_if_missing("patients", sa.Column("full_name", sa.String(length=255), nullable=True))
    _add_column_if_missing("patients", sa.Column("dni", sa.String(length=20), nullable=True))
    _add_column_if_missing("patients", sa.Column("age", sa.Integer(), nullable=True))

    if _has_table("patients") and not _has_index("patients", "ix_patients_dni"):
        op.create_index("ix_patients_dni", "patients", ["dni"], unique=False)

    _add_column_if_missing("appointments", sa.Column("specialty", sa.String(length=120), nullable=True))
    _add_column_if_missing("appointments", sa.Column("source", sa.String(length=50), nullable=True))
    _add_column_if_missing("appointments", sa.Column("whatsapp_conversation_id", sa.String(length=120), nullable=True))
    _add_column_if_missing("appointments", sa.Column("patient_full_name", sa.String(length=255), nullable=True))
    _add_column_if_missing("appointments", sa.Column("patient_dni", sa.String(length=20), nullable=True))
    _add_column_if_missing("appointments", sa.Column("patient_phone", sa.String(length=30), nullable=True))
    _add_column_if_missing("appointments", sa.Column("patient_email", sa.String(length=255), nullable=True))
    _add_column_if_missing("appointments", sa.Column("patient_age", sa.Integer(), nullable=True))

    if _has_table("appointments") and not _has_index("appointments", "ix_appointments_specialty"):
        op.create_index("ix_appointments_specialty", "appointments", ["specialty"], unique=False)
    if _has_table("appointments") and not _has_index("appointments", "ix_appointments_source"):
        op.create_index("ix_appointments_source", "appointments", ["source"], unique=False)
    if _has_table("appointments") and not _has_index("appointments", "ix_appointments_whatsapp_conversation_id"):
        op.create_index(
            "ix_appointments_whatsapp_conversation_id",
            "appointments",
            ["whatsapp_conversation_id"],
            unique=False,
        )


def downgrade() -> None:
    if _has_table("appointments") and _has_index("appointments", "ix_appointments_whatsapp_conversation_id"):
        op.drop_index("ix_appointments_whatsapp_conversation_id", table_name="appointments")
    if _has_table("appointments") and _has_index("appointments", "ix_appointments_source"):
        op.drop_index("ix_appointments_source", table_name="appointments")
    if _has_table("appointments") and _has_index("appointments", "ix_appointments_specialty"):
        op.drop_index("ix_appointments_specialty", table_name="appointments")

    for column_name in (
        "patient_age",
        "patient_email",
        "patient_phone",
        "patient_dni",
        "patient_full_name",
        "whatsapp_conversation_id",
        "source",
        "specialty",
    ):
        if _has_column("appointments", column_name):
            op.drop_column("appointments", column_name)

    if _has_table("patients") and _has_index("patients", "ix_patients_dni"):
        op.drop_index("ix_patients_dni", table_name="patients")

    for column_name in ("age", "dni", "full_name"):
        if _has_column("patients", column_name):
            op.drop_column("patients", column_name)
