"""Add specialty urgent reassignment policy and SLA fields in reassignment audit.

Revision ID: 20260402_0009
Revises: 20260402_0008
Create Date: 2026-04-02 23:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260402_0009"
down_revision = "20260402_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    if not inspector.has_table("specialty_priority_policy"):
        op.create_table(
            "specialty_priority_policy",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("specialty", sa.String(length=100), nullable=False),
            sa.Column("allow_urgent_reassign", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("urgent_sla_target_minutes", sa.Integer(), nullable=False, server_default="60"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.UniqueConstraint("specialty", name="uq_specialty_priority_policy_specialty"),
            sa.CheckConstraint("urgent_sla_target_minutes > 0 AND urgent_sla_target_minutes <= 720", name="ck_urgent_sla_target_range"),
        )
        op.create_index("idx_specialty_priority_specialty", "specialty_priority_policy", ["specialty"], unique=False)

    audit_columns = {col["name"] for col in inspector.get_columns("appointment_reassignment_audit")}
    
    if "urgent_wait_minutes" not in audit_columns:
        op.add_column("appointment_reassignment_audit", sa.Column("urgent_wait_minutes", sa.Integer(), nullable=True))
    if "sla_target_minutes" not in audit_columns:
        op.add_column("appointment_reassignment_audit", sa.Column("sla_target_minutes", sa.Integer(), nullable=True))
    if "sla_breached" not in audit_columns:
        op.add_column(
            "appointment_reassignment_audit",
            sa.Column("sla_breached", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )
    
    audit_indexes = {idx["name"] for idx in inspector.get_indexes("appointment_reassignment_audit")}
    if "idx_reassign_audit_doctor_sla" not in audit_indexes:
        op.create_index(
            "idx_reassign_audit_doctor_sla",
            "appointment_reassignment_audit",
            ["doctor_id", "sla_breached"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index("idx_reassign_audit_doctor_sla", table_name="appointment_reassignment_audit")
    op.drop_column("appointment_reassignment_audit", "sla_breached")
    op.drop_column("appointment_reassignment_audit", "sla_target_minutes")
    op.drop_column("appointment_reassignment_audit", "urgent_wait_minutes")

    op.drop_index("idx_specialty_priority_specialty", table_name="specialty_priority_policy")
    op.drop_table("specialty_priority_policy")
