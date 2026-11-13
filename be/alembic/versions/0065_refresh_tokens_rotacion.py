"""rotacion y revocacion de refresh tokens

Crea la tabla ``refresh_tokens`` que respalda la rotación de tokens de
refresco en servidor:

- ``jti``: identificador único del token (claim estándar JWT).
- ``family_id``: agrupa los tokens de una misma sesión/dispositivo; al
  detectar reuso de un token ya rotado se revoca toda la familia.
- ``user_id``/``user_type``: identidad polimórfica (empleado o cliente).
  No se usa clave foránea porque la tabla referencia dos entidades
  distintas y se apoya en el tipo de usuario.
- ``revoked_at``/``revoked_reason``/``replaced_by_jti``: trazabilidad de
  la rotación y la revocación.

Migración aditiva: no modifica tablas ni registros existentes.

Revision ID: 0065
Revises: 0064
Create Date: 2026-11-12
"""
from alembic import op
import sqlalchemy as sa


revision = "0065"
down_revision = "0064"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("jti", sa.String(64), nullable=False),
        sa.Column("family_id", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("user_type", sa.String(20), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_reason", sa.String(32), nullable=True),
        sa.Column("replaced_by_jti", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_refresh_tokens_jti", "refresh_tokens", ["jti"], unique=True)
    op.create_index("ix_refresh_tokens_family_id", "refresh_tokens", ["family_id"])
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_family_id", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_jti", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
