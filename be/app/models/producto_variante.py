"""
Módulo: models/producto_variante.py

Tabla: producto_variantes
Descripción: Variantes de color/tamaño de un producto: nombre, color (hex), dimensiones, precio propio estock independiente. Un producto puede no tener variantes.

Campos clave:
  - id: int (PK)
  - id_producto: int (FK → productos, cascade delete)
  - nombre: String(60) (nombre de la variante)
  - hex: String(10) (código de color #RRGGBB)
  - ancho_cm: int (ancho en centímetros)
  - alto_cm: int (alto en centímetros)
  - precio: Float (NULL = usa precio del producto)
  - stock: int (unidades disponibles)

Relaciones:
  - producto → Producto (producto padre)
"""
from sqlalchemy import Column, Float, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class ProductoVariante(Base):
    """Variantes de color/tamaño de un producto: nombre, color (hex), tamaño,
    precio propio (opcional; si es NULL usa el precio del producto), imagen
    propia y stock independiente. Un producto puede no tener variantes."""

    __tablename__ = "producto_variantes"

    id = Column(Integer, primary_key=True, index=True)
    id_producto = Column(
        Integer,
        ForeignKey("productos.id_producto", ondelete="CASCADE"),
        nullable=False,
    )
    nombre = Column(String(60), nullable=False)
    hex = Column(String(10), nullable=True)  # #RRGGBB
    tamaño = Column(String(60), nullable=True)
    ancho_cm = Column(Integer, nullable=True)
    alto_cm = Column(Integer, nullable=True)
    precio = Column(Float, nullable=True)  # None → usa el precio del producto
    imagen_url = Column(String(255), nullable=True)
    stock = Column(Integer, nullable=False, default=0)

    producto = relationship("Producto", back_populates="variantes")