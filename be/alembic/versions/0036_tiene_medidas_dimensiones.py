"""productos con medidas (tiene_medidas) + dimensiones por variante

Revision ID: 0036
Revises: 0035
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0036"
down_revision = "0035"
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
    if not _columna_existe("productos", "tiene_medidas"):
        op.add_column(
            "productos",
            sa.Column("tiene_medidas", sa.Boolean, nullable=False, server_default=sa.text("0")),
        )
    if not _columna_existe("producto_variantes", "ancho_cm"):
        op.add_column("producto_variantes", sa.Column("ancho_cm", sa.Integer, nullable=True))
    if not _columna_existe("producto_variantes", "alto_cm"):
        op.add_column("producto_variantes", sa.Column("alto_cm", sa.Integer, nullable=True))


def downgrade() -> None:
    if _columna_existe("producto_variantes", "alto_cm"):
        op.drop_column("producto_variantes", "alto_cm")
    if _columna_existe("producto_variantes", "ancho_cm"):
        op.drop_column("producto_variantes", "ancho_cm")
    if _columna_existe("productos", "tiene_medidas"):
        op.drop_column("productos", "tiene_medidas")
