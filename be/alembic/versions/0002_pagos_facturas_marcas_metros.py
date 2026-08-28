"""pagos, facturas, marcas, venta por metros y detalle de pedido

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-09

Agrega al esquema NEODOMUS:
- productos.marca                    -> marca comercial del producto
- productos.venta_por_metros         -> el producto se vende por longitud (cables/luces)
- detalle_pedido.cantidad_metros     -> metros comprados del producto
- detalle_pedido.descripcion_detalle -> detalle de línea (servicio, metros, etc.)
- detalle_pedido.fecha_servicio      -> fecha relacionada con un servicio
- tabla pagos                        -> pagos simulados
- tabla facturas                     -> facturas generadas (con PDF y correo)

Es idempotente: usa ALTER TABLE ... ADD COLUMN protegido por sentencias
condicionales e IF NOT EXISTS para las tablas nuevas, de modo que puede
ejecutarse varias veces sin romper ni duplicar datos existentes.
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _columna_existe(bind, tabla: str, columna: str) -> bool:
    resultado = bind.execute(
        sa.text(
            f"SELECT COUNT(*) FROM information_schema.columns "
            f"WHERE table_schema = DATABASE() AND table_name = '{tabla}' "
            f"AND column_name = '{columna}'"
        )
    ).scalar()
    return bool(resultado)


def upgrade() -> None:
    bind = op.get_bind()

    # ── productos: marca y venta por metros ───────────────────────────
    if not _columna_existe(bind, "productos", "marca"):
        op.execute("ALTER TABLE productos ADD COLUMN marca VARCHAR(100) NULL AFTER nombre_producto")
    if not _columna_existe(bind, "productos", "venta_por_metros"):
        op.execute(
            "ALTER TABLE productos ADD COLUMN venta_por_metros TINYINT(1) NOT NULL DEFAULT 0 "
            "AFTER marca"
        )

    # ── detalle_pedido: metros, descripción y fecha de servicio ────────
    if not _columna_existe(bind, "detalle_pedido", "cantidad_metros"):
        op.execute("ALTER TABLE detalle_pedido ADD COLUMN cantidad_metros FLOAT NULL AFTER cantidad_detalle")
    if not _columna_existe(bind, "detalle_pedido", "descripcion_detalle"):
        op.execute("ALTER TABLE detalle_pedido ADD COLUMN descripcion_detalle TEXT NULL AFTER subtotal_detalle")
    if not _columna_existe(bind, "detalle_pedido", "fecha_servicio"):
        op.execute("ALTER TABLE detalle_pedido ADD COLUMN fecha_servicio DATETIME NULL AFTER descripcion_detalle")

    # ── tabla pagos ────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS pagos (
            id_pago INT AUTO_INCREMENT PRIMARY KEY,
            id_pedido INT NULL,
            metodo_pago VARCHAR(30) NOT NULL,
            estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
            numero_transaccion VARCHAR(50) NULL,
            monto DECIMAL(12,2) NOT NULL DEFAULT 0,
            banco VARCHAR(100) NULL,
            titular VARCHAR(150) NULL,
            ultimos_digitos VARCHAR(6) NULL,
            correo_paypal VARCHAR(150) NULL,
            codigo_punto_pago VARCHAR(30) NULL,
            fecha_pago DATETIME NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_pago_pedido (id_pedido)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )

    # ── tabla facturas ─────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS facturas (
            id_factura INT AUTO_INCREMENT PRIMARY KEY,
            id_pedido INT NOT NULL,
            numero_factura VARCHAR(30) NOT NULL,
            fecha_factura DATETIME NOT NULL,
            monto_total DECIMAL(12,2) NOT NULL,
            metodo_pago VARCHAR(30) NULL,
            estado_pago VARCHAR(20) NULL,
            numero_transaccion VARCHAR(50) NULL,
            pdf_path VARCHAR(255) NULL,
            enviada_por_correo TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_factura_numero (numero_factura),
            INDEX idx_factura_pedido (id_pedido)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS facturas")
    op.execute("DROP TABLE IF EXISTS pagos")
    bind = op.get_bind()
    if _columna_existe(bind, "detalle_pedido", "fecha_servicio"):
        op.execute("ALTER TABLE detalle_pedido DROP COLUMN fecha_servicio")
    if _columna_existe(bind, "detalle_pedido", "descripcion_detalle"):
        op.execute("ALTER TABLE detalle_pedido DROP COLUMN descripcion_detalle")
    if _columna_existe(bind, "detalle_pedido", "cantidad_metros"):
        op.execute("ALTER TABLE detalle_pedido DROP COLUMN cantidad_metros")
    if _columna_existe(bind, "productos", "venta_por_metros"):
        op.execute("ALTER TABLE productos DROP COLUMN venta_por_metros")
    if _columna_existe(bind, "productos", "marca"):
        op.execute("ALTER TABLE productos DROP COLUMN marca")
