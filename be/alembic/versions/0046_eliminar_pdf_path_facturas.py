"""Eliminar columna pdf_path de facturas

Revision ID: 0046
Revises: 0045
Create Date: 2026-08-27
"""

from alembic import op
import sqlalchemy as sa


revision = "0046"
down_revision = "0045"
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
    if _columna_existe("facturas", "pdf_path"):
        op.drop_column("facturas", "pdf_path")


def downgrade() -> None:
    if not _columna_existe("facturas", "pdf_path"):
        op.add_column("facturas", sa.Column("pdf_path", sa.String(255), nullable=True))
