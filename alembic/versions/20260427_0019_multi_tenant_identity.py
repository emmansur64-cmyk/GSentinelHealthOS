"""multi tenant identity foundation

Revision ID: 20260427_0019
Revises: 20260404_0018
Create Date: 2026-04-27 00:00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260427_0019"
down_revision: Union[str, None] = "20260404_0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _uuid_type() -> sa.types.TypeEngine:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        return postgresql.UUID(as_uuid=True)
    return sa.String(length=36)


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table_name):
        return False
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _add_user_column_if_missing(column: sa.Column) -> None:
    if not _has_column("users", column.name):
        op.add_column("users", column)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    uuid_type = _uuid_type()

    if not inspector.has_table("clinics"):
        op.create_table(
            "clinics",
            sa.Column("id", uuid_type, primary_key=True, nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("legal_name", sa.String(length=180), nullable=True),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )

    if inspector.has_table("users"):
        _add_user_column_if_missing(sa.Column("email", sa.String(length=255), nullable=True))
        _add_user_column_if_missing(sa.Column("name", sa.String(length=120), nullable=True))
        _add_user_column_if_missing(
            sa.Column("auth_provider", sa.String(length=50), nullable=False, server_default="password")
        )
        _add_user_column_if_missing(sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()))
        _add_user_column_if_missing(
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP"))
        )
        _add_user_column_if_missing(
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP"))
        )

        if not any(index["name"] == "ix_users_email" for index in inspector.get_indexes("users")):
            op.create_index("ix_users_email", "users", ["email"], unique=False)

    if not inspector.has_table("clinic_members"):
        op.create_table(
            "clinic_members",
            sa.Column("id", uuid_type, primary_key=True, nullable=False),
            sa.Column("clinic_id", uuid_type, nullable=False),
            sa.Column("user_id", uuid_type, nullable=False),
            sa.Column("role", sa.String(length=32), nullable=False),
            sa.Column("approved", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("clinic_id", "user_id", name="uq_clinic_members_clinic_user"),
            sa.CheckConstraint(
                "role IN ('SUPER_ADMIN', 'CLINIC_ADMIN', 'SECRETARY', 'DOCTOR')",
                name="ck_clinic_members_role_valid",
            ),
        )
        op.create_index("ix_clinic_members_clinic_id", "clinic_members", ["clinic_id"], unique=False)
        op.create_index("ix_clinic_members_user_id", "clinic_members", ["user_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("clinic_members"):
        op.drop_index("ix_clinic_members_user_id", table_name="clinic_members")
        op.drop_index("ix_clinic_members_clinic_id", table_name="clinic_members")
        op.drop_table("clinic_members")

    if inspector.has_table("users"):
        with op.batch_alter_table("users") as batch_op:
            for column_name in ("updated_at", "created_at", "active", "auth_provider", "name", "email"):
                if _has_column("users", column_name):
                    batch_op.drop_column(column_name)

    if inspector.has_table("clinics"):
        op.drop_table("clinics")
