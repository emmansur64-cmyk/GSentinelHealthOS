"""Add multi-resource calendars for doctor/room/equipment booking.

Revision ID: 20260402_0011
Revises: 20260402_0010
Create Date: 2026-04-02 23:55:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260402_0011"
down_revision = "20260402_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    if not inspector.has_table("resources"):
        op.create_table(
            "resources",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("type", sa.String(length=20), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("external_ref", sa.String(length=120), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("type IN ('doctor', 'room', 'equipment')", name="ck_resource_type_valid"),
            sa.UniqueConstraint("type", "external_ref", name="uq_resource_type_external_ref"),
        )
        op.create_index("idx_resources_type_active", "resources", ["type", "is_active"], unique=False)

    if not inspector.has_table("resource_slots"):
        op.create_table(
            "resource_slots",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("resource_id", sa.Integer(), nullable=False),
            sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
            sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="available"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["resource_id"], ["resources.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("resource_id", "start_time", name="uq_resource_slot"),
            sa.CheckConstraint("start_time < end_time", name="ck_resource_slot_time_range"),
            sa.CheckConstraint("status IN ('available', 'booked', 'blocked')", name="ck_resource_slot_status_valid"),
        )
        op.create_index("idx_resource_slots_resource_status", "resource_slots", ["resource_id", "status"], unique=False)
        op.create_index("idx_resource_slots_resource_time", "resource_slots", ["resource_id", "start_time"], unique=False)

    if not inspector.has_table("slot_resource_requirements"):
        op.create_table(
            "slot_resource_requirements",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("slot_id", sa.Integer(), nullable=False),
            sa.Column("resource_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["slot_id"], ["time_slots.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["resource_id"], ["resources.id"], ondelete="RESTRICT"),
            sa.UniqueConstraint("slot_id", "resource_id", name="uq_slot_required_resource"),
        )
        op.create_index("idx_slot_required_resources_slot", "slot_resource_requirements", ["slot_id"], unique=False)
        op.create_index("idx_slot_required_resources_resource", "slot_resource_requirements", ["resource_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_slot_required_resources_resource", table_name="slot_resource_requirements")
    op.drop_index("idx_slot_required_resources_slot", table_name="slot_resource_requirements")
    op.drop_table("slot_resource_requirements")

    op.drop_index("idx_resource_slots_resource_time", table_name="resource_slots")
    op.drop_index("idx_resource_slots_resource_status", table_name="resource_slots")
    op.drop_table("resource_slots")

    op.drop_index("idx_resources_type_active", table_name="resources")
    op.drop_table("resources")
