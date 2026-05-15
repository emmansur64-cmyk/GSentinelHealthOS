"""create bot_knowledge_base table for bot learning system

Revision ID: 20260401_0002
Revises: 20260401_0001
Create Date: 2026-04-01 12:00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260401_0002"
down_revision: Union[str, None] = "20260401_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        uuid_type = postgresql.UUID(as_uuid=True)
    else:
        uuid_type = sa.String(length=36)

    doctor_id_type = uuid_type
    create_doctor_fk = False
    if inspector.has_table("doctors"):
        doctor_columns = {col["name"]: col for col in inspector.get_columns("doctors")}
        doctor_id_column = doctor_columns.get("id")
        if doctor_id_column is not None:
            doctor_id_type = doctor_id_column["type"]
            create_doctor_fk = True

    columns = [
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pattern", sa.String(length=500), nullable=False),
        sa.Column("correct_action", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("doctor_id", doctor_id_type, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id", name="pk_bot_knowledge_base"),
    ]

    op.create_table("bot_knowledge_base", *columns)
    op.create_index("ix_bot_knowledge_base_pattern", "bot_knowledge_base", ["pattern"], unique=False)
    op.create_index("ix_bot_knowledge_base_doctor_id", "bot_knowledge_base", ["doctor_id"], unique=False)
    op.create_index("ix_bot_knowledge_base_category", "bot_knowledge_base", ["category"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_bot_knowledge_base_category", table_name="bot_knowledge_base")
    op.drop_index("ix_bot_knowledge_base_doctor_id", table_name="bot_knowledge_base")
    op.drop_index("ix_bot_knowledge_base_pattern", table_name="bot_knowledge_base")
    op.drop_table("bot_knowledge_base")
