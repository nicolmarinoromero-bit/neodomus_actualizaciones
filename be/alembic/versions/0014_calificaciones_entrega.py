"""calificaciones, foto de usuario y entrega de pedidos

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-14

Agrega:
- Tabla calificaciones (cliente califica al tecnico tras cita finalizada).
- usuarios.foto_url (foto del tecnico/usuario).
- pedidos.fecha_entrega / hora_entrega / id_tecnico_entrega /
  nombre_tecnico_entrega / estado_entrega (asignacion de reparto).

Todo idempotente.
"""
from alembic import op
import sqlalchemy as sa

revision = "0014"
down_revision = "0013"
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
    if not _columna_existe("usuarios", "foto_url"):
        op.execute("ALTER TABLE usuarios ADD COLUMN foto_url VARCHAR(255) NULL")

    cambios_pedidos = [
        ("fecha_entrega", "DATE NULL"),
        ("hora_entrega", "VARCHAR(10) NULL"),
        ("id_tecnico_entrega", "INT NULL"),
        ("nombre_tecnico_entrega", "VARCHAR(150) NULL"),
        ("estado_entrega", "VARCHAR(20) NULL"),
    ]
    for columna, definicion in cambios_pedidos:
        if not _columna_existe("pedidos", columna):
            op.execute(f"ALTER TABLE pedidos ADD COLUMN {columna} {definicion}")

    if not _tabla_existe("calificaciones"):
        op.execute(
            "CREATE TABLE calificaciones ("
            "id_calificacion INT AUTO_INCREMENT PRIMARY KEY, "
            "id_cliente_c INT NOT NULL, "
            "id_tecnico_c INT NOT NULL, "
            "id_cita_c INT NOT NULL, "
            "calificacion TINYINT NOT NULL, "
            "comentario TEXT NULL, "
            "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
            "UNIQUE KEY uq_calificacion_cita (id_cliente_c, id_cita_c)"
            ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        )
    if not _fk_existe("calificaciones", "fk_cal_cliente"):
        op.execute(
            "ALTER TABLE calificaciones ADD CONSTRAINT fk_cal_cliente "
            "FOREIGN KEY (id_cliente_c) REFERENCES clientes(id_cliente)"
        )
    if not _fk_existe("calificaciones", "fk_cal_tecnico"):
        op.execute(
            "ALTER TABLE calificaciones ADD CONSTRAINT fk_cal_tecnico "
            "FOREIGN KEY (id_tecnico_c) REFERENCES tecnicos(id_tecnico)"
        )
    if not _fk_existe("calificaciones", "fk_cal_cita"):
        op.execute(
            "ALTER TABLE calificaciones ADD CONSTRAINT fk_cal_cita "
            "FOREIGN KEY (id_cita_c) REFERENCES citas(id_cita)"
        )


def downgrade() -> None:
    for fk in ("fk_cal_cita", "fk_cal_tecnico", "fk_cal_cliente"):
        if _fk_existe("calificaciones", fk):
            op.execute(f"ALTER TABLE calificaciones DROP FOREIGN KEY {fk}")
    if _tabla_existe("calificaciones"):
        op.execute("DROP TABLE calificaciones")
    cambios_pedidos = [
        ("fecha_entrega", "DATE NULL"),
        ("hora_entrega", "VARCHAR(10) NULL"),
        ("id_tecnico_entrega", "INT NULL"),
        ("nombre_tecnico_entrega", "VARCHAR(150) NULL"),
        ("estado_entrega", "VARCHAR(20) NULL"),
    ]
    for columna, _ in cambios_pedidos:
        if _columna_existe("pedidos", columna):
            op.execute(f"ALTER TABLE pedidos DROP COLUMN {columna}")
    if _columna_existe("usuarios", "foto_url"):
        op.execute("ALTER TABLE usuarios DROP COLUMN foto_url")