"""Allow processing status in google_outbox.

Revision ID: 20260402_0014
Revises: 20260402_0013
Create Date: 2026-04-03 01:45:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20260402_0014"
down_revision: Union[str, None] = "20260402_0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute("ALTER TABLE google_outbox DROP CONSTRAINT IF EXISTS ck_google_outbox_status_valid")
    op.execute(
        """
        ALTER TABLE google_outbox
        ADD CONSTRAINT ck_google_outbox_status_valid
        CHECK (status IN ('pending', 'processing', 'done', 'failed'))
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute("ALTER TABLE google_outbox DROP CONSTRAINT IF EXISTS ck_google_outbox_status_valid")
    op.execute(
        """
        ALTER TABLE google_outbox
        ADD CONSTRAINT ck_google_outbox_status_valid
        CHECK (status IN ('pending', 'done', 'failed'))
        """
    )
