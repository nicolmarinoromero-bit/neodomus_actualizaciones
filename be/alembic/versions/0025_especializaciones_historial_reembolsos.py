"""especializaciones: catálogo M2M técnicos/productos + historial + reembolsos

Revision ID: 0025
Revises: 0024
Create Date: 2026-08-20

Agrega:
- tabla `especializaciones` (catálogo administrable) + seed domótica.
- tabla `tecnico_especializacion` (M2M).
- tabla `producto_especializacion` (M2M).
- columnas `productos.dificultad_instalacion`, `productos.tiempo_estimado_horas`.
- columna `citas.id_especializacion` (FK, NULL).
- tabla `historial_citas` (trazabilidad reasignaciones/cancelaciones).
- tabla `reembolsos`.

Migra los valores existentes de `tecnicos.certificacion_t` al M2M cuando
coinciden con el catálogo. Idempotente y sin pérdida de datos.
"""
from alembic import op
import sqlalchemy as sa


revision = "0025"
down_revision = "0024"
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


CATALOGO = [
    ("Instalación de cámaras de seguridad", "CCTV, cámaras IP, grabación y monitoreo"),
    ("Sistemas de alarmas", "Alarmas de intrusión, sirenas y centralitas"),
    ("Cerraduras inteligentes", "Cerraduras electrónicas y biométricas"),
    ("Iluminación inteligente", "Bombillas, tiras LED y control de iluminación"),
    ("Automatización de hogares", "Asistentes, rutinas y escenas automatizadas"),
    ("Control de acceso", "Lectores, tarjetas RFID y control de entradas"),
    ("Sensores inteligentes", "Movimiento, apertura, humo, gas y ambientales"),
    ("Redes y conectividad IoT", "WiFi, Zigbee, Z-Wave y hubs IoT"),
    ("Climatización inteligente", "Termostatos y aire acondicionado inteligente"),
    ("Audio y video inteligente", "Multirroom, soundbars y videoporteros"),
    ("Integración de dispositivos domóticos", "Compatibilización de ecosistemas y plataformas"),
    ("Mantenimiento de sistemas domóticos", "Diagnóstico, actualización y soporte"),
]


COLLATE = "utf8mb4_unicode_ci"
MYSQL_KW = {"mysql_charset": "utf8mb4", "mysql_collate": COLLATE}


