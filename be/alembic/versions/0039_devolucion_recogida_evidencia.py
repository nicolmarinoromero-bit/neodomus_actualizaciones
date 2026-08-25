"""evidencia y fecha de recogida de devoluciones

Revision ID: 0039
Revises: 0038
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0039"
down_revision = "0038"
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
    if not _columna_existe("devoluciones", "evidencia_recogida"):
        op.add_column(
            "devoluciones",
            sa.Column("evidencia_recogida", sa.String(255), nullable=True),
        )
    if not _columna_existe("devoluciones", "fecha_recogida"):
        op.add_column(
            "devoluciones",
            sa.Column("fecha_recogida", sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    if _columna_existe("devoluciones", "fecha_recogida"):
        op.drop_column("devoluciones", "fecha_recogida")
    if _columna_existe("devoluciones", "evidencia_recogida"):
        op.drop_column("devoluciones", "evidencia_recogida")
