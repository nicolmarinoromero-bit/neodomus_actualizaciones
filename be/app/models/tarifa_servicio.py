"""
Módulo: models/tarifa_servicio.py

Tabla: tarifas_servicio
Descripción: Tarifa fija configurable por tipo de servicio para citas de servicio técnico.

Campos clave:
  - id_tarifa: int (PK)
  - tipo_servicio: String(30) (nombre único del tipo de servicio)
  - costo: Numeric(12,2) (costo fijo del servicio)
  - descripcion: String(150) (descripción opcional)

Relaciones:
  (sin relationship declarados)
"""
from decimal import Decimal

from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class TarifaServicio(Base):
    """Tarifa fija configurable por tipo de servicio para citas."""

    __tablename__ = "tarifas_servicio"

    id_tarifa: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tipo_servicio: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    costo: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(150), nullable=True)
