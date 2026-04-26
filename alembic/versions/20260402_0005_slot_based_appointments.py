"""Final slot-based appointment model - Simple and atomic.

Revision ID: 20260402_0005
Revises: 20260402_0004
Create Date: 2026-04-02 12:00:00.000000

Core principle: Separation of concerns
- time_slots: availability (status: available, booked, blocked)
- appointments: reservations (1-to-1 unique link to slots)

Atomicity via UPDATE without SELECT (no race conditions).
"""
from alembic import op
import sqlalchemy as sa

revision = '20260402_0005'
down_revision = '20260402_0004'
branch_labels = None
depends_on = None


def _is_postgresql() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table('time_slots') and inspector.has_table('appointments'):
        # Esquema ya existente en instalaciones previas.
        return

    # ============================================================================
    # TABLE 1: time_slots - Pure availability representation
    # ============================================================================
    op.create_table(
        'time_slots',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('doctor_id', sa.Integer(), nullable=False, index=True),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.VARCHAR(20), nullable=False, server_default='available'),
        # Status values: 'available', 'booked', 'blocked'
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        
        # Constraint 1: Only one slot per doctor per time
        sa.UniqueConstraint('doctor_id', 'start_time', name='uq_doctor_slot'),
        
        # Foreign key to doctors table
        sa.ForeignKeyConstraint(['doctor_id'], ['doctors.id'], ondelete='CASCADE', name='fk_slots_doctor'),
        
        # Indexes for fast queries
        sa.Index('idx_slots_doctor_status', 'doctor_id', 'status'),
        sa.Index('idx_slots_doctor_time', 'doctor_id', 'start_time'),
    )

    # ============================================================================
    # TABLE 2: appointments - Reservations linked to slots (1-to-1)
    # ============================================================================
    op.create_table(
        'appointments',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('slot_id', sa.Integer(), nullable=False),
        sa.Column('patient_id', sa.Integer(), nullable=False, index=True),
        sa.Column('status', sa.VARCHAR(20), nullable=False, server_default='scheduled'),
        # Status values: 'scheduled', 'completed', 'cancelled', 'no_show'
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        
        # Constraint 2: ONE appointment per slot (critical!)
        sa.UniqueConstraint('slot_id', name='uq_appointment_per_slot'),
        
        # Foreign key to time_slots
        sa.ForeignKeyConstraint(['slot_id'], ['time_slots.id'], ondelete='RESTRICT', name='fk_appt_slot'),
        
        # Foreign key to patients table
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE', name='fk_appt_patient'),
        
        # Indexes
        sa.Index('idx_appt_patient', 'patient_id'),
        sa.Index('idx_appt_status', 'status'),
    )

    if _is_postgresql():
        # ============================================================================
        # SQL FUNCTION 1: Atomic booking operation
        # ============================================================================
        # This is the CORE: single UPDATE operation that's atomic
        # No SELECT before INSERT = no race condition
        op.execute("""
        CREATE OR REPLACE FUNCTION book_slot_atomic(
            p_slot_id INTEGER,
            p_patient_id INTEGER
        ) RETURNS TABLE (
            success BOOLEAN,
            appointment_id INTEGER,
            error_message TEXT
        ) AS $$
        DECLARE
            v_appointment_id INTEGER;
        BEGIN
            -- Step 1: Atomically update slot status (UPDATE without prior SELECT)
            UPDATE time_slots
            SET status = 'booked'
            WHERE id = p_slot_id
              AND status = 'available'
            RETURNING id INTO v_appointment_id;

            -- If slot wasn't updated, it wasn't available
            IF v_appointment_id IS NULL THEN
                RETURN QUERY SELECT FALSE, NULL::INTEGER, 'Slot not available or already booked';
                RETURN;
            END IF;

            -- Step 2: Create appointment record (safe now slot is locked)
            INSERT INTO appointments (slot_id, patient_id, status)
            VALUES (p_slot_id, p_patient_id, 'scheduled')
            RETURNING appointments.id INTO v_appointment_id;

            -- Step 3: Return success
            RETURN QUERY SELECT TRUE, v_appointment_id, NULL;

        EXCEPTION WHEN OTHERS THEN
            -- Rollback on any error
            RETURN QUERY SELECT FALSE, NULL::INTEGER, SQLERRM;
        END;
        $$ LANGUAGE plpgsql;
        """)

        # ============================================================================
        # SQL FUNCTION 2: Cancel appointment and release slot
        # ============================================================================
        op.execute("""
        CREATE OR REPLACE FUNCTION cancel_appointment(p_appointment_id INTEGER)
        RETURNS TABLE (
            success BOOLEAN,
            error_message TEXT
        ) AS $$
        DECLARE
            v_slot_id INTEGER;
        BEGIN
            -- Get slot_id
            SELECT slot_id INTO v_slot_id
            FROM appointments
            WHERE id = p_appointment_id
            FOR UPDATE;

            IF v_slot_id IS NULL THEN
                RETURN QUERY SELECT FALSE, 'Appointment not found';
                RETURN;
            END IF;

            -- Update appointment status
            UPDATE appointments
            SET status = 'cancelled'
            WHERE id = p_appointment_id;

            -- Release slot back to available
            UPDATE time_slots
            SET status = 'available'
            WHERE id = v_slot_id;

            RETURN QUERY SELECT TRUE, NULL;

        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT FALSE, SQLERRM;
        END;
        $$ LANGUAGE plpgsql;
        """)


def downgrade() -> None:
    # Drop functions when database supports them
    if _is_postgresql():
        op.execute("DROP FUNCTION IF EXISTS cancel_appointment(INTEGER)")
        op.execute("DROP FUNCTION IF EXISTS book_slot_atomic(INTEGER, INTEGER)")
    
    # Drop tables
    op.drop_table('appointments')
    op.drop_table('time_slots')
