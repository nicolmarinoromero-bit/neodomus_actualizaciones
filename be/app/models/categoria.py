"""
Módulo: models/categoria.py

Tabla: categorias
Descripción: Catálogo de categorías de productos (ej. domótica, iluminación, seguridad) para organizar el catálogo.

Campos clave:
  - id_categoria: int (PK)
  - nombre_categoria: String(50) (nombre único de la categoría)
  - descripcion: String(200) (descripción opcional)

Relaciones:
  - productos → Producto (listado de productos en esta categoría)
"""
from sqlalchemy import Column, Integer, String
from app.database import Base

class Categoria(Base):
    __tablename__ = "categorias"
    id_categoria = Column(Integer, primary_key=True, index=True)
    nombre_categoria = Column(String(50), nullable=False)
    descripcion = Column(String(200))