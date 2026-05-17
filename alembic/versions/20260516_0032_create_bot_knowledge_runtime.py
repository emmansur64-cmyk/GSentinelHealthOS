"""create bot_knowledge_runtime table for stable learning persistence

Revision ID: 20260516_0032
Revises: 20260516_0031
Create Date: 2026-05-16 19:36:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260516_0032"
down_revision = "20260516_0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bot_knowledge_runtime",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pattern", sa.String(length=200), nullable=False),
        sa.Column("correct_action", sa.String(length=500), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id", name="pk_bot_knowledge_runtime"),
    )
    op.create_index("ix_bot_knowledge_runtime_doctor_id", "bot_knowledge_runtime", ["doctor_id"], unique=False)
    op.create_index("ix_bot_knowledge_runtime_category", "bot_knowledge_runtime", ["category"], unique=False)
    op.create_index(
        "uq_bot_knowledge_runtime_doctor_pattern",
        "bot_knowledge_runtime",
        ["doctor_id", "pattern"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_bot_knowledge_runtime_doctor_pattern", table_name="bot_knowledge_runtime")
    op.drop_index("ix_bot_knowledge_runtime_category", table_name="bot_knowledge_runtime")
    op.drop_index("ix_bot_knowledge_runtime_doctor_id", table_name="bot_knowledge_runtime")
    op.drop_table("bot_knowledge_runtime")

