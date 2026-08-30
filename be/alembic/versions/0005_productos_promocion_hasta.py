"""agrega promocion_hasta a productos

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-12

Agrega la columna `promocion_hasta` (fecha límite de la promoción/descuento)
a la tabla `productos`. Es idempotente: si la columna ya existe no hace nada.
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

_TABLE = "productos"
_COLUMN = "promocion_hasta"


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
        op.add_column(_TABLE, sa.Column(_COLUMN, sa.Date(), nullable=True))


def downgrade() -> None:
    if _columna_existe():
        op.drop_column(_TABLE, _COLUMN)
