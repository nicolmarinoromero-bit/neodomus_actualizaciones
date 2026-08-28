"""crea solicitudes_habilitacion_empleado

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-13

Crea la tabla `solicitudes_habilitacion_empleado` donde se registran las
solicitudes de habilitación de cuenta enviadas por empleados (técnicos)
cuya cuenta fue inhabilitada. Es idempotente.
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

_TABLE = "solicitudes_habilitacion_empleado"


def _tabla_existe() -> bool:
    bind = op.get_bind()
    exists = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.TABLES "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tabla"
        ),
        {"tabla": _TABLE},
    ).scalar()
    return bool(exists)


def upgrade() -> None:
    if _tabla_existe():
        return
    op.create_table(
        _TABLE,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "id_usuario",
            sa.Integer(),
            sa.ForeignKey("usuarios.id_usuario", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "estado",
            sa.String(length=20),
            nullable=False,
            server_default="pendiente",
        ),
        sa.Column("resuelta_por", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("resuelta_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    if not _tabla_existe():
        return
    op.drop_table(_TABLE)
