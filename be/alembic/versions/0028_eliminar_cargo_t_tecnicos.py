"""elimina la columna cargo_t de tecnicos (nivel Junior/Semi Senior/Senior)

Revision ID: 0028
Revises: 0027
Create Date: 2026-08-21
"""

from alembic import op
import sqlalchemy as sa

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("tecnicos", "cargo_t")


def downgrade() -> None:
    op.add_column(
        "tecnicos",
        sa.Column("cargo_t", sa.String(50), nullable=True),
    )
