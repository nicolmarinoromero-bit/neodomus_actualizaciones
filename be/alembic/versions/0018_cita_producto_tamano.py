"""cita_producto y tamaño en variantes

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-17

Agrega:
- cita_producto: tabla asociativa entre citas y productos para que el
  tecnico vea los productos involucrados en una cita.
- tamaño en producto_variantes: permite indicar el tamaño de una variante.

Idempotente.
"""
from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
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
    if not _tabla_existe("cita_producto"):
        op.execute(
            "CREATE TABLE cita_producto ("
            "id_cita_producto INT NOT NULL AUTO_INCREMENT, "
            "id_cita INT NOT NULL, "
            "id_producto INT NOT NULL, "
            "id_variante INT NULL, "
            "cantidad INT NOT NULL DEFAULT 1, "
            "notas VARCHAR(255) NULL, "
            "PRIMARY KEY (id_cita_producto), "
            "KEY ix_cita_producto_id_cita (id_cita), "
            "KEY ix_cita_producto_id_producto (id_producto), "
            "CONSTRAINT fk_cita_producto_cita FOREIGN KEY (id_cita) "
            "REFERENCES citas (id_cita) ON DELETE CASCADE, "
            "CONSTRAINT fk_cita_producto_producto FOREIGN KEY (id_producto) "
            "REFERENCES productos (id_producto), "
            "CONSTRAINT fk_cita_producto_variante FOREIGN KEY (id_variante) "
            "REFERENCES producto_variantes (id) ON DELETE SET NULL"
            ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        )

    if not _columna_existe("producto_variantes", "tamaño"):
        op.execute(
            "ALTER TABLE producto_variantes ADD COLUMN tamaño VARCHAR(60) NULL"
        )


def downgrade() -> None:
    if _columna_existe("producto_variantes", "tamaño"):
        op.execute("ALTER TABLE producto_variantes DROP COLUMN tamaño")

    if _tabla_existe("cita_producto"):
        op.execute("DROP TABLE IF EXISTS cita_producto")
