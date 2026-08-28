"""entregas: seguimiento, ubicación GPS, calificación de productos y devoluciones

Revision ID: 0026
Revises: 0025
Create Date: 2026-08-21

Agrega:
- tabla `calificaciones_producto` (1-5 estrellas + comentario por producto).
- tabla `ubicaciones_tecnico` (última posición GPS real del técnico).
- tabla `devoluciones` (solicitudes del cliente desde la calificación).
- columna `pedidos.entrega_actualizada_en` (último cambio de estado_entrega).

Idempotente y sin pérdida de datos.
"""
from alembic import op
import sqlalchemy as sa


revision = "0026"
down_revision = "0025"
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


COLLATE = "utf8mb4_unicode_ci"
MYSQL_KW = {"mysql_charset": "utf8mb4", "mysql_collate": COLLATE}


def upgrade() -> None:
    if not _tabla_existe("calificaciones_producto"):
        op.create_table(
            "calificaciones_producto",
            sa.Column("id_calificacion_producto", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column(
                "id_cliente_cp",
                sa.Integer,
                sa.ForeignKey("clientes.id_cliente"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "id_pedido_cp",
                sa.Integer,
                sa.ForeignKey("pedidos.id_pedido"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "id_producto_cp",
                sa.Integer,
                sa.ForeignKey("productos.id_producto"),
                nullable=False,
                index=True,
            ),
            sa.Column("calificacion", sa.SmallInteger, nullable=False),
            sa.Column("comentario", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
            **MYSQL_KW,
        )

    if not _tabla_existe("ubicaciones_tecnico"):
        op.create_table(
            "ubicaciones_tecnico",
            sa.Column("id_ubicacion", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column(
                "id_tecnico_ut",
                sa.Integer,
                sa.ForeignKey("tecnicos.id_tecnico", ondelete="CASCADE"),
                nullable=False,
                unique=True,
                index=True,
            ),
            sa.Column("latitud", sa.Float, nullable=False),
            sa.Column("longitud", sa.Float, nullable=False),
            sa.Column(
                "actualizado_en",
                sa.DateTime,
                server_default=sa.func.now(),
                nullable=True,
            ),
            **MYSQL_KW,
        )

    if not _tabla_existe("devoluciones"):
        op.create_table(
            "devoluciones",
            sa.Column("id_devolucion", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column(
                "id_cliente_d",
                sa.Integer,
                sa.ForeignKey("clientes.id_cliente"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "id_pedido_d",
                sa.Integer,
                sa.ForeignKey("pedidos.id_pedido"),
                nullable=True,
                index=True,
            ),
            sa.Column(
                "id_producto_d",
                sa.Integer,
                sa.ForeignKey("productos.id_producto"),
                nullable=True,
                index=True,
            ),
            sa.Column("motivo", sa.Text, nullable=True),
            sa.Column("estado", sa.String(20), nullable=False, server_default="Pendiente"),
            sa.Column("resuelta_por", sa.Integer, nullable=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
            sa.Column("resuelta_at", sa.DateTime, nullable=True),
            **MYSQL_KW,
        )

    if not _columna_existe("pedidos", "entrega_actualizada_en"):
        op.add_column(
            "pedidos",
            sa.Column("entrega_actualizada_en", sa.DateTime, nullable=True),
        )


def downgrade() -> None:
    if _columna_existe("pedidos", "entrega_actualizada_en"):
        op.drop_column("pedidos", "entrega_actualizada_en")
    if _tabla_existe("devoluciones"):
        op.drop_table("devoluciones")
    if _tabla_existe("ubicaciones_tecnico"):
        op.drop_table("ubicaciones_tecnico")
    if _tabla_existe("calificaciones_producto"):
        op.drop_table("calificaciones_producto")
