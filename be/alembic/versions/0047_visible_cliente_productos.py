""" Agregar visible_cliente a productos

Revision ID: 0047
Revises: 0046
Create Date: 2026-08-27
"""
from alembic import op
import sqlalchemy as sa

revision = "0047"
down_revision = "0046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'visible_cliente'"
        )
    )
    if result.scalar() == 0:
        op.add_column(
            "productos",
            sa.Column("visible_cliente", sa.Boolean(), nullable=False, server_default="1"),
        )


def downgrade() -> None:
    op.drop_column("productos", "visible_cliente")
