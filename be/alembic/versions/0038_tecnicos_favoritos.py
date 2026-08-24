"""crea tecnicos_favoritos

Revision ID: 0038
Revises: 0037
Create Date: 2026-08-23

Crea la tabla `tecnicos_favoritos`: técnicos marcados como favoritos por
clientes autenticados (clave compuesta cliente+técnico, sin duplicados).
Es idempotente.
"""
from alembic import op
import sqlalchemy as sa

revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None

_TABLE = "tecnicos_favoritos"


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
        sa.Column(
            "id_cliente",
            sa.Integer(),
            sa.ForeignKey("clientes.id_cliente", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "id_tecnico",
            sa.Integer(),
            sa.ForeignKey("tecnicos.id_tecnico", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    if not _tabla_existe():
        return
    op.drop_table(_TABLE)
