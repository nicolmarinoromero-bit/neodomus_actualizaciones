"""
Módulo: models/notificacion.py

Tabla: notificaciones
Descripción: Notificación de plataforma dirigida a un usuario o cliente. Es la fuente de verdad de notificaciones in-app; el estado leído se almacena aquí para consistencia entre dispositivos.

Campos clave:
  - id_notificacion: int (PK)
  - id_usuario: int (FK → usuarios, opcional)
  - id_cliente: int (FK → clientes, opcional)
  - tipo: String(30) (sistema | pedido | cita, etc.)
  - titulo: String(150) (asunto de la notificación)
  - mensaje: String(500) (cuerpo del mensaje)
  - leida: Boolean (si ya fue leída)

Relaciones:
  (sin relationship declarados)
"""
from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class Notificacion(Base):
    """Notificación de plataforma dirigida a un usuario o cliente.

    Es la fuente de verdad de las notificaciones dentro de la app: se crea en
    los mismos eventos donde se envía el correo y el frontend la consulta para
    la campana y el panel. El estado leida se guarda aquí (no en el navegador),
    así que es consistente entre dispositivos.
    """

    __tablename__ = "notificaciones"

    id_notificacion: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_usuario: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("usuarios.id_usuario"), nullable=True, index=True
    )
    id_cliente: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("clientes.id_cliente"), nullable=True, index=True
    )
    tipo: Mapped[str] = mapped_column(String(30), nullable=False, default="sistema")
    titulo: Mapped[str] = mapped_column(String(150), nullable=False)
    mensaje: Mapped[str] = mapped_column(String(500), nullable=False)
    leida: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )