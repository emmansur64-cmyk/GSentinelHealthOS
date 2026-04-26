"""create eventing outbox_events and processed_events tables

Revision ID: 20260404_0018
Revises: 20260403_0017
Create Date: 2026-04-04 09:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260404_0018"
down_revision: Union[str, None] = "20260403_0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        event_id_type = postgresql.UUID(as_uuid=False)
        payload_type = postgresql.JSONB(astext_type=sa.Text())
        ts_type = postgresql.TIMESTAMP(timezone=True)
    else:
        event_id_type = sa.String(length=36)
        payload_type = sa.JSON()
        ts_type = sa.DateTime()

    if not inspector.has_table("outbox_events"):
        op.create_table(
            "outbox_events",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("event_id", event_id_type, nullable=False),
            sa.Column("event_type", sa.String(length=100), nullable=False),
            sa.Column("routing_key", sa.String(length=150), nullable=False),
            sa.Column("aggregate_type", sa.String(length=80), nullable=False),
            sa.Column("aggregate_id", sa.String(length=120), nullable=False),
            sa.Column("payload", payload_type, nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("max_retries", sa.Integer(), nullable=False, server_default="8"),
            sa.Column("next_attempt_at", ts_type, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("published_at", ts_type, nullable=True),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column("created_at", ts_type, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", ts_type, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.UniqueConstraint("event_id", name="uq_outbox_events_event_id"),
            sa.CheckConstraint("status IN ('pending', 'published', 'dead')", name="ck_outbox_events_status_valid"),
            sa.CheckConstraint("attempts >= 0", name="ck_outbox_events_attempts_non_negative"),
            sa.CheckConstraint("max_retries >= 1", name="ck_outbox_events_max_retries_min"),
        )

        if is_postgres:
            op.create_index(
                "idx_outbox_pending_scan",
                "outbox_events",
                ["status", "next_attempt_at", "created_at"],
                unique=False,
                postgresql_where=sa.text("status = 'pending'"),
            )
        else:
            op.create_index(
                "idx_outbox_pending_scan",
                "outbox_events",
                ["status", "next_attempt_at", "created_at"],
                unique=False,
            )

        op.create_index(
            "idx_outbox_aggregate",
            "outbox_events",
            ["aggregate_type", "aggregate_id", "created_at"],
            unique=False,
        )
        op.create_index(
            "idx_outbox_event_type",
            "outbox_events",
            ["event_type", "created_at"],
            unique=False,
        )

    if not inspector.has_table("processed_events"):
        op.create_table(
            "processed_events",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("consumer_name", sa.String(length=120), nullable=False),
            sa.Column("event_id", event_id_type, nullable=False),
            sa.Column("processed_at", ts_type, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.UniqueConstraint("consumer_name", "event_id", name="uq_processed_events_consumer_event"),
        )

        op.create_index(
            "idx_processed_events_lookup",
            "processed_events",
            ["consumer_name", "processed_at"],
            unique=False,
        )

    if is_postgres and inspector.has_table("outbox_events"):
        op.execute(
            """
            CREATE OR REPLACE FUNCTION set_outbox_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = now();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            """
        )
        op.execute("DROP TRIGGER IF EXISTS trg_outbox_updated_at ON outbox_events;")
        op.execute(
            """
            CREATE TRIGGER trg_outbox_updated_at
            BEFORE UPDATE ON outbox_events
            FOR EACH ROW
            EXECUTE FUNCTION set_outbox_updated_at();
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_postgres = bind.dialect.name == "postgresql"

    if inspector.has_table("processed_events"):
        op.drop_index("idx_processed_events_lookup", table_name="processed_events")
        op.drop_table("processed_events")

    if inspector.has_table("outbox_events"):
        if is_postgres:
            op.execute("DROP TRIGGER IF EXISTS trg_outbox_updated_at ON outbox_events;")
            op.execute("DROP FUNCTION IF EXISTS set_outbox_updated_at();")

        op.drop_index("idx_outbox_event_type", table_name="outbox_events")
        op.drop_index("idx_outbox_aggregate", table_name="outbox_events")
        op.drop_index("idx_outbox_pending_scan", table_name="outbox_events")
        op.drop_table("outbox_events")
