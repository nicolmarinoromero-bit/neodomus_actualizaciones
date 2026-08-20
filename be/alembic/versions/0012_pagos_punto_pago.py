"""agrega columnas de punto de pago a la tabla pagos

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-14

Agrega a pagos las columnas que el modelo Pago ya usa para el pago en
punto físico (Efecty/Servientrega):
- pagos.punto_pago          -> punto de pago seleccionado
- pagos.referencia_pago     -> referencia ficticia tipo NEODOMUS-YYYY-######
- pagos.fecha_limite_pago   -> fecha límite de vigencia del pago pendiente

Es idempotente: cada columna se agrega solo si no existe.
"""
from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
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
    cambios = [
        ("punto_pago", "VARCHAR(50) NULL"),
        ("referencia_pago", "VARCHAR(50) NULL"),
        ("fecha_limite_pago", "DATETIME NULL"),
    ]
    for columna, definicion in cambios:
        if not _columna_existe("pagos", columna):
            op.execute(f"ALTER TABLE pagos ADD COLUMN {columna} {definicion}")


def downgrade() -> None:
    for columna, _ in (
        ("punto_pago", "VARCHAR(50) NULL"),
        ("referencia_pago", "VARCHAR(50) NULL"),
        ("fecha_limite_pago", "DATETIME NULL"),
    ):
        if _columna_existe("pagos", columna):
            op.execute(f"ALTER TABLE pagos DROP COLUMN {columna}")
