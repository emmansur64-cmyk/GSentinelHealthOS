"""Add slot_buffer_blocks provenance table for buffer ownership.

Revision ID: 20260403_0016
Revises: 20260402_0015
Create Date: 2026-04-03 11:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260403_0016"
down_revision: Union[str, None] = "20260402_0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    if not inspector.has_table("slot_buffer_blocks"):
        op.create_table(
            "slot_buffer_blocks",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("source_slot_id", sa.Integer(), nullable=False),
            sa.Column("blocked_slot_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["source_slot_id"], ["time_slots.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["blocked_slot_id"], ["time_slots.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("source_slot_id", "blocked_slot_id", name="uq_slot_buffer_block_pair"),
            sa.CheckConstraint("source_slot_id <> blocked_slot_id", name="ck_slot_buffer_block_not_self"),
        )
        op.create_index("ix_slot_buffer_blocks_source_slot_id", "slot_buffer_blocks", ["source_slot_id"], unique=False)
        op.create_index("ix_slot_buffer_blocks_blocked_slot_id", "slot_buffer_blocks", ["blocked_slot_id"], unique=False)
        op.create_index("idx_slot_buffer_blocks_blocked_slot", "slot_buffer_blocks", ["blocked_slot_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_slot_buffer_blocks_blocked_slot", table_name="slot_buffer_blocks")
    op.drop_index("ix_slot_buffer_blocks_blocked_slot_id", table_name="slot_buffer_blocks")
    op.drop_index("ix_slot_buffer_blocks_source_slot_id", table_name="slot_buffer_blocks")
    op.drop_table("slot_buffer_blocks")