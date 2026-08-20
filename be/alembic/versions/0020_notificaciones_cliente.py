"""notificaciones: id_usuario nullable + id_cliente para clientes

Revision ID: 0020
Revises: 0019
Create Date: 2026-08-17

Agrega:
- id_cliente en notificaciones (nullable, FK a clientes).
- Hace id_usuario nullable en notificaciones (antes era NOT NULL).

Permite notificar a clientes dentro de la plataforma además de correo.

Idempotente.
"""
from alembic import op
import sqlalchemy as sa


revision = "0020"
down_revision = "0019"
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


def upgrade() -> None:
    # Hace id_usuario nullable (antes era NOT NULL).
    op.alter_column(
        "notificaciones", "id_usuario",
        type_=sa.Integer, nullable=True,
    )

    if not _columna_existe("notificaciones", "id_cliente"):
        op.add_column(
            "notificaciones",
            sa.Column("id_cliente", sa.Integer, nullable=True),
        )
        op.create_foreign_key(
            "fk_notificaciones_id_cliente",
            "notificaciones", "clientes",
            ["id_cliente"], ["id_cliente"],
        )


def downgrade() -> None:
    if _columna_existe("notificaciones", "id_cliente"):
        op.drop_constraint("fk_notificaciones_id_cliente", "notificaciones", type_="foreignkey")
        op.drop_column("notificaciones", "id_cliente")

    op.alter_column(
        "notificaciones", "id_usuario",
        type_=sa.Integer, nullable=False,
    )
