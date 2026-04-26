"""Add appointment priority, slot priority override and reassignment audit.

Revision ID: 20260402_0006
Revises: 20260402_0005
Create Date: 2026-04-02 18:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260402_0006"
down_revision = "20260402_0005"
branch_labels = None
depends_on = None


def _is_postgresql() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Create or skip doctor_schedule_config table
    if not inspector.has_table("doctor_schedule_config"):
        if _is_postgresql():
            op.execute(
                """
                CREATE TABLE doctor_schedule_config (
                    id SERIAL PRIMARY KEY,
                    doctor_id INTEGER NOT NULL UNIQUE,
                    buffer_minutes INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT fk_doctor_schedule_config_doctor
                        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
                    CONSTRAINT ck_buffer_minutes_range
                        CHECK (buffer_minutes >= 0 AND buffer_minutes <= 120)
                )
                """
            )
            op.execute(
                """
                CREATE INDEX idx_doctor_schedule_config_doctor
                ON doctor_schedule_config (doctor_id)
                """
            )
        else:
            op.create_table(
                "doctor_schedule_config",
                sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
                sa.Column("doctor_id", sa.Integer(), nullable=False, unique=True),
                sa.Column("buffer_minutes", sa.Integer(), nullable=False, server_default="0"),
                sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
                sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
                sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
                sa.CheckConstraint("buffer_minutes >= 0 AND buffer_minutes <= 120", name="ck_buffer_minutes_range"),
            )
            op.create_index("idx_doctor_schedule_config_doctor", "doctor_schedule_config", ["doctor_id"], unique=False)

    # Add appointment.priority column
    apt_columns = {col["name"] for col in inspector.get_columns("appointments")}
    if "priority" not in apt_columns:
        op.add_column(
            "appointments",
            sa.Column("priority", sa.String(length=20), nullable=False, server_default="normal"),
        )
        apt_indexes = {idx["name"] for idx in inspector.get_indexes("appointments")}
        if "idx_appointment_priority" not in apt_indexes:
            op.create_index("idx_appointment_priority", "appointments", ["priority"])
        if _is_postgresql():
            op.create_check_constraint(
                "ck_appointment_priority_valid",
                "appointments",
                "priority IN ('normal', 'urgent')",
            )

    # Add time_slots.priority_override column
    slots_columns = {col["name"] for col in inspector.get_columns("time_slots")}
    if "priority_override" not in slots_columns:
        op.add_column(
            "time_slots",
            sa.Column("priority_override", sa.String(length=20), nullable=True),
        )
        if _is_postgresql():
            op.create_check_constraint(
                "ck_slot_priority_override_valid",
                "time_slots",
                "priority_override IS NULL OR priority_override IN ('normal', 'urgent')",
            )

    # Create appointment_reassignment_audit table
    if not inspector.has_table("appointment_reassignment_audit"):
        op.create_table(
            "appointment_reassignment_audit",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("doctor_id", sa.Integer(), nullable=False),
            sa.Column("displaced_appointment_id", sa.Integer(), nullable=False),
            sa.Column("urgent_appointment_id", sa.Integer(), nullable=False),
            sa.Column("old_slot_id", sa.Integer(), nullable=False),
            sa.Column("new_slot_id", sa.Integer(), nullable=False),
            sa.Column("displaced_by_user_id", sa.Integer(), nullable=True),
            sa.Column("reason", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["displaced_appointment_id"], ["appointments.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["urgent_appointment_id"], ["appointments.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["old_slot_id"], ["time_slots.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["new_slot_id"], ["time_slots.id"], ondelete="RESTRICT"),
        )

        op.create_index(
            "idx_reassign_audit_doctor_created",
            "appointment_reassignment_audit",
            ["doctor_id", "created_at"],
        )
        op.create_index(
            "idx_reassign_audit_displaced_appt",
            "appointment_reassignment_audit",
            ["displaced_appointment_id"],
        )
        op.create_index(
            "idx_reassign_audit_urgent_appt",
            "appointment_reassignment_audit",
            ["urgent_appointment_id"],
        )


def downgrade() -> None:
    op.drop_index("idx_reassign_audit_urgent_appt", table_name="appointment_reassignment_audit")
    op.drop_index("idx_reassign_audit_displaced_appt", table_name="appointment_reassignment_audit")
    op.drop_index("idx_reassign_audit_doctor_created", table_name="appointment_reassignment_audit")
    op.drop_table("appointment_reassignment_audit")

    if _is_postgresql():
        op.drop_constraint("ck_slot_priority_override_valid", "time_slots", type_="check")
    op.drop_column("time_slots", "priority_override")

    if _is_postgresql():
        op.drop_constraint("ck_appointment_priority_valid", "appointments", type_="check")
    op.drop_index("idx_appointment_priority", table_name="appointments")
    op.drop_column("appointments", "priority")

    if _is_postgresql():
        op.execute("DROP INDEX IF EXISTS idx_doctor_schedule_config_doctor")
        op.execute("ALTER TABLE doctor_schedule_config DROP CONSTRAINT IF EXISTS ck_buffer_minutes_range")
        op.execute("ALTER TABLE doctor_schedule_config DROP COLUMN IF EXISTS buffer_minutes")
    else:
        op.drop_index("idx_doctor_schedule_config_doctor", table_name="doctor_schedule_config")
        op.drop_table("doctor_schedule_config")
