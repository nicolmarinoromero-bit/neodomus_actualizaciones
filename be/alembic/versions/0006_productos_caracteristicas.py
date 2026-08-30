"""agrega caracteristicas_producto a productos

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-12

Agrega la columna `caracteristicas_producto` (características técnicas / destacados)
a la tabla `productos`. Es idempotente: si la columna ya existe no hace nada.
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

_TABLE = "productos"
_COLUMN = "caracteristicas_producto"


def _columna_existe() -> bool:
    bind = op.get_bind()
    exists = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tabla "
            "AND COLUMN_NAME = :col"
        ),
        {"tabla": _TABLE, "col": _COLUMN},
    ).scalar()
    return bool(exists)


def upgrade() -> None:
    if not _columna_existe():
        op.add_column(_TABLE, sa.Column(_COLUMN, sa.Text(), nullable=True))


def downgrade() -> None:
    if _columna_existe():
        op.drop_column(_TABLE, _COLUMN)
