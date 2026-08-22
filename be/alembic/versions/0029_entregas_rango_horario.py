"""rango horario para entregas de productos (hora_entrega_fin)

Revision ID: 0029
Revises: 0028
Create Date: 2026-08-21
"""

from alembic import op
import sqlalchemy as sa

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def _columna_existe(table: str, column: str) -> bool:
    bind = op.get_bind()
    res = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c"
        ),
        {"t": table, "c": column},
    ).scalar()
    return bool(res)


def upgrade() -> None:
    if not _columna_existe("pedidos", "hora_entrega_fin"):
        op.add_column(
            "pedidos",
            sa.Column("hora_entrega_fin", sa.String(10), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("pedidos", "hora_entrega_fin")
