"""columna aceptada_por_cliente en ofertas_horario

Revision ID: 0045
Revises: 0044
Create Date: 2026-08-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0045"
down_revision = "0044"
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
    if not _columna_existe("ofertas_horario", "aceptada_por_cliente"):
        op.add_column(
            "ofertas_horario",
            sa.Column("aceptada_por_cliente", sa.Integer(), nullable=True),
        )


def downgrade() -> None:
    if _columna_existe("ofertas_horario", "aceptada_por_cliente"):
        op.drop_column("ofertas_horario", "aceptada_por_cliente")
