"""calificaciones de producto de cambio en devoluciones

Crea la tabla ``calificaciones_producto_cambio`` para que el cliente pueda
calificar (1-5 estrellas) el producto nuevo entregado por el técnico en una
devolución resuelta como 'Cambio' (una vez confirmada la entrega con
evidencia).

Revision ID: 0046
Revises: 0045
Create Date: 2026-08-26
"""

from alembic import op
import sqlalchemy as sa


revision = "0046"
down_revision = "0045"
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
    if _tabla_existe("calificaciones_producto_cambio"):
        return
    op.create_table(
        "calificaciones_producto_cambio",
        sa.Column("id_calificacion_cambio", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "id_cliente_cc",
            sa.Integer(),
            sa.ForeignKey("clientes.id_cliente"),
            nullable=False,
        ),
        sa.Column(
            "id_devolucion_cc",
            sa.Integer(),
            sa.ForeignKey("devoluciones.id_devolucion"),
            nullable=False,
        ),
        sa.Column(
            "id_producto_cc",
            sa.Integer(),
            sa.ForeignKey("productos.id_producto"),
            nullable=False,
        ),
        sa.Column("calificacion", sa.SmallInteger(), nullable=False),
        sa.Column("comentario", sa.Text(), nullable=True),
        sa.Column("foto_url", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_calificaciones_producto_cambio_id_cliente_cc",
        "calificaciones_producto_cambio",
        ["id_cliente_cc"],
    )
    op.create_index(
        "ix_calificaciones_producto_cambio_id_devolucion_cc",
        "calificaciones_producto_cambio",
        ["id_devolucion_cc"],
    )
    op.create_index(
        "ix_calificaciones_producto_cambio_id_producto_cc",
        "calificaciones_producto_cambio",
        ["id_producto_cc"],
    )


def downgrade() -> None:
    if not _tabla_existe("calificaciones_producto_cambio"):
        return
    op.drop_table("calificaciones_producto_cambio")