"""facturas: soporte para citas (id_pedido nullable + id_cita)

Revision ID: 0022
Revises: 0021
Create Date: 2026-08-18

Agrega:
- id_cita FK nullable en facturas.
- Hace id_pedido nullable en facturas (antes era NOT NULL).

Permite generar facturas tanto para pedidos como para citas.

Idempotente.
"""
from alembic import op
import sqlalchemy as sa


revision = "0022"
down_revision = "0021"
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
    # Hace id_pedido nullable (antes era NOT NULL).
    op.alter_column(
        "facturas", "id_pedido",
        type_=sa.Integer, nullable=True,
    )

    if not _columna_existe("facturas", "id_cita"):
        op.add_column(
            "facturas",
            sa.Column("id_cita", sa.Integer, nullable=True),
        )
        op.create_foreign_key(
            "fk_facturas_id_cita",
            "facturas", "citas",
            ["id_cita"], ["id_cita"],
        )


def downgrade() -> None:
    if _columna_existe("facturas", "id_cita"):
        op.drop_constraint("fk_facturas_id_cita", "facturas", type_="foreignkey")
        op.drop_column("facturas", "id_cita")

    op.alter_column(
        "facturas", "id_pedido",
        type_=sa.Integer, nullable=False,
    )
