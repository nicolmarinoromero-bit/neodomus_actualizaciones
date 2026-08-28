"""agrega desactivado_hasta a usuarios

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-12

Agrega la columna `desactivado_hasta` (fecha hasta la que un usuario queda
inhabilitado) a la tabla `usuarios`. Es idempotente.
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

_TABLE = "usuarios"
_COLUMN = "desactivado_hasta"


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
        op.add_column(_TABLE, sa.Column(_COLUMN, sa.DateTime(), nullable=True))


def downgrade() -> None:
    if _columna_existe():
        op.drop_column(_TABLE, _COLUMN)
