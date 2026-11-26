# ─────────────────────────────────────────────────────────────
# Regla de 3 horas de anticipación con reloj FIJO (Bogotá
# 26/11/2026 07:14): 10:13 se rechaza (2 h 59 min), 10:14 cumple
# justo el mínimo, 14:00 lo supera. La hora es LOCAL (Bogotá),
# no la zona del servidor.
#
# El reloj fijo se aplica parcheando ahora_bogota (el reloj que
# consumen las validaciones), sin congelar datetime global:
# freezegun global rompe los schemas de FastAPI (date → FakeDate
# en las anotaciones de las rutas).
# ─────────────────────────────────────────────────────────────
import time
import unittest
from datetime import date, datetime, timedelta
from unittest.mock import patch

import app.tests.testdb  # noqa: F401
from app.main import app
from app.models.especializacion import Especializacion
from app.models.especializacion import producto_especializacion, tecnico_especializacion
from app.models.producto import Producto
from app.models.tecnico import Tecnico
from app.models.user import User
from app.tests.test_t2_pago_pendiente import BaseT2, _run
from app.utils.security import create_access_token


def _siguiente_laborable(dias: int) -> date:
    d = date.today() + timedelta(days=dias)
    while d.weekday() == 6:
        d += timedelta(days=1)
    return d


RELOJ_0714 = datetime(2026, 11, 26, 7, 14, 0)
RELOJ_0830 = datetime(2026, 11, 26, 8, 30, 0)


class ReglaAnticipacionHoyTest(BaseT2):
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
        db = self.db
        marca = int(time.time() * 1_000_000)
        self.producto = Producto(
            nombre_producto=f"Cámara regla {marca}",
            referencia_producto=f"REF-REGLA3H-{marca}",
            stock_producto=10,
            visible_cliente=True,
        )
        db.add(self.producto)
        db.flush()
        self.esp = Especializacion(nombre=f"Cámaras 3h {marca}")
        db.add(self.esp)
        db.flush()
        db.execute(producto_especializacion.insert().values(
            id_producto=self.producto.id_producto,
            id_especializacion=self.esp.id_especializacion,
        ))
        u = User(first_name="JORGE", last_name="QA",
                 email=f"jorge.3h.{marca}@pruebas-qa.com", password_hash="x",
                 id_rol_u=2, is_active=True)
        db.add(u)
        db.flush()
        self.tecnico = Tecnico(id_usuario_t=u.id_usuario, certificacion_t="")
        db.add(self.tecnico)
        db.flush()
        db.execute(tecnico_especializacion.insert().values(
            id_tecnico=self.tecnico.id_tecnico,
            id_especializacion=self.esp.id_especializacion,
        ))
        self._ids_producto.append(self.producto.id_producto)
        db.commit()

    def tearDown(self):
        # Limpieza con sesión fresca: el pedido y la cita los creó la app en
        # su propia sesión. Mismo orden que BaseT2.tearDown.
        from app.models.factura import Factura
        from app.models.pago import Pago
        from app.models.pedido import Pedido, DetallePedido
        from app.models.cita import Cita
        from app.database import SessionLocal
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
        db = SessionLocal()
        try:
            db.query(Especializacion).filter(
                Especializacion.id_especializacion == self.esp.id_especializacion
            ).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()
        super().tearDown()

    def _post_hoy(self, hora, reloj):
        """POST de un pedido con cita HOY a `hora`, con el reloj de Bogotá
        de las validaciones fijado a `reloj` (parche de ahora_bogota)."""
        payload = {
            'items': [{'id_producto': self.producto.id_producto, 'cantidad': 1}],
            'servicios': [{
                'nombre': 'Mantenimiento hoy', 'tipo_servicio': 'mantenimiento',
                'fecha': '2026-11-26', 'hora': hora,
                'direccion': 'Calle regla', 'precio': 80000,
                'id_tecnico': self.tecnico.id_tecnico,
            }],
            'pago': {'metodo': 'tarjeta_credito', 'numero': '4242424242424242',
                     'cvv': '123', 'titular': 'Regla', 'expiracion': '12/30'},
        }
        token = create_access_token(
            {'sub': self.cliente.email}, user_type='client', rol='cliente',
            user_id=self.cliente.id_cliente,
        )
        headers = {'Authorization': f'Bearer {token}'}

        async def req():
            from httpx import ASGITransport, AsyncClient
            async with AsyncClient(transport=ASGITransport(app=app), base_url='http://t') as c:
                return await c.post('/api/v1/pedidos', json=payload, headers=headers)
        with patch('app.services.pedidos_service.ahora_bogota', return_value=reloj):
            return _run(req())

    def test_1013_rechazada_1014_cumple_1400_supera(self):
        # ── Regla de anticipación POR SEPARADO (reloj fijo 07:14 Bogotá) ──
        def cumple_minimo(hora: str, ahora: datetime) -> bool:
            hh, mm = hora.split(":")
            fecha_hora = datetime.combine(date(2026, 11, 26), datetime.min.time()).replace(
                hour=int(hh), minute=int(mm)
            )
            return fecha_hora >= ahora + timedelta(hours=3)

        self.assertFalse(cumple_minimo("10:13", RELOJ_0714), "10:13 tiene 2 h 59 min: no cumple")
        self.assertTrue(cumple_minimo("10:14", RELOJ_0714), "10:14 cumple justo el mínimo (3 h 00)")
        self.assertTrue(cumple_minimo("14:00", RELOJ_0714), "14:00 supera (6 h 46)")

        # ── Endpoint (cuadrícula de franjas): 14:00 hoy se agenda completa ──
        r3 = self._post_hoy("14:00", RELOJ_0714)
        self.assertEqual(r3.status_code, 200, r3.json())
        self.assertEqual(r3.json()['pago']['estado'], 'aprobado')

        # Franja válida de la cuadrícula (11:00) sin margen: reloj 08:30 →
        # 2 h 30 min → rechazo por ANTICIPACIÓN con el motivo visible.
        r4 = self._post_hoy("11:00", RELOJ_0830)
        self.assertEqual(r4.status_code, 400)
        self.assertIn('3 horas', r4.json()['detail'])
        self.assertIn('Bogotá', r4.json()['detail'])


if __name__ == '__main__':
    unittest.main()
