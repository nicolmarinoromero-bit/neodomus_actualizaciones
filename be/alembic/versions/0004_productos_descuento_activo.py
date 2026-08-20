"""agrega descuento_activo a productos

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-12

Agrega la columna `descuento_activo` (porcentaje de descuento 0-100) a la
tabla `productos`. Es idempotente: si la columna ya existe (por ejemplo, si
fue aplicada a mano) no hace nada.
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

_TABLE = "productos"
_COLUMN = "descuento_activo"


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
        op.add_column(_TABLE, sa.Column(_COLUMN, sa.Float(), nullable=True))


def downgrade() -> None:
    if _columna_existe():
        op.drop_column(_TABLE, _COLUMN)
