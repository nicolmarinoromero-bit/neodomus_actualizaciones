"""Google Sign-In: auth_provider, google_id en clientes

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-17

Agrega:
- auth_provider en clientes (default 'local')
- google_id en clientes (nullable, unique)
- Hace password_hash nullable en clientes (usuarios Google no tienen contraseña)

Idempotente.
"""
from alembic import op
import sqlalchemy as sa


revision = "0019"
down_revision = "0018"
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
    if not _columna_existe("clientes", "auth_provider"):
        op.add_column(
            "clientes",
            sa.Column("auth_provider", sa.String(20), nullable=False, server_default="local"),
        )

    if not _columna_existe("clientes", "google_id"):
        op.add_column(
            "clientes",
            sa.Column("google_id", sa.String(255), nullable=True),
        )
        op.create_unique_constraint("uq_clientes_google_id", "clientes", ["google_id"])

    # Hacer password_hash nullable para usuarios Google
    op.alter_column("clientes", "password_hash", type_=sa.String(255), nullable=True)


def downgrade() -> None:
    if _columna_existe("clientes", "google_id"):
        op.drop_constraint("uq_clientes_google_id", "clientes", type_="unique")
        op.drop_column("clientes", "google_id")

    if _columna_existe("clientes", "auth_provider"):
        op.drop_column("clientes", "auth_provider")

    op.alter_column("clientes", "password_hash", type_=sa.String(255), nullable=False)
