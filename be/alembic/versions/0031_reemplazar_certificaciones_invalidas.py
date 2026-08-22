"""reemplaza certificaciones no domóticas de técnicos por una del catálogo

Revision ID: 0031
Revises: 0030
Create Date: 2026-08-22

Los técnicos cuya `certificacion_t` sea una de las certificaciones TI/PM
(listadas abajo) quedan con la especialización válida "Automatización de
hogares" y su vínculo M2M sincronizado.
"""

from alembic import op
import sqlalchemy as sa

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None

REEMPLAZO_NOMBRE = "Automatización de hogares"
REEMPLAZO_DESC = "Asistentes, rutinas y escenas automatizadas"

CERTIFICACIONES_INVALIDAS = [
    "certificación en seguridad informática",
    "certificacion en seguridad informatica",
    "certificación en programación backend",
    "certificacion en programacion backend",
    "certificación en gestión de proyectos",
    "certificacion en gestion de proyectos",
]

CONDICIONES = " OR ".join(
    f"LOWER(TRIM(t.certificacion_t)) = :inv{i}" for i in range(len(CERTIFICACIONES_INVALIDAS))
)
PARAMS_INVALIDAS = {f"inv{i}": v for i, v in enumerate(CERTIFICACIONES_INVALIDAS)}


def upgrade() -> None:
    bind = op.get_bind()

    # 1) Asegurar que la especialización de reemplazo exista.
    bind.execute(
        sa.text(
            "INSERT IGNORE INTO especializaciones (nombre, descripcion, activa) "
            "VALUES (:nombre, :descripcion, 1)"
        ),
        {"nombre": REEMPLAZO_NOMBRE, "descripcion": REEMPLAZO_DESC},
    )

    # 2) Reemplazar las certificaciones inválidas.
    res = bind.execute(
        sa.text(
            f"UPDATE tecnicos t SET t.certificacion_t = :reemplazo "
            f"WHERE {CONDICIONES}"
        ),
        {"reemplazo": REEMPLAZO_NOMBRE, **PARAMS_INVALIDAS},
    )
    print(f"[0031] Certificaciones reemplazadas en {res.rowcount or 0} técnicos")

    # 3) Sincronizar el vínculo M2M con el nuevo nombre.
    bind.execute(
        sa.text(
            "INSERT IGNORE INTO tecnico_especializacion (id_tecnico, id_especializacion) "
            "SELECT t.id_tecnico, e.id_especializacion "
            "FROM tecnicos t JOIN especializaciones e "
            "ON LOWER(TRIM(t.certificacion_t)) COLLATE utf8mb4_unicode_ci "
            "= LOWER(e.nombre) COLLATE utf8mb4_unicode_ci "
            "WHERE e.nombre = :nombre"
        ),
        {"nombre": REEMPLAZO_NOMBRE},
    )


def downgrade() -> None:
    # No reversible: no se puede reconstruir qué técnico tenía cuál de las tres.
    pass
