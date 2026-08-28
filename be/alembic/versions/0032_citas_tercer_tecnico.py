"""tercer técnico en citas (equipos de hasta 3 para instalaciones grandes)

Revision ID: 0032
Revises: 0031
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa

revision = "0032"
down_revision = "0031"
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
    if not _columna_existe("citas", "id_tecnico_3"):
        op.add_column("citas", sa.Column("id_tecnico_3", sa.Integer, nullable=True))
    if not _columna_existe("citas", "nombre_tecnico_3"):
        op.add_column(
            "citas",
            sa.Column("nombre_tecnico_3", sa.String(150), nullable=True),
        )


def downgrade() -> None:
    if _columna_existe("citas", "nombre_tecnico_3"):
        op.drop_column("citas", "nombre_tecnico_3")
    if _columna_existe("citas", "id_tecnico_3"):
        op.drop_column("citas", "id_tecnico_3")
