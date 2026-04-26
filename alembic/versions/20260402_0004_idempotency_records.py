"""create idempotency_records table

Revision ID: 20260402_0004
Revises: 20260402_0003
Create Date: 2026-04-02 00:30:00
"""

from typing import Any, Sequence, Union, cast

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260402_0004"
down_revision: Union[str, None] = "20260402_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"
    uuid_type: object

    if is_postgres:
        uuid_type = postgresql.UUID(as_uuid=True)
    else:
        uuid_type = sa.String(length=36)

    op.create_table(
        "idempotency_records",
        sa.Column("id", cast(Any, uuid_type), primary_key=True, nullable=False),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("http_method", sa.String(length=16), nullable=False),
        sa.Column("request_path", sa.String(length=255), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("content_type", sa.String(length=120), nullable=True),
        sa.Column("response_body", sa.Text(), nullable=True),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint(
            "idempotency_key",
            "http_method",
            "request_path",
            name="uq_idempotency_key_method_path",
        ),
    )
    op.create_index("ix_idempotency_records_idempotency_key", "idempotency_records", ["idempotency_key"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_idempotency_records_idempotency_key", table_name="idempotency_records")
    op.drop_table("idempotency_records")
