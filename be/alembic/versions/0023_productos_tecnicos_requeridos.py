"""productos: tecnicos_requeridos (cuántos técnicos necesita la instalación)

Revision ID: 0023
Revises: 0022
Create Date: 2026-08-20

Agrega:
- columna `tecnicos_requeridos` en productos (INT, NOT NULL, default 1).

Idempotente.
"""
from alembic import op
import sqlalchemy as sa


revision = "0023"
down_revision = "0022"
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
    if not _columna_existe("productos", "tecnicos_requeridos"):
        op.add_column(
            "productos",
            sa.Column(
                "tecnicos_requeridos",
                sa.Integer,
                nullable=False,
                server_default="1",
            ),
        )


def downgrade() -> None:
    if _columna_existe("productos", "tecnicos_requeridos"):
        op.drop_column("productos", "tecnicos_requeridos")