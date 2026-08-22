from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Devolucion(Base):
    """Solicitud de devolución de un producto recibido, creada por el cliente
    desde la calificación del pedido entregado.

    Estados: Pendiente → Aprobada | Rechazada
    """

    __tablename__ = "devoluciones"

    id_devolucion: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    id_cliente_d: Mapped[int] = mapped_column(
        ForeignKey("clientes.id_cliente"), nullable=False, index=True
    )
    id_pedido_d: Mapped[int] = mapped_column(
        ForeignKey("pedidos.id_pedido"), nullable=True, index=True
    )
    id_producto_d: Mapped[int] = mapped_column(
        ForeignKey("productos.id_producto"), nullable=True, index=True
    )
    motivo: Mapped[str] = mapped_column(Text, nullable=True)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, server_default="Pendiente")
    resolucion: Mapped[str] = mapped_column(String(20), nullable=True)
    resuelta_por: Mapped[int] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    resuelta_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
