"""marcas, venta por metros y precios reales de productos

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-09

Poblado de datos comerciales sobre productos (las columnas ya existen desde 0002):
- productos.marca            -> marca comercial de cada producto
- productos.venta_por_metros -> se marca 1 para los vendibles por longitud (cable y cinta LED)
- precios de compra/venta    -> valores de mercado actualizados
- descripcion_producto       -> descripciones de los productos por metros

Es idempotente: las actualizaciones se hacen por referencia_producto y solo
afectan filas que cumplen la condicion, por lo que puede ejecutarse varias veces.
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

# referencia_producto -> (marca, venta_por_metros, precio_compra, precio_venta)
_PRODUCTOS = {
    "smi-001": ("Hikvision", 0, 52000.00, 82000.00),
    "ccd-004": ("Fibaro", 0, 190000.00, 285000.00),
    "led-003": ("Ledvance", 1, 7000.00, 14000.00),
    "kit-001": ("Aqara", 0, 175000.00, 260000.00),
    "utp6-050": ("Steren", 1, 2100.00, 3500.00),
    "spd-006": ("Aqara", 0, 30000.00, 45000.00),
    "eiw-007": ("TP-Link", 0, 46000.00, 69000.00),
    "ps12-5a": ("Twinsol", 0, 39000.00, 58000.00),
    "cip-003": ("Hikvision", 0, 165000.00, 245000.00),
    "bat18650": ("Xtar", 0, 11000.00, 18000.00),
    "ter-101": ("Honeywell", 0, 100000.00, 155000.00),
    "int-202": ("Sonoff", 0, 43000.00, 65000.00),
    "sir-303": ("Bosch", 0, 62000.00, 95000.00),
    "dhu-404": ("Kidde", 0, 55000.00, 85000.00),
    "per-505": ("Somfy", 0, 255000.00, 380000.00),
    "pan-606": ("Fibaro", 0, 600000.00, 890000.00),
}

_DESCRIPCIONES = {
    "utp6-050": "Cable UTP Cat6 blindado para redes de alta velocidad. Venta por metros: elige el color y la longitud que necesitas.",
    "led-003": "Cinta LED RGB con control por app y 16 millones de colores. Venta por metros: elige la longitud que necesitas.",
}


def upgrade() -> None:
    bind = op.get_bind()
    for referencia, (marca, metros, compra, venta) in _PRODUCTOS.items():
        bind.execute(
            sa.text(
                "UPDATE productos SET marca = :marca, venta_por_metros = :metros, "
                "precio_compra_producto = :compra, precio_venta_producto = :venta "
                "WHERE referencia_producto = :ref"
            ),
            {
                "marca": marca,
                "metros": metros,
                "compra": compra,
                "venta": venta,
                "ref": referencia,
            },
        )
    for referencia, descripcion in _DESCRIPCIONES.items():
        bind.execute(
            sa.text(
                "UPDATE productos SET descripcion_producto = :descripcion "
                "WHERE referencia_producto = :ref"
            ),
            {"descripcion": descripcion, "ref": referencia},
        )


def downgrade() -> None:
    # Restaura precios del seed original (0001) y quita metros/marcas.
    bind = op.get_bind()
    _ORIGINAL = {
        "smi-001": (None, 0, 45000.00, 70000.00),
        "ccd-004": (None, 0, 90000.00, 160000.00),
        "led-003": (None, 0, 12000.00, 20000.00),
        "kit-001": (None, 0, 100000.00, 180000.00),
        "utp6-050": (None, 0, 3000.00, 6000.00),
        "spd-006": (None, 0, 25000.00, 39000.00),
        "eiw-007": (None, 0, 34000.00, 58000.00),
        "ps12-5a": (None, 0, 28000.00, 50000.00),
        "cip-003": (None, 0, 120000.00, 170000.00),
        "bat18650": (None, 0, 5000.00, 10000.00),
        "ter-101": (None, 0, 75000.00, 125000.00),
        "int-202": (None, 0, 32000.00, 55000.00),
        "sir-303": (None, 0, 45000.00, 80000.00),
        "dhu-404": (None, 0, 38000.00, 69000.00),
        "per-505": (None, 0, 120000.00, 210000.00),
        "pan-606": (None, 0, 250000.00, 420000.00),
    }
    for referencia, (marca, metros, compra, venta) in _ORIGINAL.items():
        bind.execute(
            sa.text(
                "UPDATE productos SET marca = :marca, venta_por_metros = :metros, "
                "precio_compra_producto = :compra, precio_venta_producto = :venta "
                "WHERE referencia_producto = :ref"
            ),
            {
                "marca": marca,
                "metros": metros,
                "compra": compra,
                "venta": venta,
                "ref": referencia,
            },
        )
