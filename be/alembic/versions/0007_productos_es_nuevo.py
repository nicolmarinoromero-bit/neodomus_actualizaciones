"""agrega es_nuevo_producto a productos

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-12

Agrega la columna `es_nuevo_producto` (marcado manual como producto nuevo)
a la tabla `productos`. Los productos existentes quedan como "no nuevo".
Es idempotente: si la columna ya existe no hace nada.
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

_TABLE = "productos"
_COLUMN = "es_nuevo_producto"


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
        op.add_column(
            _TABLE,
            sa.Column(_COLUMN, sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )


def downgrade() -> None:
    if _columna_existe():
        op.drop_column(_TABLE, _COLUMN)
