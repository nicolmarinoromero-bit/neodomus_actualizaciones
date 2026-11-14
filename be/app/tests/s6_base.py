"""Base común de las pruebas de integración de la Semana 6.

La Semana 6 del bootcamp trabaja contra el MySQL real de pruebas
(``neodomus_test``): las pruebas crean fixtures con SQLAlchemy, ejecutan los
endpoints HTTP reales y verifican el estado persistido. Esta base reutiliza
``BaseT1TestCase`` (cliente ASGI, login y creación de clientes/técnicos) y
añade utilidades para citas, pedidos, devoluciones y novedades, con limpieza
FK-safe en ``tearDown``.
"""
from __future__ import annotations

import time
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from app.tests.test_t1_identidad import BaseT1TestCase, PASSWORD

from app.models.cita import Cita
from app.models.cita_producto import CitaProducto
from app.models.devolucion import Devolucion
from app.models.especializacion import Especializacion, HistorialCita, Reembolso
from app.models.evidencia import Evidencia, EvidenciaEntrega
from app.models.factura import Factura
from app.models.novedad import (
    CuponDescuento,
    EvidenciaNovedad,
    Novedad,
    NovedadHistorial,
)
from app.models.oferta_horario import OfertaHorario
from app.models.otros import Comision
from app.models.pago import Pago
from app.models.pedido import DetallePedido, Pedido
from app.models.producto import Producto
from app.models.solicitud_devolucion import SolicitudDevolucion

# Franjas reales de la agenda (paso de 3 horas), no horas arbitrarias.
HORAS_VALIDAS = ("08:00", "11:00", "14:00", "17:00")


