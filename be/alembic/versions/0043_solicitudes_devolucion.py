"""solicitudes de devolucion (cabecera) + cantidad por linea

Crea la tabla ``solicitudes_devolucion`` que agrupa una o varias lineas de
la tabla ``devoluciones`` (una por producto y cantidad), habilitando
devoluciones parciales por unidad. Las devoluciones existentes se migran:
cada fila genera una solicitud individual vinculada.

Revision ID: 0043
Revises: 0042
Create Date: 2026-08-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0043"
down_revision = "0042"
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


def _indice_existe(tabla: str, indice: str) -> bool:
    bind = op.get_bind()
    existe = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.STATISTICS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tabla "
            "AND INDEX_NAME = :indice"
        ),
        {"tabla": tabla, "indice": indice},
    ).scalar()
    return bool(existe)


def upgrade() -> None:
    if not _tabla_existe("solicitudes_devolucion"):
        op.create_table(
            "solicitudes_devolucion",
            sa.Column("id_solicitud", sa.Integer(), autoincrement=True, primary_key=True),
            sa.Column("numero", sa.String(20), nullable=False, unique=True),
            sa.Column(
                "id_cliente_s",
                sa.Integer(),
                sa.ForeignKey("clientes.id_cliente"),
                nullable=False,
            ),
            sa.Column(
                "id_pedido_s",
                sa.Integer(),
                sa.ForeignKey("pedidos.id_pedido"),
                nullable=True,
            ),
            sa.Column("motivo_tipo", sa.String(40), nullable=True),
            sa.Column("motivo_otro", sa.Text(), nullable=True),
            sa.Column("comentario", sa.Text(), nullable=True),
            sa.Column("estado", sa.String(30), nullable=False, server_default="Solicitada"),
            sa.Column("tipo_devolucion", sa.String(10), nullable=False, server_default="parcial"),
            sa.Column("monto_total", sa.Float(), nullable=False, server_default="0"),
            sa.Column("resolucion", sa.String(20), nullable=True),
            sa.Column("motivo_rechazo", sa.Text(), nullable=True),
            sa.Column("observaciones_admin", sa.Text(), nullable=True),
            sa.Column("resuelta_por", sa.Integer(), nullable=True),
            sa.Column("resuelta_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            mysql_charset="utf8mb4",
            mysql_collate="utf8mb4_unicode_ci",
        )
        op.create_index(
            "ix_solicitudes_devolucion_id_cliente_s",
            "solicitudes_devolucion",
            ["id_cliente_s"],
        )
        op.create_index(
            "ix_solicitudes_devolucion_id_pedido_s",
            "solicitudes_devolucion",
            ["id_pedido_s"],
        )
        op.create_index(
            "ix_solicitudes_devolucion_estado",
            "solicitudes_devolucion",
            ["estado"],
        )

    if not _columna_existe("devoluciones", "cantidad"):
        op.add_column(
            "devoluciones",
            sa.Column("cantidad", sa.Integer(), nullable=False, server_default="1"),
        )
    if not _columna_existe("devoluciones", "id_solicitud_dv"):
        op.add_column(
            "devoluciones",
            sa.Column("id_solicitud_dv", sa.Integer(), nullable=True),
        )
    if not _indice_existe("devoluciones", "ix_devoluciones_id_solicitud_dv"):
        op.create_index(
            "ix_devoluciones_id_solicitud_dv",
            "devoluciones",
            ["id_solicitud_dv"],
        )

    # ── Backfill: una solicitud por cada devolución previa ──────────
    bind = op.get_bind()
    huérfanas = bind.execute(
        sa.text(
            "SELECT d.* FROM devoluciones d "
            "LEFT JOIN solicitudes_devolucion s ON s.id_solicitud = d.id_solicitud_dv "
            "WHERE d.id_solicitud_dv IS NULL"
        )
    ).mappings().all()

    for d in huérfanas:
        estado_legacy = (d["estado"] or "Pendiente").capitalize()
        recogida = d["recogida_estado"] or ""
        resolucion = d["resolucion"]
        if estado_legacy == "Aprobada":
            nuevo_estado = (
                "Reembolso procesado"
                if (resolucion or "") == "Reembolso" and recogida == "Recogida"
                else ("Recibida" if recogida == "Recogida" else "Producto en devolución")
            )
        elif estado_legacy == "Rechazada":
            nuevo_estado = "Rechazada"
        else:
            nuevo_estado = "Solicitada"

        monto = 0.0
        if d["id_pedido_d"] and d["id_producto_d"]:
            fila = bind.execute(
                sa.text(
                    "SELECT subtotal_detalle FROM detalle_pedido "
                    "WHERE id_pedido_d = :p AND id_producto_d = :pr LIMIT 1"
                ),
                {"p": d["id_pedido_d"], "pr": d["id_producto_d"]},
            ).scalar()
            monto = float(fila or 0)

        numero = f"DEV-{int(d['id_devolucion']):06d}"
        existente = bind.execute(
            sa.text(
                "SELECT id_solicitud FROM solicitudes_devolucion WHERE numero = :n"
            ),
            {"n": numero},
        ).scalar()
        if existente:
            numero = f"DEV-{int(d['id_devolucion']):06d}-{d['id_devolucion']}"

        res = bind.execute(
            sa.text(
                "INSERT INTO solicitudes_devolucion "
                "(numero, id_cliente_s, id_pedido_s, motivo_tipo, motivo_otro, comentario, "
                " estado, tipo_devolucion, monto_total, resolucion, resuelta_por, resuelta_at, created_at)"
                " VALUES (:numero, :cli, :ped, 'otro', :motivo, NULL, :estado, :tipo, :monto, "
                " :resolucion, :resuelta_por, :resuelta_at, :created_at)"
            ),
            {
                "numero": numero,
                "cli": d["id_cliente_d"],
                "ped": d["id_pedido_d"],
                "motivo": d["motivo"],
                "estado": nuevo_estado,
                "tipo": "parcial",
                "monto": round(monto, 2),
                "resolucion": resolucion,
                "resuelta_por": d["resuelta_por"],
                "resuelta_at": d["resuelta_at"],
                "created_at": d["created_at"],
            },
        )
        bind.execute(
            sa.text(
                "UPDATE devoluciones SET id_solicitud_dv = :sid WHERE id_devolucion = :did"
            ),
            {"sid": res.lastrowid, "did": d["id_devolucion"]},
        )


def downgrade() -> None:
    if _columna_existe("devoluciones", "id_solicitud_dv"):
        if _indice_existe("devoluciones", "ix_devoluciones_id_solicitud_dv"):
            op.drop_index("ix_devoluciones_id_solicitud_dv", table_name="devoluciones")
        op.drop_column("devoluciones", "id_solicitud_dv")
    if _columna_existe("devoluciones", "cantidad"):
        op.drop_column("devoluciones", "cantidad")
    if _tabla_existe("solicitudes_devolucion"):
        op.drop_table("solicitudes_devolucion")
