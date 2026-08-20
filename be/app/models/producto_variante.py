from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class ProductoVariante(Base):
    """Variantes de color de un producto: nombre, color (hex), imagen propia
    y stock independiente. Un producto puede no tener variantes."""

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
    imagen_url = Column(String(255), nullable=True)
    stock = Column(Integer, nullable=False, default=0)

    producto = relationship("Producto", back_populates="variantes")