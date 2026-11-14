"""S6 — Integración de pedidos, instalaciones y entregas con MySQL real.

Cubre el checkout completo (producto + servicio de instalación), la creación
de órdenes de instalación con uno o varios técnicos, el rechazo de pagos, las
validaciones previas al cobro y las pantallas administrativas de pedidos,
entregas y facturas, además del seguimiento del cliente.
"""
import unittest
import uuid
from datetime import date, datetime, timedelta

import app.tests.testdb  # noqa: F401

from app.models.cita import Cita
from app.models.factura import Factura
from app.models.ubicacion_tecnico import UbicacionTecnico
from app.tests.s6_base import BaseS6TestCase


class PedidosInstalacionIntegracionTestCase(BaseS6TestCase):
    def setUp(self):
        super().setUp()
        self.admin = self._crear_admin("ped")
        self.cliente = self._crear_cliente("ped")
        self.otro_cliente = self._crear_cliente("ped2")
        self.tecnico_user, self.tecnico = self._crear_tecnico("ped")
        self.tecnico2_user, self.tecnico2 = self._crear_tecnico("ped2")
        self.headers_admin = self._bearer(self._token(self._login(self.admin.email)))
        self.headers_cliente = self._bearer(self._token(self._login(self.cliente.email)))
        self.headers_otro = self._bearer(self._token(self._login(self.otro_cliente.email)))
        self.producto = self._crear_producto(precio=25000, stock=30)
        self.fecha = self._proxima_laboral(25)
        self.fecha2 = self._proxima_laboral(40)

    # ── helpers ───────────────────────────────────────────────────────────
    def _pago_tarjeta(self, numero="4242424242424242"):
        return {
            "metodo": "tarjeta_credito",
            "numero": numero,
            "titular": "CLIENTE PEDIDOS S6",
            "expiracion": "12/30",
            "cvv": "123",
        }

    def _checkout(self, *, items=None, servicios=None, pago=None, headers=None):
        payload = {
            "items": items
            if items is not None
            else [{"id_producto": self.producto.id_producto, "cantidad": 1}],
            "servicios": servicios or [],
            "pago": pago or self._pago_tarjeta(),
        }
        return self._post(
            "/api/v1/pedidos",
            headers=headers or self.headers_cliente,
            json=payload,
        )

    def _servicio_instalacion(self, fecha=None, *, hora="08:00", id_tecnico=None, **extra):
        datos = {
            "nombre": "Instalación profesional",
            "tipo_servicio": "instalacion",
            "descripcion": "Instalación de productos del pedido",
            "fecha": str(fecha or self.fecha),
            "hora": hora,
            "precio": 120000,
        }
        if id_tecnico is not None:
            datos["id_tecnico"] = id_tecnico
        datos.update(extra)
        return datos

    def _registrar_resultado(self, cuerpo):
        """Registra pedido/cita/factura creados por el checkout para limpieza."""
        pedido = cuerpo.get("pedido") or {}
        if pedido.get("id_pedido"):
            self._track_pedido(pedido["id_pedido"])
        for orden in cuerpo.get("ordenes_instalacion") or []:
            if orden.get("id_cita"):
                self._track_cita(orden["id_cita"])

    # ── checkout con instalación ─────────────────────────────────────────
    def test_checkout_instalacion_con_tecnico_explicito(self):
        r = self._checkout(
            servicios=[self._servicio_instalacion(id_tecnico=self.tecnico.id_tecnico)]
        )
        self.assertEqual(r.status_code, 200, r.text)
        cuerpo = r.json()
        self._registrar_resultado(cuerpo)
        self.assertEqual(cuerpo["pedido"]["estado"], "Pagado")
        self.assertEqual(cuerpo["pago"]["estado"], "aprobado")
        self.assertIsNotNone(cuerpo["factura"])
        self.assertTrue(cuerpo["pdf_url"])
        self.assertFalse(cuerpo["carrito_mantener"])
        self.assertEqual(len(cuerpo["ordenes_instalacion"]), 1)
        orden = cuerpo["ordenes_instalacion"][0]
        self.assertEqual(orden["id_tecnico"], self.tecnico.id_tecnico)
        self.assertEqual(orden["tipo_servicio"], "instalacion")
        self.assertEqual(orden["fecha"], str(self.fecha))
        self.assertEqual(orden["estado"], "Confirmada")
        self.assertGreaterEqual(orden["id_cita"], 1)

        self._resincronizar()
        pedido_id = cuerpo["pedido"]["id_pedido"]
        cita = self.db.query(Cita).filter(Cita.numero_transaccion == f"PEDIDO-{pedido_id}").first()
        self.assertIsNotNone(cita)
        self.assertEqual(cita.id_tecnico, self.tecnico.id_tecnico)
        self.assertEqual(cita.metodo_pago, "checkout")
        self.assertIn(self.producto.nombre_producto.lower(), (cita.descripcion or "").lower())
        self.assertGreaterEqual(len(cuerpo["pedido"]["detalles"]), 2)
        self.assertEqual(cuerpo["entrega"]["estado_entrega"], "Asignada")

    def test_checkout_instalacion_autoasigna_dos_tecnicos(self):
        self.producto.tecnicos_requeridos = 2
        self.producto.dificultad_instalacion = "baja"
        self.db.commit()
        r = self._checkout(servicios=[self._servicio_instalacion()])
        self.assertEqual(r.status_code, 200, r.text)
        cuerpo = r.json()
        self._registrar_resultado(cuerpo)
        orden = cuerpo["ordenes_instalacion"][0]
        self.assertIsNotNone(orden["id_tecnico"])
        self.assertIsNotNone(orden["id_tecnico_2"], orden)
        self.assertNotEqual(orden["id_tecnico"], orden["id_tecnico_2"])
        self.assertIsNotNone(orden["nombre_tecnico_2"])
        self.assertIsNotNone(cuerpo["entrega"])
        self.assertEqual(cuerpo["entrega"]["id_tecnico"], orden["id_tecnico"])

    def test_checkout_valida_items_servicios_y_fechas(self):
        vacio = self._post(
            "/api/v1/pedidos",
            headers=self.headers_cliente,
            json={"items": [], "servicios": [], "pago": self._pago_tarjeta()},
        )
        self.assertEqual(vacio.status_code, 400)

        ajeno = self._checkout(
            items=[{"id_producto": 99999999, "cantidad": 1}],
            servicios=[self._servicio_instalacion()],
        )
        self.assertEqual(ajeno.status_code, 404)

        sin_stock = self._checkout(
            items=[{"id_producto": self.producto.id_producto, "cantidad": 9999}],
            servicios=[self._servicio_instalacion()],
        )
        self.assertEqual(sin_stock.status_code, 409, sin_stock.text)

        domingo = date.today() + timedelta(days=1)
        while domingo.weekday() != 6:
            domingo += timedelta(days=1)
        finde = self._checkout(
            servicios=[self._servicio_instalacion(fecha=domingo)]
        )
        self.assertEqual(finde.status_code, 400, finde.text)

        pasada = self._checkout(
            servicios=[self._servicio_instalacion(fecha=date.today() - timedelta(days=1))]
        )
        self.assertEqual(pasada.status_code, 400, pasada.text)

        hora_invalida = self._checkout(
            servicios=[self._servicio_instalacion(hora="09:00")]
        )
        self.assertEqual(hora_invalida.status_code, 400, hora_invalida.text)

        sin_nombre = self._checkout(
            servicios=[{"nombre": "  ", "tipo_servicio": "instalacion", "fecha": str(self.fecha)}]
        )
        self.assertEqual(sin_nombre.status_code, 400, sin_nombre.text)

        tecnico_invalido = self._checkout(
            servicios=[self._servicio_instalacion(id_tecnico=99999999)]
        )
        self.assertEqual(tecnico_invalido.status_code, 400, tecnico_invalido.text)

    def test_checkout_pago_rechazado_no_genera_factura_ni_cita(self):
        r = self._checkout(
            pago=self._pago_tarjeta("4242424242420001"),
            servicios=[self._servicio_instalacion(id_tecnico=self.tecnico.id_tecnico)],
        )
        self.assertEqual(r.status_code, 200, r.text)
        cuerpo = r.json()
        self._registrar_resultado(cuerpo)
        self.assertEqual(cuerpo["pago"]["estado"], "rechazado")
        self.assertEqual(cuerpo["pedido"]["estado"], "Pago rechazado")
        self.assertTrue(cuerpo["carrito_mantener"])
        self.assertIsNone(cuerpo["factura"])
        self.assertIsNone(cuerpo["pdf_url"])
        self.assertEqual(cuerpo["ordenes_instalacion"], [])
        self._resincronizar()
        pedido_id = cuerpo["pedido"]["id_pedido"]
        self.assertIsNone(
            self.db.query(Cita).filter(Cita.numero_transaccion == f"PEDIDO-{pedido_id}").first()
        )

    # ── panel administrativo ─────────────────────────────────────────────
    def test_admin_lista_pedidos_entregas_y_horarios(self):
        pedido = self._crear_pedido_bd(
            self.cliente,
            total=25000,
            estado_entrega="Pendiente",
            fecha_entrega=self.fecha,
            hora_entrega="11:00",
            id_tecnico_entrega=self.tecnico.id_tecnico,
            nombre_tecnico_entrega="TECNICO PED",
        )
        self._agregar_detalle(pedido, self.producto, cantidad=1)

        listado = self._get("/api/v1/pedidos/all-admin", headers=self.headers_admin)
        self.assertEqual(listado.status_code, 200, listado.text)
        fila = next(p for p in listado.json() if p["id_pedido"] == pedido.id_pedido)
        self.assertEqual(fila["estado_entrega"], "Pendiente")
        self.assertEqual(fila["id_tecnico_entrega"], self.tecnico.id_tecnico)

        entregas = self._get("/api/v1/pedidos/admin/entregas", headers=self.headers_admin)
        self.assertEqual(entregas.status_code, 200, entregas.text)
        fila_entrega = next(e for e in entregas.json() if e["id_pedido"] == pedido.id_pedido)
        self.assertIn(self.producto.nombre_producto, fila_entrega["productos"])
        self.assertEqual(fila_entrega["id_tecnico_entrega"], self.tecnico.id_tecnico)

        horarios = self._get(
            f"/api/v1/pedidos/admin/horarios-disponibles?fecha={self.fecha}"
            f"&tecnico_id={self.tecnico.id_tecnico}",
            headers=self.headers_admin,
        )
        self.assertEqual(horarios.status_code, 200, horarios.text)
        self.assertIn("08:00", horarios.json())

        domingo = date.today() + timedelta(days=1)
        while domingo.weekday() != 6:
            domingo += timedelta(days=1)
        sin_horario = self._get(
            f"/api/v1/pedidos/admin/horarios-disponibles?fecha={domingo}",
            headers=self.headers_admin,
        )
        self.assertEqual(sin_horario.status_code, 200)
        self.assertEqual(sin_horario.json(), [])

    def test_admin_asigna_reasigna_y_remueve_entrega(self):
        pedido = self._crear_pedido_bd(self.cliente, total=25000, estado_entrega="Pendiente")
        self._agregar_detalle(pedido, self.producto, cantidad=1)

        asignada = self._put(
            f"/api/v1/pedidos/admin/{pedido.id_pedido}/entrega",
            headers=self.headers_admin,
            json={
                "id_tecnico": self.tecnico.id_tecnico,
                "fecha_entrega": str(self.fecha),
                "hora_entrega": "11:00",
                "hora_entrega_fin": "12:00",
            },
        )
        self.assertEqual(asignada.status_code, 200, asignada.text)
        self.assertEqual(asignada.json()["estado_entrega"], "Asignada")
        self.assertEqual(asignada.json()["id_tecnico_entrega"], self.tecnico.id_tecnico)

        reasignada = self._put(
            f"/api/v1/pedidos/admin/{pedido.id_pedido}/entrega",
            headers=self.headers_admin,
            json={"id_tecnico": self.tecnico2.id_tecnico},
        )
        self.assertEqual(reasignada.status_code, 200, reasignada.text)
        self.assertEqual(reasignada.json()["id_tecnico_entrega"], self.tecnico2.id_tecnico)

        removida = self._put(
            f"/api/v1/pedidos/admin/{pedido.id_pedido}/entrega",
            headers=self.headers_admin,
            json={"id_tecnico": None},
        )
        self.assertEqual(removida.status_code, 200, removida.text)
        self.assertEqual(removida.json()["estado_entrega"], "Pendiente")
        self.assertIsNone(removida.json()["nombre_tecnico"])

        inexistente = self._put(
            "/api/v1/pedidos/admin/99999999/entrega",
            headers=self.headers_admin,
            json={"id_tecnico": self.tecnico.id_tecnico},
        )
        self.assertEqual(inexistente.status_code, 404)

        tecnico_malo = self._put(
            f"/api/v1/pedidos/admin/{pedido.id_pedido}/entrega",
            headers=self.headers_admin,
            json={"id_tecnico": 99999999},
        )
        self.assertEqual(tecnico_malo.status_code, 404)

        pasada = self._put(
            f"/api/v1/pedidos/admin/{pedido.id_pedido}/entrega",
            headers=self.headers_admin,
            json={"id_tecnico": self.tecnico.id_tecnico, "fecha_entrega": str(date.today() - timedelta(days=2))},
        )
        self.assertEqual(pasada.status_code, 400)

        domingo = date.today() + timedelta(days=1)
        while domingo.weekday() != 6:
            domingo += timedelta(days=1)
        finde = self._put(
            f"/api/v1/pedidos/admin/{pedido.id_pedido}/entrega",
            headers=self.headers_admin,
            json={"id_tecnico": self.tecnico.id_tecnico, "fecha_entrega": str(domingo)},
        )
        self.assertEqual(finde.status_code, 400)

        hora_pasada = self._put(
            f"/api/v1/pedidos/admin/{pedido.id_pedido}/entrega",
            headers=self.headers_admin,
            json={
                "id_tecnico": self.tecnico.id_tecnico,
                "fecha_entrega": str(date.today()),
                "hora_entrega": "00:00",
            },
        )
        self.assertEqual(hora_pasada.status_code, 400, hora_pasada.text)

    def test_admin_no_reasigna_entrega_en_curso_y_detecta_cruce(self):
        en_curso = self._crear_pedido_bd(
            self.cliente, total=0, estado_entrega="En camino", id_tecnico_entrega=self.tecnico.id_tecnico
        )
        bloqueada = self._put(
            f"/api/v1/pedidos/admin/{en_curso.id_pedido}/entrega",
            headers=self.headers_admin,
            json={"id_tecnico": self.tecnico2.id_tecnico},
        )
        self.assertEqual(bloqueada.status_code, 409, bloqueada.text)

        self._crear_cita_bd(
            self.cliente,
            fecha=self.fecha2,
            hora="08:00",
            id_tecnico=self.tecnico.id_tecnico,
        )
        con_cruce = self._crear_pedido_bd(self.otro_cliente, total=0, estado_entrega="Pendiente")
        cruce = self._put(
            f"/api/v1/pedidos/admin/{con_cruce.id_pedido}/entrega",
            headers=self.headers_admin,
            json={
                "id_tecnico": self.tecnico.id_tecnico,
                "fecha_entrega": str(self.fecha2),
                "hora_entrega": "08:00",
            },
        )
        self.assertEqual(cruce.status_code, 409, cruce.text)

    def test_cliente_consulta_pedido_seguimiento_y_factura(self):
        pedido = self._crear_pedido_bd(
            self.cliente,
            total=25000,
            estado_entrega="En camino",
            fecha_entrega=self.fecha,
            hora_entrega="11:00",
            id_tecnico_entrega=self.tecnico.id_tecnico,
            nombre_tecnico_entrega="TECNICO PED",
        )
        self._agregar_detalle(pedido, self.producto, cantidad=1)
        factura = Factura(
            id_pedido=pedido.id_pedido,
            numero_factura=f"FAC-{uuid.uuid4().hex[:10].upper()}",
            fecha_factura=datetime.now(),
            monto_total=25000,
            metodo_pago="tarjeta_credito",
            estado_pago="aprobado",
        )
        self.db.add(factura)
        self.db.commit()
        self.db.refresh(factura)
        ubicacion = UbicacionTecnico(
            id_tecnico_ut=self.tecnico.id_tecnico,
            latitud=4.65,
            longitud=-74.05,
        )
        self.db.add(ubicacion)
        self.db.commit()

        listado = self._get("/api/v1/pedidos/mis-pedidos", headers=self.headers_cliente)
        self.assertEqual(listado.status_code, 200, listado.text)
        self.assertIn(pedido.id_pedido, [p["id_pedido"] for p in listado.json()])

        detalle = self._get(f"/api/v1/pedidos/{pedido.id_pedido}", headers=self.headers_cliente)
        self.assertEqual(detalle.status_code, 200, detalle.text)
        self.assertEqual(detalle.json()["id_pedido"], pedido.id_pedido)
        self.assertEqual(len(detalle.json()["detalles"]), 1)

        seguimiento = self._get(
            f"/api/v1/pedidos/{pedido.id_pedido}/seguimiento", headers=self.headers_cliente
        )
        self.assertEqual(seguimiento.status_code, 200, seguimiento.text)
        self.assertEqual(seguimiento.json()["estado_entrega"], "En camino")
        self.assertIsNotNone(seguimiento.json()["tecnico"])
        self.assertEqual(seguimiento.json()["ubicacion"]["latitud"], 4.65)

        pdf = self._get(f"/api/v1/pedidos/{pedido.id_pedido}/factura", headers=self.headers_cliente)
        self.assertEqual(pdf.status_code, 200, pdf.text[:200])
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        admin_pdf = self._get(
            f"/api/v1/pedidos/admin/{pedido.id_pedido}/factura", headers=self.headers_admin
        )
        self.assertEqual(admin_pdf.status_code, 200, admin_pdf.text[:200])
        self.assertTrue(admin_pdf.content.startswith(b"%PDF"))

        ajeno = self._get(f"/api/v1/pedidos/{pedido.id_pedido}", headers=self.headers_otro)
        self.assertEqual(ajeno.status_code, 404)
        ajeno_seg = self._get(
            f"/api/v1/pedidos/{pedido.id_pedido}/seguimiento", headers=self.headers_otro
        )
        self.assertEqual(ajeno_seg.status_code, 404)

        sin_factura = self._crear_pedido_bd(self.otro_cliente, total=0, estado_entrega="Pendiente")
        self.assertEqual(
            self._get(f"/api/v1/pedidos/{sin_factura.id_pedido}/factura", headers=self.headers_otro).status_code,
            404,
        )
        self.assertEqual(
            self._get("/api/v1/pedidos/99999999/factura", headers=self.headers_cliente).status_code,
            404,
        )

    def test_admin_lista_facturas_de_pedidos_y_citas(self):
        cita = self._crear_cita_bd(
            self.cliente,
            fecha=self.fecha2,
            id_tecnico=self.tecnico.id_tecnico,
            costo=80000,
        )
        factura_cita = Factura(
            id_cita=cita.id_cita,
            numero_factura=f"FAC-{uuid.uuid4().hex[:10].upper()}",
            fecha_factura=datetime.now(),
            monto_total=80000,
            metodo_pago="tarjeta_credito",
            estado_pago="aprobado",
        )
        self.db.add(factura_cita)
        self.db.commit()

        r = self._get("/api/v1/pedidos/admin/facturas", headers=self.headers_admin)
        self.assertEqual(r.status_code, 200, r.text)
        facturas = {f["id_factura"]: f for f in r.json()}
        self.assertIn(factura_cita.id_factura, facturas)
        self.assertEqual(facturas[factura_cita.id_factura]["cita"]["id_cita"], cita.id_cita)
        self.assertEqual(facturas[factura_cita.id_factura]["nombre_cliente"], "Cliente ped")

        self.assertEqual(
            self._get("/api/v1/pedidos/admin/facturas", headers=self.headers_cliente).status_code,
            401,
        )


if __name__ == "__main__":
    unittest.main()
