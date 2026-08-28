"""evidencia de entrega del producto de cambio en devoluciones

Revision ID: 0042
Revises: 0041
Create Date: 2026-08-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0042"
down_revision = "0041"
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
    if not _columna_existe("devoluciones", "evidencia_cambio"):
        op.add_column(
            "devoluciones",
            sa.Column("evidencia_cambio", sa.String(255), nullable=True),
        )
    if not _columna_existe("devoluciones", "fecha_entrega_cambio"):
        op.add_column(
            "devoluciones",
            sa.Column("fecha_entrega_cambio", sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    if _columna_existe("devoluciones", "fecha_entrega_cambio"):
        op.drop_column("devoluciones", "fecha_entrega_cambio")
    if _columna_existe("devoluciones", "evidencia_cambio"):
        op.drop_column("devoluciones", "evidencia_cambio")
