"""tabla evidencias_entrega (múltiples fotos por pedido entregado)

Revision ID: 0034
Revises: 0033
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None

MYSQL_KW = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


def _tabla_existe(tabla: str) -> bool:
    bind = op.get_bind()
    existe = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.TABLES "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t"
        ),
        {"t": tabla},
    ).scalar()
    return bool(existe)


def upgrade() -> None:
    if not _tabla_existe("evidencias_entrega"):
        op.create_table(
            "evidencias_entrega",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column(
                "id_pedido",
                sa.Integer,
                sa.ForeignKey("pedidos.id_pedido", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("id_tecnico", sa.Integer, nullable=False),
            sa.Column("url_archivo", sa.String(255), nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
            **MYSQL_KW,
        )


def downgrade() -> None:
    if _tabla_existe("evidencias_entrega"):
        op.drop_table("evidencias_entrega")
