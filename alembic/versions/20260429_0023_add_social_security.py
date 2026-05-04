"""Add social_security to patients and appointments

Revision ID: 20260429_0023
Revises: 20260429_0022
Create Date: 2026-04-29 20:00:00

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260429_0023"
down_revision: Union[str, None] = "20260429_0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table_name):
        return False
    return column_name in {col["name"] for col in inspector.get_columns(table_name)}


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if _has_table(table_name) and not _has_column(table_name, column.name):
        op.add_column(table_name, column)


def upgrade() -> None:
    _add_column_if_missing(
        "patients",
        sa.Column("social_security", sa.String(length=120), nullable=True),
    )
    _add_column_if_missing(
        "appointments",
        sa.Column("social_security", sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    if _has_table("appointments") and _has_column("appointments", "social_security"):
        op.drop_column("appointments", "social_security")
    if _has_table("patients") and _has_column("patients", "social_security"):
        op.drop_column("patients", "social_security")
