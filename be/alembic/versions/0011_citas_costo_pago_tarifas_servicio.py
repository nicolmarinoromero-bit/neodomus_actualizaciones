"""citas con costo/pago y tabla tarifas_servicio

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-13

Agrega al esquema NEODOMUS:
- citas.costo_cita           -> costo fijo de la tarifa del servicio
- citas.metodo_pago          -> método de pago seleccionado al agendar
- citas.estado_pago          -> estado del pago de la cita
- citas.numero_transaccion   -> número de transacción del proveedor de pago
- tabla tarifas_servicio     -> tarifas fijas configurables por tipo de servicio
  (con datos iniciales para instalacion, mantenimiento, reparacion y revision)

Es idempotente: usa sentencias condicionales para columnas e IF NOT EXISTS
para la tabla, de modo que puede ejecutarse varias veces sin romper nada.
"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None

_TABLE = "citas"
_COLUMNAS = ("costo_cita", "metodo_pago", "estado_pago", "numero_transaccion")

# Tarifas iniciales por tipo de servicio (mismos precios demo del checkout)
TARIFAS_INICIALES = [
    ("instalacion", 120000, "Instalación de equipos y cableado domótico"),
    ("mantenimiento", 80000, "Mantenimiento preventivo y soporte técnico"),
    ("reparacion", 90000, "Reparación y diagnóstico de equipos"),
    ("revision", 60000, "Revisión y supervisión técnica"),
    ("soporte", 70000, "Soporte técnico y asistencia"),
]


def _columna_existe(columna: str) -> bool:
    bind = op.get_bind()
    exists = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tabla "
            "AND COLUMN_NAME = :columna"
        ),
        {"tabla": _TABLE, "columna": columna},
    ).scalar()
    return bool(exists)


def upgrade() -> None:
    bind = op.get_bind()

    # ── citas: costo y datos de pago ────────────────────────────────────
    if not _columna_existe("costo_cita"):
        op.add_column(_TABLE, sa.Column("costo_cita", sa.Numeric(12, 2), nullable=True))
    if not _columna_existe("metodo_pago"):
        op.add_column(_TABLE, sa.Column("metodo_pago", sa.String(length=30), nullable=True))
    if not _columna_existe("estado_pago"):
        op.add_column(_TABLE, sa.Column("estado_pago", sa.String(length=20), nullable=True))
    if not _columna_existe("numero_transaccion"):
        op.add_column(_TABLE, sa.Column("numero_transaccion", sa.String(length=120), nullable=True))

    # ── tabla tarifas_servicio ──────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tarifas_servicio (
            id_tarifa INT AUTO_INCREMENT PRIMARY KEY,
            tipo_servicio VARCHAR(30) NOT NULL,
            costo DECIMAL(12,2) NOT NULL,
            descripcion VARCHAR(150) NULL,
            UNIQUE KEY uq_tarifa_tipo_servicio (tipo_servicio)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )

    # ── datos iniciales (solo si la tabla está vacía) ───────────────────
    total = bind.execute(sa.text("SELECT COUNT(*) FROM tarifas_servicio")).scalar()
    if not total:
        for tipo, costo, descripcion in TARIFAS_INICIALES:
            bind.execute(
                sa.text(
                    "INSERT INTO tarifas_servicio (tipo_servicio, costo, descripcion) "
                    "VALUES (:tipo, :costo, :descripcion)"
                ),
                {"tipo": tipo, "costo": costo, "descripcion": descripcion},
            )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS tarifas_servicio")
    for columna in _COLUMNAS:
        if _columna_existe(columna):
            op.drop_column(_TABLE, columna)