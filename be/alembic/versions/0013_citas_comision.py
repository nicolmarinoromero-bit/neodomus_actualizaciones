"""agrega comision a citas

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-14

Agrega citas.id_comision_c (FK -> comisiones.id_comision) para asociar
una comision al servicio de una cita. Idempotente.
"""
from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
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


def _fk_existe(tabla: str, fk_nombre: str) -> bool:
    bind = op.get_bind()
    existe = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tabla "
            "AND CONSTRAINT_NAME = :fk AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
        ),
        {"tabla": tabla, "fk": fk_nombre},
    ).scalar()
    return bool(existe)


def upgrade() -> None:
    if not _columna_existe("citas", "id_comision_c"):
        op.execute(
            "ALTER TABLE citas ADD COLUMN id_comision_c INT NULL "
            "AFTER numero_transaccion"
        )
    if not _fk_existe("citas", "fk_citas_comision"):
        op.execute(
            "ALTER TABLE citas ADD CONSTRAINT fk_citas_comision "
            "FOREIGN KEY (id_comision_c) REFERENCES comisiones(id_comision)"
        )


def downgrade() -> None:
    if _fk_existe("citas", "fk_citas_comision"):
        op.execute("ALTER TABLE citas DROP FOREIGN KEY fk_citas_comision")
    if _columna_existe("citas", "id_comision_c"):
        op.execute("ALTER TABLE citas DROP COLUMN id_comision_c")
