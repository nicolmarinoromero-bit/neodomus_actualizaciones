"""
Módulo: models/pedido.py

Tabla: pedidos / detalle_pedido
Descripción: Pedido de compra del cliente con sus líneas de detalle (productos, cantidades, precios). Incluye gestión de entrega y asignación de técnico.

Campos clave (pedidos):
  - id_pedido: int (PK)
  - id_cliente_pe: int (FK → clientes)
  - total_pedido: Float (total del pedido)
  - estado_pedido: String(50) (Pendiente | Pagado | Enviado | Entregado)
  - fecha_entrega: Date (fecha programada de entrega)
  - id_tecnico_entrega: int (técnico asignado para entrega)

Campos clave (detalle_pedido):
  - id_detalle: int (PK)
  - id_pedido_d: int (FK → pedidos)
  - id_producto_d: int (FK → productos)
  - cantidad_detalle: int (unidades)
  - precio_unitario_detalle: Float (precio unitario)
  - subtotal_detalle: Float (subtotal línea)

Relaciones:
  - cliente → Cliente (quien realizó el pedido)
  - detalles → DetallePedido (líneas del pedido)
  - tecnico_entrega → Tecnico (técnico que entrega)
"""
from datetime import datetime, date
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Pedido(Base):
    __tablename__ = "pedidos"

    id_pedido: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_cliente_pe: Mapped[int] = mapped_column(ForeignKey("clientes.id_cliente"), nullable=True)
    fecha_peedido: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    total_pedido: Mapped[float] = mapped_column(Float, nullable=True)
    estado_pedido: Mapped[str] = mapped_column(String(50), nullable=True)
    fecha_entrega: Mapped[date] = mapped_column(Date, nullable=True)
    hora_entrega: Mapped[str] = mapped_column(String(10), nullable=True)
    hora_entrega_fin: Mapped[str] = mapped_column(String(10), nullable=True)
    id_tecnico_entrega: Mapped[int] = mapped_column(Integer, nullable=True)
    nombre_tecnico_entrega: Mapped[str] = mapped_column(String(150), nullable=True)
    estado_entrega: Mapped[str] = mapped_column(String(20), nullable=True)
    entrega_actualizada_en: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    evidencia_entrega_url: Mapped[str] = mapped_column(String(255), nullable=True)
    latitud_cliente: Mapped[float] = mapped_column(Float, nullable=True)
    longitud_cliente: Mapped[float] = mapped_column(Float, nullable=True)

    cliente = relationship("Cliente", foreign_keys=[id_cliente_pe])
    detalles = relationship("DetallePedido", back_populates="pedido")
    tecnico_entrega = relationship(
        "Tecnico",
        foreign_keys=[id_tecnico_entrega],
        primaryjoin="Pedido.id_tecnico_entrega == Tecnico.id_tecnico",
    )


class DetallePedido(Base):
    __tablename__ = "detalle_pedido"

    id_detalle: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_pedido_d: Mapped[int] = mapped_column(ForeignKey("pedidos.id_pedido"), nullable=True)
    id_producto_d: Mapped[int] = mapped_column(ForeignKey("productos.id_producto"), nullable=True)
    id_servicio_d: Mapped[int] = mapped_column(Integer, nullable=True)
    id_comision_d: Mapped[int] = mapped_column(Integer, nullable=True)
    cantidad_detalle: Mapped[int] = mapped_column(Integer, nullable=True, default=1)
    cantidad_metros: Mapped[float] = mapped_column(Float, nullable=True)
    precio_unitario_detalle: Mapped[float] = mapped_column(Float, nullable=True)
    subtotal_detalle: Mapped[float] = mapped_column(Float, nullable=True)
    descripcion_detalle: Mapped[str] = mapped_column(Text, nullable=True)
    fecha_servicio: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    hora_servicio: Mapped[str] = mapped_column(String(5), nullable=True)
    direccion_servicio: Mapped[str] = mapped_column(String(200), nullable=True)

    pedido = relationship("Pedido", back_populates="detalles")
    producto = relationship("Producto", foreign_keys=[id_producto_d])