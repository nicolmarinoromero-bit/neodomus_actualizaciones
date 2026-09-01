"""
Módulo: models/calificacion_producto.py

Tabla: calificaciones_producto
Descripción: Calificación (1-5 estrellas + comentario + foto opcional) que el cliente da a un producto recibido, disponible cuando el pedido quedó Entregado.

Campos clave:
  - id_calificacion_producto: int (PK)
  - id_cliente_cp: int (FK → clientes)
  - id_pedido_cp: int (FK → pedidos)
  - id_producto_cp: int (FK → productos)
  - calificacion: SmallInteger (puntuación 1-5)
  - foto_url: String (imagen opcional de la experiencia)

Relaciones:
  - cliente → Cliente (quien califica)
  - pedido → Pedido (pedido asociado)
  - producto → Producto (producto calificado)
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CalificacionProducto(Base):
    """Calificación (1-5 estrellas + comentario + foto opcional) que el
    cliente da a un producto recibido, disponible cuando el pedido quedó
    Entregado."""

    __tablename__ = "calificaciones_producto"

    id_calificacion_producto: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    id_cliente_cp: Mapped[int] = mapped_column(
        ForeignKey("clientes.id_cliente"), nullable=False, index=True
    )
    id_pedido_cp: Mapped[int] = mapped_column(
        ForeignKey("pedidos.id_pedido"), nullable=False, index=True
    )
    id_producto_cp: Mapped[int] = mapped_column(
        ForeignKey("productos.id_producto"), nullable=False, index=True
    )
    calificacion: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comentario: Mapped[str | None] = mapped_column(Text, nullable=True)
    foto_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
