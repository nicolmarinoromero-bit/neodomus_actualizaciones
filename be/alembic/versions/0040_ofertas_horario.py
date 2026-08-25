"""tabla ofertas_horario: horarios liberados ofrecidos a clientes leales

Revision ID: 0040
Revises: 0039
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0040"
down_revision = "0039"
branch_labels = None
depends_on = None


def _tabla_existe(nombre: str) -> bool:
    bind = op.get_bind()
    existe = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.TABLES "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :n"
        ),
        {"n": nombre},
    ).scalar()
    return bool(existe)


def upgrade() -> None:
    if not _tabla_existe("ofertas_horario"):
        op.create_table(
            "ofertas_horario",
            sa.Column("id_oferta", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column(
                "id_cliente",
                sa.Integer,
                sa.ForeignKey("clientes.id_cliente", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("fecha", sa.Date, nullable=False),
            sa.Column("hora", sa.String(10), nullable=False),
            sa.Column("tipo_servicio", sa.String(30), nullable=False),
            sa.Column("id_tecnico", sa.Integer, nullable=False, index=True),
            sa.Column("nombre_tecnico", sa.String(150), nullable=True),
            sa.Column("puntaje", sa.Integer, nullable=False, server_default="0"),
            sa.Column("estado", sa.String(15), nullable=False, server_default="Ofrecida", index=True),
            sa.Column("expira_en", sa.DateTime, nullable=False, index=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("ofertas_horario")
