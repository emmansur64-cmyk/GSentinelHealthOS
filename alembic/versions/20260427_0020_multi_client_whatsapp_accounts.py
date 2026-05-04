"""multi client whatsapp accounts

Revision ID: 20260427_0020
Revises: 20260427_0019
Create Date: 2026-04-27 10:00:00

"""

from __future__ import annotations

from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260427_0020"
down_revision: Union[str, None] = "20260427_0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _uuid_type() -> sa.types.TypeEngine:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        return postgresql.UUID(as_uuid=True)
    return sa.String(length=36)


def _has_table(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return inspector.has_table(table_name)


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


def _ensure_legacy_client() -> str:
    bind = op.get_bind()
    slug = "legacy"

    row = bind.execute(
        sa.text("SELECT id FROM clients WHERE slug = :slug LIMIT 1"),
        {"slug": slug},
    ).first()
    if row is not None:
        return str(row[0])

    legacy_client_id = str(uuid4())
    bind.execute(
        sa.text(
            """
            INSERT INTO clients (id, name, slug, status, created_at, updated_at)
            VALUES (:id, :name, :slug, :status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """
        ),
        {
            "id": legacy_client_id,
            "name": "Legacy Single Tenant",
            "slug": slug,
            "status": "active",
        },
    )
    return legacy_client_id


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if _has_table(table_name) and not _has_column(table_name, column.name):
        op.add_column(table_name, column)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    uuid_type = _uuid_type()

    if not inspector.has_table("clients"):
        op.create_table(
            "clients",
            sa.Column("id", uuid_type, primary_key=True, nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("slug", sa.String(length=120), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.UniqueConstraint("slug", name="uq_clients_slug"),
        )

    if not _has_index("clients", "ix_clients_slug"):
        op.create_index("ix_clients_slug", "clients", ["slug"], unique=True)
    if not _has_index("clients", "ix_clients_status"):
        op.create_index("ix_clients_status", "clients", ["status"], unique=False)

    legacy_client_id = _ensure_legacy_client()

    if not inspector.has_table("client_whatsapp_accounts"):
        op.create_table(
            "client_whatsapp_accounts",
            sa.Column("id", uuid_type, primary_key=True, nullable=False),
            sa.Column("client_id", uuid_type, nullable=False),
            sa.Column("provider", sa.String(length=32), nullable=False, server_default="meta"),
            sa.Column("phone_number", sa.String(length=32), nullable=True),
            sa.Column("phone_number_id", sa.String(length=80), nullable=False),
            sa.Column("business_account_id", sa.String(length=80), nullable=True),
            sa.Column("access_token_encrypted", sa.Text(), nullable=True),
            sa.Column("app_secret_encrypted", sa.Text(), nullable=True),
            sa.Column("verify_token", sa.String(length=255), nullable=True),
            sa.Column("webhook_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("phone_number_id", name="uq_client_whatsapp_phone_number_id"),
        )

    if not _has_index("client_whatsapp_accounts", "ix_client_whatsapp_accounts_client_id"):
        op.create_index(
            "ix_client_whatsapp_accounts_client_id",
            "client_whatsapp_accounts",
            ["client_id"],
            unique=False,
        )
    if not _has_index("client_whatsapp_accounts", "ix_client_whatsapp_accounts_phone_number_id"):
        op.create_index(
            "ix_client_whatsapp_accounts_phone_number_id",
            "client_whatsapp_accounts",
            ["phone_number_id"],
            unique=False,
        )
    if not _has_index("client_whatsapp_accounts", "ix_client_whatsapp_accounts_status"):
        op.create_index(
            "ix_client_whatsapp_accounts_status",
            "client_whatsapp_accounts",
            ["status"],
            unique=False,
        )

    # Campos multi-tenant en tablas existentes (incremental, sin destruir datos).
    _add_column_if_missing("clinics", sa.Column("client_id", uuid_type, nullable=True))
    _add_column_if_missing("clinics", sa.Column("timezone", sa.String(length=64), nullable=True))
    _add_column_if_missing("clinics", sa.Column("status", sa.String(length=20), nullable=True))

    _add_column_if_missing("users", sa.Column("client_id", uuid_type, nullable=True))
    _add_column_if_missing("users", sa.Column("clinic_id", uuid_type, nullable=True))
    _add_column_if_missing("users", sa.Column("status", sa.String(length=20), nullable=True))

    _add_column_if_missing("doctors", sa.Column("client_id", uuid_type, nullable=True))
    _add_column_if_missing("doctors", sa.Column("clinic_id", uuid_type, nullable=True))
    _add_column_if_missing("doctors", sa.Column("status", sa.String(length=20), nullable=True))

    _add_column_if_missing("patients", sa.Column("client_id", uuid_type, nullable=True))
    _add_column_if_missing("patients", sa.Column("clinic_id", uuid_type, nullable=True))

    _add_column_if_missing("appointments", sa.Column("client_id", uuid_type, nullable=True))
    _add_column_if_missing("appointments", sa.Column("clinic_id", uuid_type, nullable=True))

    _add_column_if_missing("notification_outbox", sa.Column("client_id", uuid_type, nullable=True))
    _add_column_if_missing("google_outbox", sa.Column("client_id", uuid_type, nullable=True))
    _add_column_if_missing("bot_knowledge_base", sa.Column("client_id", uuid_type, nullable=True))

    for table_name in (
        "clinics",
        "users",
        "doctors",
        "patients",
        "appointments",
        "notification_outbox",
        "google_outbox",
        "bot_knowledge_base",
    ):
        if _has_column(table_name, "client_id"):
            bind.execute(
                sa.text(f"UPDATE {table_name} SET client_id = :legacy_client_id WHERE client_id IS NULL"),
                {"legacy_client_id": legacy_client_id},
            )

    if _has_column("clinics", "timezone"):
        bind.execute(sa.text("UPDATE clinics SET timezone = 'UTC' WHERE timezone IS NULL"))
    if _has_column("clinics", "status"):
        bind.execute(sa.text("UPDATE clinics SET status = 'active' WHERE status IS NULL"))
    if _has_column("users", "status"):
        bind.execute(sa.text("UPDATE users SET status = 'active' WHERE status IS NULL"))
    if _has_column("doctors", "status"):
        bind.execute(sa.text("UPDATE doctors SET status = 'active' WHERE status IS NULL"))

    # Indices tenant-aware para consultas por agenda/paciente/doctor.
    if _has_column("patients", "client_id") and not _has_index("patients", "ix_patients_client_id"):
        op.create_index("ix_patients_client_id", "patients", ["client_id"], unique=False)
    if _has_column("doctors", "client_id") and not _has_index("doctors", "ix_doctors_client_id"):
        op.create_index("ix_doctors_client_id", "doctors", ["client_id"], unique=False)
    if _has_column("appointments", "client_id") and not _has_index("appointments", "ix_appointments_client_id"):
        op.create_index("ix_appointments_client_id", "appointments", ["client_id"], unique=False)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if inspector.has_table("client_whatsapp_accounts"):
        for index_name in (
            "ix_client_whatsapp_accounts_status",
            "ix_client_whatsapp_accounts_phone_number_id",
            "ix_client_whatsapp_accounts_client_id",
        ):
            if _has_index("client_whatsapp_accounts", index_name):
                op.drop_index(index_name, table_name="client_whatsapp_accounts")
        op.drop_table("client_whatsapp_accounts")

    # Nota: no se eliminan columnas client_id agregadas en tablas productivas para evitar pérdida de datos.
    if inspector.has_table("clients"):
        if _has_index("clients", "ix_clients_status"):
            op.drop_index("ix_clients_status", table_name="clients")
        if _has_index("clients", "ix_clients_slug"):
            op.drop_index("ix_clients_slug", table_name="clients")
        op.drop_table("clients")
