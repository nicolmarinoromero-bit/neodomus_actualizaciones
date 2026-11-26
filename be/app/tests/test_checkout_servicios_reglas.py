# ─────────────────────────────────────────────────────────────
# Reglas del checkout por tipo de servicio (casos reproducidos
# en entorno aislado con BD de pruebas):
#   1) La carga de trabajo escala el equipo SOLO para instalación:
#      4 cámaras + mantenimiento → 1 técnico (la recomendación
#      anunciará lo mismo que exigirá el servidor).
#   2) El mensaje cuando nadie cubre la especialidad NO se presenta
#      como agenda vacía (distingue aptitud de disponibilidad).
# ─────────────────────────────────────────────────────────────
import time
import unittest
from datetime import date
from unittest.mock import patch

import app.tests.testdb  # noqa: F401
from app.main import app
from app.database import SessionLocal
from app.models.especializacion import Especializacion
from app.models.especializacion import producto_especializacion
from app.models.producto import Producto
from app.services.recomendacion_service import analizar_items
from app.tests.test_t2_pago_pendiente import BaseT2, _run


def _siguiente_laborable(dias: int):
    from datetime import date as _d, timedelta as _t

    f = _d.today() + _t(days=dias)
    while f.weekday() == 6:
        f += _t(days=1)
    return f


def _crear_producto_camara(db, esp, marca):
    producto = Producto(
        nombre_producto=f"Cámara prueba {marca}",
        referencia_producto=f"REF-SVC-{marca}-{int(time.time() * 1_000_000)}",
        stock_producto=25,
        visible_cliente=True,
    )
    db.add(producto)
    db.flush()
    db.execute(producto_especializacion.insert().values(
        id_producto=producto.id_producto,
        id_especializacion=esp.id_especializacion,
    ))
    return producto


class ReglaEquipoPorTipoTest(BaseT2):
    def setUp(self):
        super().setUp()
        db = self.db
        self.esp = Especializacion(nombre=f"Cámaras prueba {int(time.time() * 1_000_000)}")
        db.add(self.esp)
        db.flush()
        self.camara = _crear_producto_camara(db, self.esp, "a")
        self._ids_producto.append(self.camara.id_producto)
        db.commit()

    def test_mantenimiento_no_escala_equipo_con_carga(self):
        items = [{"id_producto": self.camara.id_producto, "cantidad": 4}]
        analisis = analizar_items(SessionLocal(), items, tipo_servicio="mantenimiento")
        self.assertEqual(analisis["tecnicos_necesarios"], 1)

    def test_instalacion_escala_con_carga(self):
        items = [{"id_producto": self.camara.id_producto, "cantidad": 4}]
        analisis = analizar_items(SessionLocal(), items, tipo_servicio="instalacion")
        self.assertEqual(analisis["tecnicos_necesarios"], 3)

    def test_recomendacion_endpoint_recibe_tipo(self):
        previous = app.state.limiter.enabled
        app.state.limiter.enabled = False
        self.addCleanup(setattr, app.state.limiter, 'enabled', previous)
        for target in (
            'app.services.notificaciones.notificar_entrega_asignada_tecnico',
        ):
            self.enterContext(patch(target))
        token_payload = {
            'sub': self.cliente.email, 'user_type': 'client',
            'user_id': self.cliente.id_cliente, 'rol': 'cliente',
        }
        from app.utils.security import create_access_token

        headers = {'Authorization': f'Bearer {create_access_token(token_payload, user_type="client", rol="cliente")}'}

        async def req(tipo):
            from httpx import ASGITransport, AsyncClient

            async with AsyncClient(transport=ASGITransport(app=app), base_url='http://t') as c:
                return await c.post('/api/v1/pedidos/recomendacion-tecnicos', headers=headers, json={
                    'items': [{'id_producto': self.camara.id_producto, 'cantidad': 4}],
                    'tipo_servicio': tipo,
                })
        con_mant = _run(req('mantenimiento'))
        con_inst = _run(req('instalacion'))
        self.assertEqual(con_mant.status_code, 200)
        self.assertEqual(con_mant.json()['tecnicos_necesarios'], 1)
        self.assertEqual(con_inst.json()['tecnicos_necesarios'], 3)


class MensajeAptitudVsAgendaTest(BaseT2):
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
        self.esp = Especializacion(nombre=f"Cámaras msg {int(time.time() * 1_000_000)}")
        db.add(self.esp)
        db.flush()
        self.camara = _crear_producto_camara(db, self.esp, "m")
        self._ids_producto.append(self.camara.id_producto)
        db.commit()
        token_payload = {
            'sub': self.cliente.email, 'user_type': 'client',
            'user_id': self.cliente.id_cliente, 'rol': 'cliente',
        }
        from app.utils.security import create_access_token

        self.headers = {'Authorization': f'Bearer {create_access_token(token_payload, user_type="client", rol="cliente")}'}
        self.fecha = _siguiente_laborable(5).isoformat()

    def _post(self):
        payload = {
            'items': [{'id_producto': self.camara.id_producto, 'cantidad': 1}],
            'servicios': [{
                'nombre': 'Mantenimiento cámara', 'tipo_servicio': 'mantenimiento',
                'fecha': self.fecha, 'hora': '08:00', 'direccion': 'Calle mensaje',
                'precio': 80000,
            }],
            'pago': {'metodo': 'tarjeta_credito', 'numero': '4242424242424242',
                     'cvv': '123', 'titular': 'Mensaje', 'expiracion': '12/30'},
        }

        async def req():
            from httpx import ASGITransport, AsyncClient

            async with AsyncClient(transport=ASGITransport(app=app), base_url='http://t') as c:
                return await c.post('/api/v1/pedidos', json=payload, headers=self.headers)
        return _run(req())

    def test_sin_apto_explora_especialidad_no_agenda(self):
        r = self._post()
        self.assertEqual(r.status_code, 400)
        self.assertIn('especialización requerida', r.json()['detail'])
        self.assertNotIn('Elige otra fecha', r.json()['detail'])


if __name__ == '__main__':
    unittest.main()
