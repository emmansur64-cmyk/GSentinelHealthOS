"""Add asymmetric doctor buffers for slot booking.

Revision ID: 20260402_0015
Revises: 20260402_0014
Create Date: 2026-04-02 23:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260402_0015"
down_revision: Union[str, None] = "20260402_0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("doctors"):
        return
    doc_columns = {col["name"] for col in inspector.get_columns("doctors")}
    
    with op.batch_alter_table("doctors") as batch_op:
        if "buffer_before_minutes" not in doc_columns:
            batch_op.add_column(sa.Column("buffer_before_minutes", sa.Integer(), nullable=False, server_default="0"))
        if "buffer_after_minutes" not in doc_columns:
            batch_op.add_column(sa.Column("buffer_after_minutes", sa.Integer(), nullable=False, server_default="0"))

    if bind.dialect.name == "postgresql":
        op.execute(
            """
            ALTER TABLE doctors
            DROP CONSTRAINT IF EXISTS ck_doctors_buffer_before_non_negative
            """
        )
        op.execute(
            """
            ALTER TABLE doctors
            ADD CONSTRAINT ck_doctors_buffer_before_non_negative
            CHECK (buffer_before_minutes >= 0)
            """
        )
        op.execute(
            """
            ALTER TABLE doctors
            DROP CONSTRAINT IF EXISTS ck_doctors_buffer_after_non_negative
            """
        )
        op.execute(
            """
            ALTER TABLE doctors
            ADD CONSTRAINT ck_doctors_buffer_after_non_negative
            CHECK (buffer_after_minutes >= 0)
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("doctors"):
        return
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE doctors DROP CONSTRAINT IF EXISTS ck_doctors_buffer_before_non_negative")
        op.execute("ALTER TABLE doctors DROP CONSTRAINT IF EXISTS ck_doctors_buffer_after_non_negative")

    with op.batch_alter_table("doctors") as batch_op:
        batch_op.drop_column("buffer_after_minutes")
        batch_op.drop_column("buffer_before_minutes")
