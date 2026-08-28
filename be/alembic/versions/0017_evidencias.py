"""evidencias de trabajo de los tecnicos

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-15

Agrega:
- evidencias: fotos/archivos que el tecnico sube como evidencia del trabajo
  realizado en una cita. Se exige al menos una para finalizar la cita.

Idempotente.
"""
from alembic import op
import sqlalchemy as sa

revision = "0017"
down_revision = "0016"
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
    if not _tabla_existe("evidencias"):
        op.execute(
            "CREATE TABLE evidencias ("
            "id_evidencia INT NOT NULL AUTO_INCREMENT, "
            "id_cita INT NOT NULL, "
            "id_tecnico INT NOT NULL, "
            "url_archivo VARCHAR(255) NOT NULL, "
            "descripcion VARCHAR(255) NULL, "
            "fecha_subida DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "
            "PRIMARY KEY (id_evidencia), "
            "KEY ix_evidencias_id_cita (id_cita), "
            "CONSTRAINT fk_evidencias_cita FOREIGN KEY (id_cita) "
            "REFERENCES citas (id_cita) ON DELETE CASCADE, "
            "CONSTRAINT fk_evidencias_tecnico FOREIGN KEY (id_tecnico) "
            "REFERENCES tecnicos (id_tecnico)"
            ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        )


def downgrade() -> None:
    if _tabla_existe("evidencias"):
        op.execute("DROP TABLE evidencias")