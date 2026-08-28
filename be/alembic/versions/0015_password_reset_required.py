"""cambio de contrasena obligatorio para empleados

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-14

Agrega:
- usuarios.password_reset_required: el administrador crea/establece la
  contrasena de un empleado (tecnico) y este debe cambiarla en su primer
  inicio de sesion.

Idempotente.
"""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
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
    if not _columna_existe("usuarios", "password_reset_required"):
        op.execute(
            "ALTER TABLE usuarios ADD COLUMN password_reset_required "
            "BOOLEAN NOT NULL DEFAULT 0"
        )


def downgrade() -> None:
    if _columna_existe("usuarios", "password_reset_required"):
        op.execute("ALTER TABLE usuarios DROP COLUMN password_reset_required")