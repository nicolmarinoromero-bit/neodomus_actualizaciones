"""constraints CHECK: stock nunca negativo (productos y variantes)

Revision ID: 0037
Revises: 0036
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None

CONSTRAINTS = [
    ("productos", "ck_productos_stock_no_negativo", "stock_producto >= 0"),
    ("producto_variantes", "ck_variantes_stock_no_negativo", "stock >= 0"),
]


def _constraint_existe(tabla: str, nombre: str) -> bool:
    bind = op.get_bind()
    existe = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS "
            "WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = :tabla "
            "AND CONSTRAINT_NAME = :nombre"
        ),
        {"tabla": tabla, "nombre": nombre},
    ).scalar()
    return bool(existe)


def upgrade() -> None:
    for tabla, nombre, condicion in CONSTRAINTS:
        if not _constraint_existe(tabla, nombre):
            op.create_check_constraint(nombre, tabla, condicion)


def downgrade() -> None:
    for tabla, nombre, _condicion in reversed(CONSTRAINTS):
        if _constraint_existe(tabla, nombre):
            op.drop_check_constraint(nombre, tabla)
