"""citas: agregar recordatorio_enviado

Revision ID: 0021
Revises: 0020
Create Date: 2026-08-17

Agrega:
- recordatorio_enviado BOOLEAN NOT NULL DEFAULT 0 en citas.

Evita enviar el mismo recordatorio más de una vez por cita.

Idempotente.
"""
from alembic import op
import sqlalchemy as sa


revision = "0021"
down_revision = "0020"
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
    if not _columna_existe("citas", "recordatorio_enviado"):
        op.add_column(
            "citas",
            sa.Column("recordatorio_enviado", sa.Boolean, nullable=False, server_default=sa.text("0")),
        )


def downgrade() -> None:
    if _columna_existe("citas", "recordatorio_enviado"):
        op.drop_column("citas", "recordatorio_enviado")
