"""admin_audit_log and feature_flags tables for Panel Super-Admin

Revision ID: 20260516_0021
Revises: 20260427_0020_clinic
Create Date: 2026-05-16 00:00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260516_0021"
down_revision: Union[str, None] = "20260427_0020_clinic"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── admin_audit_logs ────────────────────────────────────────────────────
    op.create_table(
        "admin_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("timestamp", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("actor_id", sa.String(255), nullable=False),
        sa.Column("actor_email", sa.String(255), nullable=False),
        sa.Column("actor_role", sa.String(64), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("resource_type", sa.String(64), nullable=True),
        sa.Column("resource_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="success"),
        sa.Column("metadata_json", sa.Text, nullable=True),
        sa.Column("request_id", sa.String(128), nullable=True),
        sa.Column("ip_hash", sa.String(64), nullable=True),
    )
    op.create_index("ix_admin_audit_logs_timestamp", "admin_audit_logs", ["timestamp"])
    op.create_index("ix_admin_audit_logs_actor_id", "admin_audit_logs", ["actor_id"])
    op.create_index("ix_admin_audit_logs_action", "admin_audit_logs", ["action"])

    # ── feature_flags ────────────────────────────────────────────────────────
    op.create_table(
        "feature_flags",
        sa.Column("key", sa.String(128), primary_key=True),
        sa.Column("label", sa.String(128), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("scope", sa.String(32), nullable=False, server_default="global"),
        sa.Column("module", sa.String(64), nullable=True),
        sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # Seed: flags iniciales del ecosistema
    op.execute(
        """
        INSERT INTO feature_flags (key, label, description, enabled, scope, module, updated_at)
        VALUES
            ('mb_chat_enabled',        'MB-Chat',        'Enable AI chat module for all tenants',                   true,  'global',     'MB-Chat',     NOW()),
            ('mb_secretaria_enabled',  'MB-Secretaria',  'Enable secretarial scheduling module',                    true,  'global',     'MB-Secretaria', NOW()),
            ('mb_whatsapp_enabled',    'MB-Whatsapp',    'Enable WhatsApp integration module',                      true,  'global',     'MB-Whatsapp', NOW()),
            ('brain_core_enabled',     'Brain Core',     'Enable AI decision engine',                               true,  'global',     'Brain Core',  NOW()),
            ('doctor_triage_gate',     'Triage Gate',    'Require triage contract before doctor chat escalation',   true,  'per-tenant', 'MB-Chat',     NOW())
        ON CONFLICT (key) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table("feature_flags")
    op.drop_index("ix_admin_audit_logs_action", table_name="admin_audit_logs")
    op.drop_index("ix_admin_audit_logs_actor_id", table_name="admin_audit_logs")
    op.drop_index("ix_admin_audit_logs_timestamp", table_name="admin_audit_logs")
    op.drop_table("admin_audit_logs")
