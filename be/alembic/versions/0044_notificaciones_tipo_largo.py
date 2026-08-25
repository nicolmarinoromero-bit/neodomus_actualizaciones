"""amplia notificaciones.tipo para nuevos tipos de recordatorio

Los tipos 'recordatorio_cita' y 'recordatorio_producto' superan el
VARCHAR(20) original de la columna ``tipo``.

Revision ID: 0044
Revises: 0043
Create Date: 2026-08-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0044"
down_revision = "0043"
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


def _longitud_tipo() -> int:
    bind = op.get_bind()
    return int(
        bind.execute(
            sa.text(
                "SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notificaciones' "
                "AND COLUMN_NAME = 'tipo'"
            )
        ).scalar()
        or 0
    )


def upgrade() -> None:
    if _columna_existe("notificaciones", "tipo") and _longitud_tipo() < 30:
        op.execute(
            "ALTER TABLE notificaciones MODIFY tipo VARCHAR(30) NOT NULL DEFAULT 'sistema'"
        )


def downgrade() -> None:
    if _columna_existe("notificaciones", "tipo") and _longitud_tipo() >= 30:
        op.execute(
            "ALTER TABLE notificaciones MODIFY tipo VARCHAR(20) NOT NULL DEFAULT 'sistema'"
        )
