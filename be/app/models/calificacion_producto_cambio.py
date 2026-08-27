from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CalificacionProductoCambio(Base):
    """Calificación (1-5 estrellas + comentario) que el cliente da al
    producto de CAMBIO entregado por el técnico en una devolución resuelta
    como 'Cambio'. Cada devolución se califica una sola vez."""

    __tablename__ = "calificaciones_producto_cambio"

    id_calificacion_cambio: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    id_cliente_cc: Mapped[int] = mapped_column(
        ForeignKey("clientes.id_cliente"), nullable=False, index=True
    )
    id_devolucion_cc: Mapped[int] = mapped_column(
        ForeignKey("devoluciones.id_devolucion"), nullable=False, index=True
    )
    id_producto_cc: Mapped[int] = mapped_column(
        ForeignKey("productos.id_producto"), nullable=False, index=True
    )
    calificacion: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comentario: Mapped[str | None] = mapped_column(Text, nullable=True)
    foto_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )