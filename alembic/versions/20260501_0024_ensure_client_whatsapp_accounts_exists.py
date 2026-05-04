"""ensure client_whatsapp_accounts exists and has required columns

Revision ID: 20260501_0024
Revises: 20260429_0023
Create Date: 2026-05-01 11:30:00

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260501_0024"
down_revision: Union[str, None] = "20260429_0023"
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
    uuid_type = _uuid_type()

    if not _has_table(table_name):
        op.create_table(
            table_name,
            sa.Column("id", uuid_type, primary_key=True, nullable=False),
            sa.Column("client_id", uuid_type, nullable=False),
            sa.Column("clinic_id", uuid_type, nullable=True),
            sa.Column("provider", sa.String(length=32), nullable=False, server_default="meta"),
            sa.Column("phone_number", sa.String(length=32), nullable=True),
            sa.Column("phone_number_id", sa.String(length=80), nullable=False),
            sa.Column("business_account_id", sa.String(length=80), nullable=True),
            sa.Column("meta_business_id", sa.String(length=80), nullable=True),
            sa.Column("waba_id", sa.String(length=80), nullable=True),
            sa.Column("display_phone_number", sa.String(length=32), nullable=True),
            sa.Column("access_token_encrypted", sa.Text(), nullable=True),
            sa.Column("app_secret_encrypted", sa.Text(), nullable=True),
            sa.Column("verify_token", sa.String(length=255), nullable=True),
            sa.Column("webhook_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("phone_number_id", name="uq_client_whatsapp_phone_number_id"),
        )

    _add_column_if_missing(table_name, sa.Column("clinic_id", uuid_type, nullable=True))
    _add_column_if_missing(table_name, sa.Column("meta_business_id", sa.String(length=80), nullable=True))
    _add_column_if_missing(table_name, sa.Column("waba_id", sa.String(length=80), nullable=True))
    _add_column_if_missing(table_name, sa.Column("display_phone_number", sa.String(length=32), nullable=True))
    _add_column_if_missing(table_name, sa.Column("access_token_encrypted", sa.Text(), nullable=True))
    _add_column_if_missing(table_name, sa.Column("app_secret_encrypted", sa.Text(), nullable=True))

    if not _has_index(table_name, "ix_client_whatsapp_accounts_client_id"):
        op.create_index("ix_client_whatsapp_accounts_client_id", table_name, ["client_id"], unique=False)
    if not _has_index(table_name, "ix_client_whatsapp_accounts_clinic_id"):
        op.create_index("ix_client_whatsapp_accounts_clinic_id", table_name, ["clinic_id"], unique=False)
    if not _has_index(table_name, "ix_client_whatsapp_accounts_phone_number_id"):
        op.create_index("ix_client_whatsapp_accounts_phone_number_id", table_name, ["phone_number_id"], unique=False)
    if not _has_index(table_name, "ix_client_whatsapp_accounts_status"):
        op.create_index("ix_client_whatsapp_accounts_status", table_name, ["status"], unique=False)
    if not _has_index(table_name, "ix_client_whatsapp_accounts_waba_id"):
        op.create_index("ix_client_whatsapp_accounts_waba_id", table_name, ["waba_id"], unique=False)


def downgrade() -> None:
    # Migración de reparación: no se elimina tabla para evitar pérdida de credenciales.
    return None
