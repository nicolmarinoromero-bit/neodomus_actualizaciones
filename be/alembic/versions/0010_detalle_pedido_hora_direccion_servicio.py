"""agrega hora y direccion al detalle de servicio

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-13

Agrega `hora_servicio` y `direccion_servicio` a `detalle_pedido` para que
las líneas de servicio técnico conserven la hora y la dirección elegidas
en el checkout (necesarias al confirmar un pago pendiente y generar la
orden de instalación). Es idempotente.
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

_TABLE = "detalle_pedido"
_COLUMNS = ("hora_servicio", "direccion_servicio")


def _columna_existe(columna: str) -> bool:
    bind = op.get_bind()
    exists = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tabla "
            "AND COLUMN_NAME = :columna"
        ),
        {"tabla": _TABLE, "columna": columna},
    ).scalar()
    return bool(exists)


def upgrade() -> None:
    if not _columna_existe("hora_servicio"):
        op.add_column(_TABLE, sa.Column("hora_servicio", sa.String(length=5), nullable=True))
    if not _columna_existe("direccion_servicio"):
        op.add_column(_TABLE, sa.Column("direccion_servicio", sa.String(length=200), nullable=True))


def downgrade() -> None:
    for columna in _COLUMNS:
        if _columna_existe(columna):
            op.drop_column(_TABLE, columna)