def upgrade() -> None:
    if not _tabla_existe("especializaciones"):
        op.create_table(
            "especializaciones",
            sa.Column("id_especializacion", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("nombre", sa.String(100), nullable=False, unique=True),
            sa.Column("descripcion", sa.String(255), nullable=True),
            sa.Column("activa", sa.Boolean, nullable=False, server_default=sa.text("1")),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
            **MYSQL_KW,
        )

    if not _tabla_existe("tecnico_especializacion"):
        op.create_table(
            "tecnico_especializacion",
            sa.Column(
                "id_tecnico",
                sa.Integer,
                sa.ForeignKey("tecnicos.id_tecnico", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column(
                "id_especializacion",
                sa.Integer,
                sa.ForeignKey("especializaciones.id_especializacion", ondelete="CASCADE"),
                primary_key=True,
            ),
            **MYSQL_KW,
        )

    if not _tabla_existe("producto_especializacion"):
        op.create_table(
            "producto_especializacion",
            sa.Column(
                "id_producto",
                sa.Integer,
                sa.ForeignKey("productos.id_producto", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column(
                "id_especializacion",
                sa.Integer,
                sa.ForeignKey("especializaciones.id_especializacion", ondelete="CASCADE"),
                primary_key=True,
            ),
            **MYSQL_KW,
        )

    if not _columna_existe("productos", "dificultad_instalacion"):
        op.add_column(
            "productos",
            sa.Column("dificultad_instalacion", sa.String(10), nullable=True),
        )
    if not _columna_existe("productos", "tiempo_estimado_horas"):
        op.add_column(
            "productos",
            sa.Column("tiempo_estimado_horas", sa.Float, nullable=True),
        )
    if not _columna_existe("citas", "id_especializacion"):
        op.add_column(
            "citas",
            sa.Column(
                "id_especializacion",
                sa.Integer,
                sa.ForeignKey(
                    "especializaciones.id_especializacion", ondelete="SET NULL"
                ),
                nullable=True,
            ),
        )

    if not _tabla_existe("historial_citas"):
        op.create_table(
            "historial_citas",
            sa.Column("id_historial", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column(
                "id_cita",
                sa.Integer,
                sa.ForeignKey("citas.id_cita", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("accion", sa.String(50), nullable=False),
            sa.Column("tecnico_anterior_id", sa.Integer, nullable=True),
            sa.Column("tecnico_anterior_nombre", sa.String(150), nullable=True),
            sa.Column("tecnico_nuevo_id", sa.Integer, nullable=True),
            sa.Column("tecnico_nuevo_nombre", sa.String(150), nullable=True),
            sa.Column("administrador_id", sa.Integer, nullable=True),
            sa.Column("motivo", sa.String(255), nullable=True),
            sa.Column("detalle", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
            **MYSQL_KW,
        )

    if not _tabla_existe("reembolsos"):
        op.create_table(
            "reembolsos",
            sa.Column("id_reembolso", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column(
                "id_cita",
                sa.Integer,
                sa.ForeignKey("citas.id_cita", ondelete="SET NULL"),
                nullable=True,
                index=True,
            ),
            sa.Column(
                "id_pedido",
                sa.Integer,
                sa.ForeignKey("pedidos.id_pedido", ondelete="SET NULL"),
                nullable=True,
                index=True,
            ),
            sa.Column("monto", sa.Float, nullable=False, server_default=sa.text("0")),
            sa.Column("estado", sa.String(20), nullable=False, server_default="Pendiente"),
            sa.Column("motivo", sa.String(255), nullable=True),
            sa.Column("numero_transaccion_original", sa.String(120), nullable=True),
            sa.Column("numero_transaccion_reembolso", sa.String(120), nullable=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
            sa.Column("procesado_at", sa.DateTime, nullable=True),
            **MYSQL_KW,
        )

    # ── Seed del catálogo ────────────────────────────────────────
    bind = op.get_bind()
    for nombre, descripcion in CATALOGO:
        bind.execute(
            sa.text(
                "INSERT IGNORE INTO especializaciones (nombre, descripcion, activa) "
                "VALUES (:nombre, :descripcion, 1)"
            ),
            {"nombre": nombre, "descripcion": descripcion},
        )

    # ── Migrar certificacion_t existente al M2M (best effort) ────
    bind.execute(
        sa.text(
            "INSERT IGNORE INTO tecnico_especializacion (id_tecnico, id_especializacion) "
            "SELECT t.id_tecnico, e.id_especializacion "
            "FROM tecnicos t JOIN especializaciones e "
            "ON LOWER(TRIM(t.certificacion_t)) COLLATE utf8mb4_unicode_ci "
            "= LOWER(e.nombre) COLLATE utf8mb4_unicode_ci "
            "WHERE t.certificacion_t IS NOT NULL AND TRIM(t.certificacion_t) <> ''"
        )
    )


def downgrade() -> None:
    if _tabla_existe("reembolsos"):
        op.drop_table("reembolsos")
    if _tabla_existe("historial_citas"):
        op.drop_table("historial_citas")
    if _columna_existe("citas", "id_especializacion"):
        op.drop_column("citas", "id_especializacion")
    if _columna_existe("productos", "tiempo_estimado_horas"):
        op.drop_column("productos", "tiempo_estimado_horas")
    if _columna_existe("productos", "dificultad_instalacion"):
        op.drop_column("productos", "dificultad_instalacion")
    if _tabla_existe("producto_especializacion"):
        op.drop_table("producto_especializacion")
    if _tabla_existe("tecnico_especializacion"):
        op.drop_table("tecnico_especializacion")
    if _tabla_existe("especializaciones"):
        op.drop_table("especializaciones")
