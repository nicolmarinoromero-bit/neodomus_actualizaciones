"""citas: segundo técnico (id_tecnico_2, nombre_tecnico_2)

Revision ID: 0024
Revises: 0023
Create Date: 2026-08-20

Agrega:
- columna `id_tecnico_2` en citas (INT, NULL).
- columna `nombre_tecnico_2` en citas (VARCHAR(150), NULL).

Idempotente.
"""
from alembic import op
import sqlalchemy as sa


revision = "0024"
down_revision = "0023"
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
    if not _columna_existe("citas", "id_tecnico_2"):
        op.add_column("citas", sa.Column("id_tecnico_2", sa.Integer, nullable=True))
    if not _columna_existe("citas", "nombre_tecnico_2"):
        op.add_column(
            "citas", sa.Column("nombre_tecnico_2", sa.String(150), nullable=True)
        )


def downgrade() -> None:
    if _columna_existe("citas", "nombre_tecnico_2"):
        op.drop_column("citas", "nombre_tecnico_2")
    if _columna_existe("citas", "id_tecnico_2"):
        op.drop_column("citas", "id_tecnico_2")