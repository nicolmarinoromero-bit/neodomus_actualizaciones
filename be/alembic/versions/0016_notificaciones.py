"""notificaciones de plataforma por usuario

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-14

Agrega:
- notificaciones: tabla de notificaciones de plataforma dirigidas a un
  usuario (principalmente tecnicos). Se crean en los mismos eventos donde
  se envia el correo (cita asignada, entrega asignada) y el frontend las
  consulta para la campana y el panel del tecnico.

Idempotente.
"""
from alembic import op
import sqlalchemy as sa

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def _tabla_existe(tabla: str) -> bool:
    bind = op.get_bind()
    existe = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.TABLES "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tabla"
        ),
        {"tabla": tabla},
    ).scalar()
    return bool(existe)


def upgrade() -> None:
    if not _tabla_existe("notificaciones"):
        op.execute(
            "CREATE TABLE notificaciones ("
            "id_notificacion INT NOT NULL AUTO_INCREMENT, "
            "id_usuario INT NOT NULL, "
            "tipo VARCHAR(20) NOT NULL DEFAULT 'sistema', "
            "titulo VARCHAR(150) NOT NULL, "
            "mensaje VARCHAR(500) NOT NULL, "
            "leida TINYINT(1) NOT NULL DEFAULT 0, "
            "fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "
            "PRIMARY KEY (id_notificacion), "
            "KEY ix_notificaciones_id_usuario (id_usuario), "
            "CONSTRAINT fk_notificaciones_usuario FOREIGN KEY (id_usuario) "
            "REFERENCES usuarios (id_usuario) ON DELETE CASCADE"
            ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        )


def downgrade() -> None:
    if _tabla_existe("notificaciones"):
        op.execute("DROP TABLE notificaciones")