# ─────────────────────────────────────────────────────────────
# Checkout de instalación con técnicos elegidos por el cliente.
# Caso de la compañera reproducido con BD aislada:
#   - 2 técnicos SIN la especialización requerida → 400 y SIN parciales
#     (sin pago aprobado, sin stock descontado, sin cita).
#   - id_tecnico_2 viaja del checkout a la cita (regresión: se perdía en
#     _preparar_servicios).
# ─────────────────────────────────────────────────────────────
import time
import unittest
from datetime import date, timedelta
from unittest.mock import patch

import app.tests.testdb  # noqa: F401
from app.main import app
from app.database import SessionLocal
from app.models.especializacion import Especializacion
from app.models.especializacion import producto_especializacion, tecnico_especializacion
from app.models.factura import Factura
from app.models.pago import Pago
from app.models.pedido import Pedido, DetallePedido
from app.models.producto import Producto
from app.models.cita import Cita
from app.tests.test_t2_pago_pendiente import BaseT2, _run
from app.utils.security import create_access_token


def _siguiente_laborable(dias: int) -> date:
    """Fecha futura en día hábil (las citas no se agendan en domingo)."""
    d = date.today() + timedelta(days=dias)
    while d.weekday() == 6:
        d += timedelta(days=1)
    return d


class CheckoutTecnicosTest(BaseT2):
    def setUp(self):
        super().setUp()
        previous = app.state.limiter.enabled
        app.state.limiter.enabled = False
        self.addCleanup(setattr, app.state.limiter, 'enabled', previous)
        for target in (
            'app.services.notificaciones.notificar_pedido_creado_cliente',
            'app.services.notificaciones.notificar_pago_confirmado_cliente',
            'app.services.notificaciones.notificar_entrega_asignada_tecnico',
            'app.services.notificaciones.notificar_entrega_asignada_cliente',
            'app.services.inventario_service._verificar_stock_bajo',
            'app.services.pedidos_service._alertar_admin_stock_agotado',
            'app.services.pedidos_service._enviar_factura',
        ):
            self.enterContext(patch(target))
        self.producto = Producto(
            nombre_producto=f"Fuente prueba {int(time.time() * 1_000_000)}",
            referencia_producto=f"REF-TEC-{int(time.time() * 1_000_000)}",
            stock_producto=10,
            visible_cliente=True,
        )
        db = self.db
        db.add(self.producto)
        db.flush()
        self.especializacion = Especializacion(
            nombre=f"Esp prueba {int(time.time() * 1_000_000)}",
        )
        db.add(self.especializacion)
        db.flush()
        db.execute(producto_especializacion.insert().values(
            id_producto=self.producto.id_producto,
            id_especializacion=self.especializacion.id_especializacion,
        ))
        self.tecnico_a = self._tecnico("a")
        self.tecnico_b = self._tecnico("b")
        self._ids_producto.append(self.producto.id_producto)
        db.commit()
        self.producto_id = self.producto.id_producto
        token = create_access_token(
            {'sub': self.cliente.email}, user_type='client', rol='cliente',
            user_id=self.cliente.id_cliente,
        )
        self.headers = {'Authorization': f'Bearer {token}'}
        self.fecha = _siguiente_laborable(3).isoformat()

    def tearDown(self):
        # Limpieza con sesión fresca: el pedido y la cita los creó la app en
        # su propia sesión (esta prueba no puede verlos con el snapshot viejo
        # de self.db). Mismo orden que BaseT2.tearDown.
        db = SessionLocal()
        try:
            pedidos = db.query(Pedido).filter(
                Pedido.id_cliente_pe == self.cliente.id_cliente).all()
            for p in pedidos:
                db.query(Factura).filter(Factura.id_pedido == p.id_pedido).delete(synchronize_session=False)
                db.query(Cita).filter(Cita.numero_transaccion == f"PEDIDO-{p.id_pedido}").delete(synchronize_session=False)
                db.query(DetallePedido).filter(DetallePedido.id_pedido_d == p.id_pedido).delete(synchronize_session=False)
                db.query(Pago).filter(Pago.id_pedido == p.id_pedido).delete(synchronize_session=False)
                db.query(Pedido).filter(Pedido.id_pedido == p.id_pedido).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()
        # La especialización queda huérfana al borrar producto y técnicos
        # (BaseT2): se retira aquí para no dejarla en la BD de pruebas.
        db = SessionLocal()
        try:
            db.query(Especializacion).filter(
                Especializacion.id_especializacion == self.especializacion.id_especializacion
            ).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()
        super().tearDown()

    def _vincular_esp(self, tecnico):
        db = self.db
        db.execute(tecnico_especializacion.insert().values(
            id_tecnico=tecnico.id_tecnico,
            id_especializacion=self.especializacion.id_especializacion,
        ))
        db.commit()

    def _post_checkout(self):
        payload = {
            'items': [{'id_producto': self.producto_id, 'cantidad': 2}],
            'servicios': [{
                'nombre': 'Instalacion prueba',
                'tipo_servicio': 'instalacion',
                'fecha': self.fecha,
                'hora': '08:00',
                'direccion': 'Calle prueba',
                'precio': 50000,
                'id_tecnico': self.tecnico_a.id_tecnico,
                'id_tecnico_2': self.tecnico_b.id_tecnico,
            }],
            'pago': {'metodo': 'tarjeta_credito', 'numero': '4242424242424242',
                     'cvv': '123', 'titular': 'Prueba Flujo', 'expiracion': '12/30'},
        }

        async def request():
            from httpx import ASGITransport, AsyncClient
            async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
                return await client.post('/api/v1/pedidos', json=payload, headers=self.headers)
        return _run(request())

    def test_dos_tecnicos_sin_especializacion_rechazados_sin_parciales(self):
        """Los 2 técnicos elegidos NO cubren la especialización del producto:
        rechazo 400 y SIN pedido pagado, stock descontado ni cita parcial."""
        respuesta = self._post_checkout()
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('especializaci', respuesta.json()['detail'].lower())
        with SessionLocal() as db:
            self.assertEqual(db.query(Pedido).filter(
                Pedido.id_cliente_pe == self.cliente.id_cliente).count(), 0)
            self.assertEqual(db.query(Factura).filter(
                Factura.id_pedido.in_(db.query(Pedido.id_pedido).filter(
                    Pedido.id_cliente_pe == self.cliente.id_cliente))).count(), 0)
            self.assertEqual(db.query(Cita).filter(
                Cita.id_tecnico.in_([self.tecnico_a.id_tecnico,
                                     self.tecnico_b.id_tecnico])).count(), 0)
            producto = db.get(Producto, self.producto_id)
            self.assertEqual(producto.stock_producto, 10)

    def test_tecnicos_con_especializacion_completa_compra(self):
        """Ambos técnicos cubren la especialización → compra completa con el
        equipo elegido (regresión: id_tecnico_2 se perdía)."""
        self._vincular_esp(self.tecnico_a)
        self._vincular_esp(self.tecnico_b)
        respuesta = self._post_checkout()
        self.assertEqual(respuesta.status_code, 200)
        cuerpo = respuesta.json()
        self.assertEqual(cuerpo['pago']['estado'], 'aprobado')
        with SessionLocal() as db:
            pedido = db.query(Pedido).filter(
                Pedido.id_cliente_pe == self.cliente.id_cliente).order_by(
                Pedido.id_pedido.desc()).first()
            self.assertIsNotNone(pedido)
            cita = db.query(Cita).filter(
                Cita.id_cliente == self.cliente.id_cliente,
                Cita.tipo_servicio == 'instalacion',
            ).order_by(Cita.id_cita.desc()).first()
            self.assertIsNotNone(cita)
            self.assertEqual(cita.id_tecnico, self.tecnico_a.id_tecnico)
            self.assertEqual(cita.id_tecnico_2, self.tecnico_b.id_tecnico)
            producto = db.get(Producto, self.producto_id)
            self.assertEqual(producto.stock_producto, 8)


if __name__ == '__main__':
    unittest.main()
