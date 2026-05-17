"""ensure bot_knowledge_base.updated_at exists

Revision ID: 20260516_0031
Revises: 20260516_0021
Create Date: 2026-05-16 19:33:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260516_0031"
down_revision = "20260516_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE bot_knowledge_base
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        """
    )
    op.execute(
        """
        UPDATE bot_knowledge_base
        SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
        WHERE updated_at IS NULL
        """
    )


def downgrade() -> None:
    # Columna requerida por runtime actual; no se elimina en downgrade para evitar drift.
    pass

