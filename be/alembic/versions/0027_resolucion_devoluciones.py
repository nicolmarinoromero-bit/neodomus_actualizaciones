"""resolucion de devoluciones (Reembolso / Cambio)

Revision ID: 0027
Revises: 0026
Create Date: 2026-08-21
"""

from alembic import op
import sqlalchemy as sa

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None

MYSQL_KW = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


def _columna_existe(table: str, column: str) -> bool:
    bind = op.get_bind()
    fila = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c"
        ),
        {"t": table, "c": column},
    ).scalar()
    return bool(fila)


def upgrade() -> None:
    if not _columna_existe("devoluciones", "resolucion"):
        op.add_column(
            "devoluciones",
            sa.Column("resolucion", sa.String(length=20), nullable=True),
        )


def downgrade() -> None:
    if _columna_existe("devoluciones", "resolucion"):
        op.drop_column("devoluciones", "resolucion")
