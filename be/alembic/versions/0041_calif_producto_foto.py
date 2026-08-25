"""foto opcional en la calificación de productos

Revision ID: 0040
Revises: 0039
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0041"
down_revision = "0040"
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
    if not _columna_existe("calificaciones_producto", "foto_url"):
        op.add_column(
            "calificaciones_producto",
            sa.Column("foto_url", sa.String(255), nullable=True),
        )


def downgrade() -> None:
    if _columna_existe("calificaciones_producto", "foto_url"):
        op.drop_column("calificaciones_producto", "foto_url")