class BaseS6TestCase(BaseT1TestCase):
    """Fixtures y limpieza para las pruebas de integración S6."""

    def setUp(self):
        super().setUp()
        self._ids_comision: list[int] = []
        self._ids_oferta: list[int] = []
        self._ids_historial: list[int] = []
        self._ids_reembolso: list[int] = []
        self._ids_cita_producto: list[int] = []
        self._ids_pedido_extra: list[int] = []
        self._ids_pago: list[int] = []
        self._ids_factura: list[int] = []
        self._ids_producto: list[int] = []
        self._ids_devolucion: list[int] = []
        self._ids_solicitud_dv: list[int] = []
        self._ids_novedad: list[int] = []
        self._ids_cupon: list[int] = []
        self._ids_especializacion: list[int] = []
        self._emails_extra: list[str] = []

    # ── utilidades ────────────────────────────────────────────────────────
    def _email(self, prefijo):
        """Correo único por prueba (evita colisiones por reloj)."""
        return f"{prefijo}.{uuid.uuid4().hex[:12]}@neodomus.com"

    def _track_cita(self, cita_id: int) -> int:
        if cita_id not in self._ids_cita:
            self._ids_cita.append(cita_id)
        return cita_id

    def _track_pedido(self, pedido_id: int) -> int:
        if pedido_id not in self._ids_pedido_extra:
            self._ids_pedido_extra.append(pedido_id)
        return pedido_id

    def _proxima_laboral(self, dias_desde_hoy: int = 30) -> date:
        """Fecha futura laborable (lunes-sábado) a partir de hoy."""
        dia = date.today() + timedelta(days=dias_desde_hoy)
        while dia.weekday() == 6:  # domingo
            dia += timedelta(days=1)
        return dia

    def _datos_tarjeta(self) -> dict:
        return {
            "numero": "4242424242424242",
            "titular": "CLIENTE PRUEBA S6",
            "expiracion": "12/30",
            "cvv": "123",
        }

    def _crear_cita_bd(
        self,
        cliente,
        *,
        estado: str = "Confirmada",
        fecha: date | None = None,
        hora: str = "08:00",
        tipo_servicio: str = "mantenimiento",
        id_tecnico: int | None = None,
        costo: float = 80000,
        estado_pago: str | None = "aprobado",
        metodo_pago: str | None = "tarjeta_credito",
        **extra,
    ) -> Cita:
        cita = Cita(
            id_cliente=cliente.id_cliente,
            tipo_servicio=tipo_servicio,
            fecha=fecha or self._proxima_laboral(),
            hora=hora,
            direccion="Calle 100 # 15-20, Bogotá",
            descripcion="Cita creada por la suite S6",
            estado=estado,
            costo_cita=Decimal(str(costo)),
            metodo_pago=metodo_pago,
            estado_pago=estado_pago,
            id_tecnico=id_tecnico,
            **extra,
        )
        self.db.add(cita)
        self.db.commit()
        self.db.refresh(cita)
        self._track_cita(cita.id_cita)
        return cita

    def _crear_producto(
        self,
        *,
        nombre: str = "Producto S6",
        stock: float = 50,
        precio: float = 25000,
        visible: bool = True,
    ) -> Producto:
        producto = Producto(
            nombre_producto=f"{nombre} {uuid.uuid4().hex[:6]}",
            referencia_producto=f"S6-{uuid.uuid4().hex[:10]}",
            stock_producto=Decimal(str(stock)),
            precio_venta_producto=precio,
            precio_compra_producto=precio / 2,
            visible_cliente=visible,
            estado_producto="activo",
        )
        self.db.add(producto)
        self.db.commit()
        self.db.refresh(producto)
        self._ids_producto.append(producto.id_producto)
        return producto

    def _crear_pedido_bd(
        self,
        cliente,
        *,
        estado_pedido: str = "Pagado",
        total: float = 0,
        estado_entrega: str = "Pendiente",
        fecha_entrega: date | None = None,
        hora_entrega: str = "09:00",
        id_tecnico_entrega: int | None = None,
        nombre_tecnico_entrega: str | None = None,
    ) -> Pedido:
        pedido = Pedido(
            id_cliente_pe=cliente.id_cliente,
            total_pedido=total,
            estado_pedido=estado_pedido,
            estado_entrega=estado_entrega,
            fecha_entrega=fecha_entrega,
            hora_entrega=hora_entrega,
            id_tecnico_entrega=id_tecnico_entrega,
            nombre_tecnico_entrega=nombre_tecnico_entrega,
        )
        self.db.add(pedido)
        self.db.commit()
        self.db.refresh(pedido)
        self._track_pedido(pedido.id_pedido)
        return pedido

    def _agregar_detalle(
        self,
        pedido: Pedido,
        producto: Producto,
        *,
        cantidad: int = 1,
        cantidad_metros: float | None = None,
        precio_unitario: float | None = None,
        subtotal: float | None = None,
    ) -> DetallePedido:
        precio = precio_unitario if precio_unitario is not None else float(producto.precio_venta_producto or 0)
        detalle = DetallePedido(
            id_pedido_d=pedido.id_pedido,
            id_producto_d=producto.id_producto,
            cantidad_detalle=cantidad,
            cantidad_metros=cantidad_metros,
            precio_unitario_detalle=precio,
            subtotal_detalle=subtotal if subtotal is not None else precio * cantidad,
        )
        self.db.add(detalle)
        self.db.commit()
        self.db.refresh(detalle)
        return detalle

    def _crear_solicitud_devolucion_bd(
        self,
        cliente,
        pedido: Pedido | None = None,
        *,
        estado: str = "Solicitada",
        tipo: str = "parcial",
        monto: float = 25000,
    ) -> SolicitudDevolucion:
        solicitud = SolicitudDevolucion(
            numero=f"DEV-{uuid.uuid4().hex[:10].upper()}",
            id_cliente_s=cliente.id_cliente,
            id_pedido_s=pedido.id_pedido if pedido else None,
            motivo_tipo="producto_defectuoso",
            estado=estado,
            tipo_devolucion=tipo,
            monto_total=monto,
        )
        self.db.add(solicitud)
        self.db.commit()
        self.db.refresh(solicitud)
        self._ids_solicitud_dv.append(solicitud.id_solicitud)
        return solicitud

    def _crear_devolucion_bd(
        self,
        cliente,
        *,
        pedido: Pedido | None = None,
        producto: Producto | None = None,
        estado: str = "Pendiente",
        cantidad: int = 1,
        solicitud: SolicitudDevolucion | None = None,
        preferencia: str | None = None,
        id_tecnico_recogida: int | None = None,
        recogida_estado: str | None = "Asignada",
    ) -> Devolucion:
        devolucion = Devolucion(
            id_cliente_d=cliente.id_cliente,
            id_pedido_d=pedido.id_pedido if pedido else None,
            id_producto_d=producto.id_producto if producto else None,
            motivo="Producto defectuoso",
            descripcion="Devolución creada por la suite S6",
            estado=estado,
            cantidad=cantidad,
            preferencia=preferencia,
            id_tecnico_recogida=id_tecnico_recogida,
            recogida_estado=recogida_estado,
            id_solicitud_dv=solicitud.id_solicitud if solicitud else None,
        )
        self.db.add(devolucion)
        self.db.commit()
        self.db.refresh(devolucion)
        self._ids_devolucion.append(devolucion.id_devolucion)
        return devolucion

    def _crear_novedad_bd(
        self,
        *,
        cliente=None,
        tecnico=None,
        pedido: Pedido | None = None,
        cita: Cita | None = None,
        tipo: str = "otro",
        estado: str = "Pendiente",
        prioridad: str = "normal",
        descripcion: str = "Novedad creada por la suite S6",
    ) -> Novedad:
        novedad = Novedad(
            id_cliente=cliente.id_cliente if cliente else None,
            id_tecnico_n=tecnico.id_tecnico if tecnico else None,
            id_pedido=pedido.id_pedido if pedido else None,
            id_cita=cita.id_cita if cita else None,
            tipo_novedad=tipo,
            descripcion_novedad=descripcion,
            estado_novedad=estado,
            prioridad=prioridad,
            fecha_reporte_novedad=datetime.now(),
            cliente_visible=True,
        )
        self.db.add(novedad)
        self.db.commit()
        self.db.refresh(novedad)
        self._ids_novedad.append(novedad.id_novedad)
        return novedad

    # ── limpieza ──────────────────────────────────────────────────────────
    def tearDown(self):
        from app.models.notificacion import Notificacion

        db = self.db
        pedidos = list(dict.fromkeys(self._ids_pedido_extra + self._ids_pedido))
        citas = list(dict.fromkeys(self._ids_cita))
        try:
            db.rollback()
            # Citas creadas por el flujo de pedidos (instalación).
            citas_pedido = []
            if pedidos:
                citas_pedido = [
                    row[0]
                    for row in db.query(Cita.id_cita)
                    .filter(Cita.numero_transaccion.in_([f"PEDIDO-{pid}" for pid in pedidos]))
                    .all()
                ]
            todas_citas = list(dict.fromkeys(citas + citas_pedido))
            # Evidencias y cupones (dependen de citas/pedidos/novedades/clientes).
            if todas_citas:
                db.query(Evidencia).filter(Evidencia.id_cita.in_(todas_citas)).delete(synchronize_session=False)
            if pedidos:
                db.query(EvidenciaEntrega).filter(EvidenciaEntrega.id_pedido.in_(pedidos)).delete(synchronize_session=False)
            if self._ids_novedad:
                db.query(EvidenciaNovedad).filter(EvidenciaNovedad.id_novedad.in_(self._ids_novedad)).delete(synchronize_session=False)
                db.query(NovedadHistorial).filter(NovedadHistorial.id_novedad.in_(self._ids_novedad)).delete(synchronize_session=False)
            if self._ids_cupon:
                db.query(CuponDescuento).filter(CuponDescuento.id_cupon.in_(self._ids_cupon)).delete(synchronize_session=False)
            # Novedades propias: referencian pedidos, citas, clientes y
            # devoluciones, así que deben borrarse antes que esas filas.
            if self._ids_novedad:
                db.query(Novedad).filter(Novedad.id_novedad.in_(self._ids_novedad)).delete(synchronize_session=False)
            # Devoluciones y solicitudes.
            if self._ids_devolucion:
                db.query(Devolucion).filter(Devolucion.id_devolucion.in_(self._ids_devolucion)).delete(synchronize_session=False)
            if self._ids_solicitud_dv:
                db.query(SolicitudDevolucion).filter(SolicitudDevolucion.id_solicitud.in_(self._ids_solicitud_dv)).delete(synchronize_session=False)
            # Reembolsos e historial de citas (antes de citas y pedidos).
            if todas_citas:
                db.query(Reembolso).filter(Reembolso.id_cita.in_(todas_citas)).delete(synchronize_session=False)
                db.query(HistorialCita).filter(HistorialCita.id_cita.in_(todas_citas)).delete(synchronize_session=False)
                db.query(CitaProducto).filter(CitaProducto.id_cita.in_(todas_citas)).delete(synchronize_session=False)
                # La factura de una cita pagada referencia citas.id_cita.
                db.query(Factura).filter(Factura.id_cita.in_(todas_citas)).delete(synchronize_session=False)
            if pedidos:
                db.query(Reembolso).filter(Reembolso.id_pedido.in_(pedidos)).delete(synchronize_session=False)
            if todas_citas:
                db.query(Cita).filter(Cita.id_cita.in_(todas_citas)).delete(synchronize_session=False)
            # Ofertas de horario y comisiones.
            if self._ids_oferta:
                db.query(OfertaHorario).filter(OfertaHorario.id_oferta.in_(self._ids_oferta)).delete(synchronize_session=False)
            if self._ids_cliente:
                db.query(OfertaHorario).filter(OfertaHorario.id_cliente.in_(self._ids_cliente)).delete(synchronize_session=False)
            if self._ids_comision:
                db.query(Comision).filter(Comision.id_comision.in_(self._ids_comision)).delete(synchronize_session=False)
            # Pedidos: facturas, pagos, detalles y pedido.
            if pedidos:
                db.query(Factura).filter(Factura.id_pedido.in_(pedidos)).delete(synchronize_session=False)
                db.query(Pago).filter(Pago.id_pedido.in_(pedidos)).delete(synchronize_session=False)
                db.query(DetallePedido).filter(DetallePedido.id_pedido_d.in_(pedidos)).delete(synchronize_session=False)
                db.query(Pedido).filter(Pedido.id_pedido.in_(pedidos)).delete(synchronize_session=False)
            # Especializaciones propias (las asociaciones de técnicos caen por CASCADE).
            if self._ids_especializacion:
                db.query(Especializacion).filter(
                    Especializacion.id_especializacion.in_(self._ids_especializacion)
                ).delete(synchronize_session=False)
            # Productos propios.
            if self._ids_producto:
                db.query(DetallePedido).filter(DetallePedido.id_producto_d.in_(self._ids_producto)).delete(synchronize_session=False)
                db.query(Producto).filter(Producto.id_producto.in_(self._ids_producto)).delete(synchronize_session=False)
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            super().tearDown()
