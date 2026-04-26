"""add unique constraint for appointments slot

Revision ID: 20260402_0003
Revises: 20260401_0002
Create Date: 2026-04-02 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260402_0003"
down_revision = "20260401_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("appointments"):
        return

    appointment_columns = {col["name"] for col in inspector.get_columns("appointments")}
    if "doctor_id" not in appointment_columns or "date_time" not in appointment_columns:
        # Esquema legacy slot-based: no aplica este unique por doctor/date_time.
        return

    duplicates = bind.execute(
        sa.text(
            """
            SELECT doctor_id, date_time, COUNT(*) AS total
            FROM appointments
            GROUP BY doctor_id, date_time
            HAVING COUNT(*) > 1
            """
        )
    ).fetchall()

    if duplicates:
        raise RuntimeError(
            "No se puede aplicar UNIQUE(doctor_id, date_time): existen slots duplicados en appointments"
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("appointments")}
    if "uq_appointments_doctor_date_time" in existing_indexes:
        return

    if bind.dialect.name == "sqlite":
        op.create_index(
            "uq_appointments_doctor_date_time",
            "appointments",
            ["doctor_id", "date_time"],
            unique=True,
        )
    else:
        op.create_unique_constraint(
            "uq_appointments_doctor_date_time",
            "appointments",
            ["doctor_id", "date_time"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("appointments"):
        return

    if bind.dialect.name == "sqlite":
        op.drop_index("uq_appointments_doctor_date_time", table_name="appointments")
    else:
        op.drop_constraint("uq_appointments_doctor_date_time", "appointments", type_="unique")
