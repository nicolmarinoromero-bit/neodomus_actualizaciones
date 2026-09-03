"""
Módulo: models/producto_medida.py

Tabla: producto_medidas
Descripción: Medidas vendibles por longitud para productos de cableado
y similares. Cada medida tiene su propio stock independiente, precio
opcional y estado bloqueado cuando llega a 0.

Campos clave:
  - id: int (PK)
  - id_producto: int (FK → productos, cascade)
  - metros: float (longitud, ej. 1, 5, 10, 20, 50, 100)
  - stock: int (unidades disponibles de ESA medida)
  - precio: Float (NULL = usa precio del producto)
  - activa: bool (deshabilitada si stock 0, pero se mantiene visible)

Relaciones:
  - producto → Producto
"""
from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class ProductoMedida(Base):
    __tablename__ = "producto_medidas"
    __table_args__ = (
        UniqueConstraint("id_producto", "metros", name="uq_producto_metros"),
    )

    id = Column(Integer, primary_key=True, index=True)
    id_producto = Column(
        Integer,
        ForeignKey("productos.id_producto", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    metros = Column(Float, nullable=False)
    stock = Column(Integer, nullable=False, default=0)
    precio = Column(Float, nullable=True)
    activa = Column(Boolean, nullable=False, default=True)

    producto = relationship("Producto", back_populates="medidas")
