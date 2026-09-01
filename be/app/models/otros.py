"""
Módulo: models/otros.py

Tabla: tipos_documento / comisiones
Descripción: Tablas auxiliares: catálogo de tipos de documento de identidad y configuración de comisiones por servicio.

Campos clave (tipos_documento):
  - id_tipo_documento: int (PK)
  - nombre_tipo: String(2) (CC, TI, CE, etc.)

Campos clave (comisiones):
  - id_comision: int (PK)
  - porcentaje_comision: Numeric(5,2) (porcentaje aplicado)
  - valor_comision: Numeric(10,2) (valor fijo)

Relaciones:
  (sin relationship declarados)
"""
from sqlalchemy import Column, Integer, Numeric, String
from ..database import Base

class TipoDocumento(Base):
    __tablename__ = "tipos_documento"
    id_tipo_documento = Column(Integer, primary_key=True, autoincrement=True)
    nombre_tipo = Column(String(2))


class Comision(Base):
    __tablename__ = "comisiones"
    id_comision = Column(Integer, primary_key=True, autoincrement=True)
    porcentaje_comision = Column(Numeric(5, 2))
    valor_comision = Column(Numeric(10, 2))