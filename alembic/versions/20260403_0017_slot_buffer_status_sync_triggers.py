"""Add triggers to keep time_slots.status synchronized with slot_buffer_blocks.

Revision ID: 20260403_0017
Revises: 20260403_0016
Create Date: 2026-04-03 13:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260403_0017"
down_revision: Union[str, None] = "20260403_0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _backfill_slot_status_truth() -> None:
    op.execute(
        """
                UPDATE time_slots
        SET status = 'blocked'
                WHERE status <> 'booked'
          AND EXISTS (
            SELECT 1
            FROM slot_buffer_blocks sbb
                        WHERE sbb.blocked_slot_id = time_slots.id
          )
        """
    )
    op.execute(
        """
                UPDATE time_slots
        SET status = 'available'
                WHERE status = 'blocked'
          AND NOT EXISTS (
            SELECT 1
            FROM slot_buffer_blocks sbb
                        WHERE sbb.blocked_slot_id = time_slots.id
          )
        """
    )


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    inspector = sa.inspect(bind)

    _backfill_slot_status_truth()

    if dialect == "postgresql":
        op.execute(
            """
            CREATE OR REPLACE FUNCTION sync_time_slot_status_from_buffer_block(p_slot_id integer)
            RETURNS void
            LANGUAGE plpgsql
            AS $$
            BEGIN
                UPDATE time_slots ts
                SET status = CASE
                    WHEN ts.status = 'booked' THEN 'booked'
                    WHEN EXISTS (
                        SELECT 1
                        FROM slot_buffer_blocks sbb
                        WHERE sbb.blocked_slot_id = ts.id
                    ) THEN 'blocked'
                    ELSE 'available'
                END
                WHERE ts.id = p_slot_id;
            END;
            $$
            """
        )

        op.execute(
            """
            CREATE OR REPLACE FUNCTION trg_slot_buffer_blocks_ai_sync()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            BEGIN
                PERFORM sync_time_slot_status_from_buffer_block(NEW.blocked_slot_id);
                RETURN NEW;
            END;
            $$
            """
        )
        op.execute(
            """
            CREATE OR REPLACE FUNCTION trg_slot_buffer_blocks_ad_sync()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            BEGIN
                PERFORM sync_time_slot_status_from_buffer_block(OLD.blocked_slot_id);
                RETURN OLD;
            END;
            $$
            """
        )

        op.execute(
            """
            DROP TRIGGER IF EXISTS slot_buffer_blocks_ai_sync ON slot_buffer_blocks
            """
        )
        op.execute(
            """
            CREATE TRIGGER slot_buffer_blocks_ai_sync
            AFTER INSERT ON slot_buffer_blocks
            FOR EACH ROW
            EXECUTE FUNCTION trg_slot_buffer_blocks_ai_sync()
            """
        )
        op.execute(
            """
            DROP TRIGGER IF EXISTS slot_buffer_blocks_ad_sync ON slot_buffer_blocks
            """
        )
        op.execute(
            """
            CREATE TRIGGER slot_buffer_blocks_ad_sync
            AFTER DELETE ON slot_buffer_blocks
            FOR EACH ROW
            EXECUTE FUNCTION trg_slot_buffer_blocks_ad_sync()
            """
        )
        return

    if dialect == "sqlite":
        op.execute(
            """
            DROP TRIGGER IF EXISTS slot_buffer_blocks_ai_sync
            """
        )
        op.execute(
            """
            CREATE TRIGGER slot_buffer_blocks_ai_sync
            AFTER INSERT ON slot_buffer_blocks
            FOR EACH ROW
            BEGIN
                UPDATE time_slots
                SET status = CASE
                    WHEN status = 'booked' THEN 'booked'
                    WHEN EXISTS (
                        SELECT 1 FROM slot_buffer_blocks sbb
                        WHERE sbb.blocked_slot_id = NEW.blocked_slot_id
                    ) THEN 'blocked'
                    ELSE 'available'
                END
                WHERE id = NEW.blocked_slot_id;
            END;
            """
        )
        op.execute(
            """
            DROP TRIGGER IF EXISTS slot_buffer_blocks_ad_sync
            """
        )
        op.execute(
            """
            CREATE TRIGGER slot_buffer_blocks_ad_sync
            AFTER DELETE ON slot_buffer_blocks
            FOR EACH ROW
            BEGIN
                UPDATE time_slots
                SET status = CASE
                    WHEN status = 'booked' THEN 'booked'
                    WHEN EXISTS (
                        SELECT 1 FROM slot_buffer_blocks sbb
                        WHERE sbb.blocked_slot_id = OLD.blocked_slot_id
                    ) THEN 'blocked'
                    ELSE 'available'
                END
                WHERE id = OLD.blocked_slot_id;
            END;
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS slot_buffer_blocks_ai_sync ON slot_buffer_blocks")
        op.execute("DROP TRIGGER IF EXISTS slot_buffer_blocks_ad_sync ON slot_buffer_blocks")
        op.execute("DROP FUNCTION IF EXISTS trg_slot_buffer_blocks_ai_sync()")
        op.execute("DROP FUNCTION IF EXISTS trg_slot_buffer_blocks_ad_sync()")
        op.execute("DROP FUNCTION IF EXISTS sync_time_slot_status_from_buffer_block(integer)")
        return

    if dialect == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS slot_buffer_blocks_ai_sync")
        op.execute("DROP TRIGGER IF EXISTS slot_buffer_blocks_ad_sync")