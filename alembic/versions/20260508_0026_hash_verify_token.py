"""hash verify_token values at rest

Revision ID: 20260508_0026
Revises: 20260508_0025
Create Date: 2026-05-08 02:26:00
"""

from __future__ import annotations

from typing import Sequence, Union
import hashlib

from alembic import op
import sqlalchemy as sa


revision: str = "20260508_0026"
down_revision: Union[str, None] = "20260508_0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("client_whatsapp_accounts"):
        return

    rows = bind.execute(
        sa.text(
            "SELECT id, verify_token FROM client_whatsapp_accounts WHERE verify_token IS NOT NULL AND verify_token <> ''"
        )
    ).fetchall()

    for row in rows:
        verify_token = str(row.verify_token).strip()
        if not verify_token:
            continue
        bind.execute(
            sa.text("UPDATE client_whatsapp_accounts SET verify_token = :verify_token WHERE id = :id"),
            {"verify_token": _sha256_hex(verify_token), "id": row.id},
        )


def downgrade() -> None:
    # No es seguro revertir hashes a valores en claro.
    pass