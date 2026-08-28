"""precio propio por variante (tamaño/color con precio distinto)

Revision ID: 0035
Revises: 0034
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0035"
down_revision = "0034"
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
    if not _columna_existe("producto_variantes", "precio"):
        op.add_column("producto_variantes", sa.Column("precio", sa.Float, nullable=True))


def downgrade() -> None:
    if _columna_existe("producto_variantes", "precio"):
        op.drop_column("producto_variantes", "precio")
