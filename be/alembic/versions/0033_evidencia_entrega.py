"""evidencia fotográfica de entregas de productos

Revision ID: 0033
Revises: 0032
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def _columna_existe(tabla: str, columna: str) -> bool:
    bind = op.get_bind()
    existe = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tabla "
            "AND COLUMN_NAME = :columna"
        ),
        {"tabla": tabla, "columna": columna},
    ).scalar()
    return bool(existe)


def upgrade() -> None:
    if not _columna_existe("pedidos", "evidencia_entrega_url"):
        op.add_column(
            "pedidos",
            sa.Column("evidencia_entrega_url", sa.String(255), nullable=True),
        )


def downgrade() -> None:
    if _columna_existe("pedidos", "evidencia_entrega_url"):
        op.drop_column("pedidos", "evidencia_entrega_url")
