"""embedded signup clinic whatsapp metadata

Revision ID: 20260429_0021
Revises: 20260427_0020_clinic
Create Date: 2026-04-29 12:00:00

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260429_0021"
down_revision: Union[str, None] = "20260427_0020_clinic"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _uuid_type() -> sa.types.TypeEngine:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        return postgresql.UUID(as_uuid=True)
    return sa.String(length=36)


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
    table_name = "client_whatsapp_accounts"
    if not _has_table(table_name):
        return

    _add_column_if_missing(table_name, sa.Column("clinic_id", _uuid_type(), nullable=True))
    _add_column_if_missing(table_name, sa.Column("meta_business_id", sa.String(length=80), nullable=True))
    _add_column_if_missing(table_name, sa.Column("waba_id", sa.String(length=80), nullable=True))
    _add_column_if_missing(table_name, sa.Column("display_phone_number", sa.String(length=32), nullable=True))

    if not _has_index(table_name, "ix_client_whatsapp_accounts_clinic_id"):
        op.create_index("ix_client_whatsapp_accounts_clinic_id", table_name, ["clinic_id"], unique=False)
    if not _has_index(table_name, "ix_client_whatsapp_accounts_waba_id"):
        op.create_index("ix_client_whatsapp_accounts_waba_id", table_name, ["waba_id"], unique=False)


def downgrade() -> None:
    table_name = "client_whatsapp_accounts"
    if not _has_table(table_name):
        return

    for index_name in ("ix_client_whatsapp_accounts_waba_id", "ix_client_whatsapp_accounts_clinic_id"):
        if _has_index(table_name, index_name):
            op.drop_index(index_name, table_name=table_name)

    for column_name in ("display_phone_number", "waba_id", "meta_business_id", "clinic_id"):
        if _has_column(table_name, column_name):
            op.drop_column(table_name, column_name)
