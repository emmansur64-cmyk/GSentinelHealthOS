"""Seed initial specialty priority policies.

Revision ID: 20260402_0010
Revises: 20260402_0009
Create Date: 2026-04-02 23:25:00.000000
"""

from alembic import op


revision = "20260402_0010"
down_revision = "20260402_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.execute(
		"""
		INSERT INTO specialty_priority_policy (specialty, allow_urgent_reassign, urgent_sla_target_minutes)
		VALUES
			('Guardia', true, 30),
			('Cardiología', true, 45),
			('Pediatría', true, 30),
			('Medicina General', false, 60),
			('Traumatología', true, 45),
			('Obstetricia', true, 30),
			('Neurología', false, 60),
			('Oncología', false, 60)
		ON CONFLICT (specialty) DO NOTHING
		"""
	)


def downgrade() -> None:
	op.execute(
		"""
		DELETE FROM specialty_priority_policy
		WHERE
			(specialty = 'Guardia' AND allow_urgent_reassign = true AND urgent_sla_target_minutes = 30)
			OR (specialty = 'Cardiología' AND allow_urgent_reassign = true AND urgent_sla_target_minutes = 45)
			OR (specialty = 'Pediatría' AND allow_urgent_reassign = true AND urgent_sla_target_minutes = 30)
			OR (specialty = 'Medicina General' AND allow_urgent_reassign = false AND urgent_sla_target_minutes = 60)
			OR (specialty = 'Traumatología' AND allow_urgent_reassign = true AND urgent_sla_target_minutes = 45)
			OR (specialty = 'Obstetricia' AND allow_urgent_reassign = true AND urgent_sla_target_minutes = 30)
			OR (specialty = 'Neurología' AND allow_urgent_reassign = false AND urgent_sla_target_minutes = 60)
			OR (specialty = 'Oncología' AND allow_urgent_reassign = false AND urgent_sla_target_minutes = 60)
		"""
	)
