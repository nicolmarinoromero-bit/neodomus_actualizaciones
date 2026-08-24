"""tecnico aleatorio asignado para recoger productos por devolucion

Revision ID: 0038
Revises: 0037
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0038"
down_revision = "0037"
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
    if not _columna_existe("devoluciones", "id_tecnico_recogida"):
        op.add_column(
            "devoluciones", sa.Column("id_tecnico_recogida", sa.Integer, nullable=True)
        )
    if not _columna_existe("devoluciones", "recogida_estado"):
        op.add_column(
            "devoluciones",
            sa.Column(
                "recogida_estado",
                sa.String(20),
                nullable=True,
                server_default=sa.text("'Asignada'"),
            ),
        )
    if not _columna_existe("devoluciones", "preferencia"):
        op.add_column(
            "devoluciones",
            sa.Column("preferencia", sa.String(10), nullable=True),
        )


def downgrade() -> None:
    if _columna_existe("devoluciones", "preferencia"):
        op.drop_column("devoluciones", "preferencia")
    if _columna_existe("devoluciones", "recogida_estado"):
        op.drop_column("devoluciones", "recogida_estado")
    if _columna_existe("devoluciones", "id_tecnico_recogida"):
        op.drop_column("devoluciones", "id_tecnico_recogida")
