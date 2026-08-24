"""precio correcto del cable UTP Cat6 (venta por metros)

Revision ID: 0038
Revises: 0037
Create Date: 2026-08-24

Corrección del precio unitario del producto 'cable utp cat6' (utp6-050):
el valor ingresado (3.500) era erróneo; el precio real por metro es 35.000.
El frontend ya muestra el precio por metro con el formato estándar
'$35.000 COP / metro', así que con corregir el dato en BD basta.

Es idempotente: actualiza solo la fila que cumple la condición.
"""
from alembic import op
import sqlalchemy as sa

revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "UPDATE productos SET precio_venta_producto = :venta "
            "WHERE referencia_producto = :ref"
        ),
        {"venta": 35000.00, "ref": "utp6-050"},
    )


def downgrade() -> None:
    # Restaura el valor previo (erróneo) del precio unitario.
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "UPDATE productos SET precio_venta_producto = :venta "
            "WHERE referencia_producto = :ref"
        ),
        {"venta": 3500.00, "ref": "utp6-050"},
    )
