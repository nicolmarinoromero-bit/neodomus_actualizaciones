"""
Módulo: models/proveedor.py

Tabla: proveedores
Descripción: Directorio de proveedores de productos de domótica, con datos de contacto.

Campos clave:
  - id_proveedor: int (PK)
  - nombre_proveedor: String(100) (razón social)
  - contacto_proveedor: String(100) (persona de contacto)
  - telefono_proveedor: String(20) (teléfono)
  - correo_proveedor: String(100) (email único)
  - direccion_proveedor: String(150) (dirección física)

Relaciones:
  (sin relationship declarados)
"""
from sqlalchemy import Column, Integer, String
from app.database import Base

class Proveedor(Base):
    __tablename__ = "proveedores"
    id_proveedor = Column(Integer, primary_key=True, index=True)
    nombre_proveedor = Column(String(100))
    contacto_proveedor = Column(String(100))
    telefono_proveedor = Column(String(20))
    correo_proveedor = Column(String(100), unique=True)
    direccion_proveedor = Column(String(150))