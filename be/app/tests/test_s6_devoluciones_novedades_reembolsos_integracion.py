"""S6 — Integración de devoluciones, novedades y reembolsos con MySQL real.

Cubre la elegibilidad de devoluciones (unidades y cortes por metros), las
solicitudes multiproducto, el pipeline administrativo con reembolso/cambio,
la recogida con evidencias y reintegro de stock, las revalidaciones de
seguridad, los reembolsos de citas y pedidos, y el ciclo completo de
novedades (creación por el técnico, evidencias, estados, mensajes, cupones
y reasignación de técnico).
"""
import io
import unittest
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

import app.tests.testdb  # noqa: F401

from app.models.devolucion import Devolucion
from app.models.especializacion import Reembolso
from app.models.pago import Pago
from app.models.producto import Producto
from app.models.solicitud_devolucion import SolicitudDevolucion
from app.tests.s6_base import BaseS6TestCase


def _png_valido() -> bytes:
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), (30, 120, 200)).save(buffer, format="PNG")
    return buffer.getvalue()


class DevolucionesNovedadesReembolsosTestCase(BaseS6TestCase):
    def setUp(self):
        super().setUp()
        self.admin = self._crear_admin("dvr")
        self.cliente = self._crear_cliente("dvr")
        self.otro_cliente = self._crear_cliente("dvr2")
        self.tecnico_user, self.tecnico = self._crear_tecnico("dvr")
        self.tecnico2_user, self.tecnico2 = self._crear_tecnico("dvr2")
        self.headers_admin = self._bearer(self._token(self._login(self.admin.email)))
        self.headers_cliente = self._bearer(self._token(self._login(self.cliente.email)))
        self.headers_otro = self._bearer(self._token(self._login(self.otro_cliente.email)))
        self.headers_tecnico = self._bearer(self._token(self._login(self.tecnico_user.email)))
        self.headers_tecnico2 = self._bearer(self._token(self._login(self.tecnico2_user.email)))

    # ── helpers ───────────────────────────────────────────────────────────
    def _crear_pago_bd(self, pedido, monto, *, estado="aprobado", transaccion=None):
        pago = Pago(
            id_pedido=pedido.id_pedido,
            metodo_pago="tarjeta_credito",
            estado=estado,
            numero_transaccion=transaccion or f"TX-{uuid.uuid4().hex[:12].upper()}",
            monto=monto,
            fecha_pago=datetime.now() if estado == "aprobado" else None,
        )
        self.db.add(pago)
        self.db.commit()
        self.db.refresh(pago)
        self._ids_pago.append(pago.id_pago)
        return pago

    def _registrar_solicitud(self, cuerpo: dict) -> int:
        """Registra en los rastreadores la solicitud y sus líneas."""
        if cuerpo.get("id_solicitud"):
            self._ids_solicitud_dv.append(cuerpo["id_solicitud"])
        for item in cuerpo.get("items") or []:
            if item.get("id_devolucion"):
                self._ids_devolucion.append(item["id_devolucion"])
        return cuerpo.get("id_solicitud")

    def _crear_solicitud_api(self, pedido, items, *, motivo="defectuoso", comentario=None):
        payload = {
            "id_pedido": pedido.id_pedido,
            "items": items,
            "motivo_tipo": motivo,
            "comentario": comentario,
        }
        r = self._post(
            "/api/v1/devoluciones/solicitudes",
            headers=self.headers_cliente,
            json=payload,
        )
        self.assertEqual(r.status_code, 200, r.text)
        self._registrar_solicitud(r.json())
        return r.json()

    def _pedido_entregado(self, producto, *, cantidad=2, precio=10000, metros=None):
        unidades_facturadas = metros if metros is not None else cantidad
        pedido = self._crear_pedido_bd(
            self.cliente, total=unidades_facturadas * precio, estado_entrega="Entregado"
        )
        self._agregar_detalle(
            pedido,
            producto,
            cantidad=cantidad,
            cantidad_metros=metros,
            precio_unitario=precio,
            subtotal=(metros if metros is not None else cantidad) * precio,
        )
        return pedido

    def _asignar_recogida(self, id_solicitud, id_tecnico):
        self._resincronizar()
        for linea in (
            self.db.query(Devolucion)
            .filter(Devolucion.id_solicitud_dv == id_solicitud)
            .all()
        ):
            linea.id_tecnico_recogida = id_tecnico
            linea.recogida_estado = "Asignada"
        self.db.commit()

    def _aprobar_solicitud(self, id_solicitud, resolucion="Reembolso"):
        r = self._put(
            f"/api/v1/devoluciones/admin/solicitudes/{id_solicitud}/estado",
            headers=self.headers_admin,
            json={"estado": "Aprobada", "resolucion": resolucion},
        )
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    # ── elegibilidad y solicitudes ───────────────────────────────────────
    def test_elegibilidad_y_solicitud_multiproducto(self):
        unidad = self._crear_producto(nombre="Unidad S6", stock=50, precio=10000)
        metro = self._crear_producto(nombre="Metro S6", stock=30, precio=4000)
        metro.venta_por_metros = 1
        self.db.commit()
        pedido = self._crear_pedido_bd(self.cliente, total=30000, estado_entrega="Entregado")
        self._agregar_detalle(pedido, unidad, cantidad=3, precio_unitario=10000, subtotal=30000)
        self._agregar_detalle(
            pedido,
            metro,
            cantidad=1,
            cantidad_metros=2.5,
            precio_unitario=4000,
            subtotal=10000,
        )

        elegible = self._get(
            f"/api/v1/devoluciones/elegibilidad/{pedido.id_pedido}",
            headers=self.headers_cliente,
        )
        self.assertEqual(elegible.status_code, 200, elegible.text)
        info = elegible.json()
        self.assertTrue(info["elegible"])
        self.assertEqual(len(info["productos"]), 2)
        por_producto = {p["id_producto"]: p for p in info["productos"]}
        self.assertEqual(por_producto[unidad.id_producto]["cantidad_disponible"], 3)
        self.assertEqual(por_producto[unidad.id_producto]["monto_maximo"], 30000.0)
        self.assertEqual(por_producto[metro.id_producto]["cantidad_disponible"], 1)
        self.assertEqual(por_producto[metro.id_producto]["metros_comprados"], 2.5)
        self.assertEqual(por_producto[metro.id_producto]["monto_maximo"], 10000.0)
        self.assertTrue(any(m["key"] == "defectuoso" for m in info["motivos"]))

        ajeno = self._get(
            f"/api/v1/devoluciones/elegibilidad/{pedido.id_pedido}",
            headers=self.headers_otro,
        )
        self.assertEqual(ajeno.status_code, 404)
        self.assertEqual(
            self._get("/api/v1/devoluciones/elegibilidad/99999999", headers=self.headers_cliente).status_code,
            404,
        )
        pedido_ajeno = self._crear_pedido_bd(self.otro_cliente, total=0, estado_entrega="Entregado")
        self.assertEqual(
            self._post(
                "/api/v1/devoluciones/solicitudes",
                headers=self.headers_cliente,
                json={
                    "id_pedido": pedido_ajeno.id_pedido,
                    "items": [{"id_producto": unidad.id_producto, "cantidad": 1}],
                    "motivo_tipo": "defectuoso",
                },
            ).status_code,
            404,
        )

        solicitud = self._crear_solicitud_api(
            pedido,
            [
                {"id_producto": unidad.id_producto, "cantidad": 2},
                {"id_producto": metro.id_producto, "metros": 2.5},
            ],
            comentario="Dos productos con problemas",
        )
        self.assertTrue(solicitud["numero"].startswith("DEV-"))
        self.assertEqual(solicitud["estado"], "Solicitada")
        self.assertEqual(solicitud["tipo_devolucion"], "parcial")
        self.assertEqual(solicitud["monto_total"], 30000.0)
        self.assertEqual(len(solicitud["items"]), 2)
        self.assertEqual(solicitud["recogidas"], 0)
        self.assertFalse(solicitud["todos_recogidos"])
        for item in solicitud["items"]:
            self.assertIsNotNone(item["id_tecnico_recogida"])

        self._resincronizar()
        lineas = (
            self.db.query(Devolucion)
            .filter(Devolucion.id_solicitud_dv == solicitud["id_solicitud"])
            .all()
        )
        self.assertEqual(len(lineas), 2)
        self.assertTrue(all(l.estado == "Pendiente" for l in lineas))

        # Ya comprometidas 2 unidades: solo queda 1; el corte queda agotado.
        restante = self._get(
            f"/api/v1/devoluciones/elegibilidad/{pedido.id_pedido}",
            headers=self.headers_cliente,
        ).json()
        disponibles = {p["id_producto"]: p for p in restante["productos"]}
        self.assertEqual(disponibles[unidad.id_producto]["cantidad_disponible"], 1)
        self.assertEqual(disponibles[metro.id_producto]["cantidad_disponible"], 0)
        self.assertTrue(restante["elegible"])

        final = self._crear_solicitud_api(
            pedido, [{"id_producto": unidad.id_producto, "cantidad": 1}]
        )
        self.assertEqual(final["tipo_devolucion"], "total")
        sin_stock = self._get(
            f"/api/v1/devoluciones/elegibilidad/{pedido.id_pedido}",
            headers=self.headers_cliente,
        ).json()
        self.assertFalse(sin_stock["elegible"])
        self.assertIn("devueltos", sin_stock["razon"])

    def test_solicitud_validaciones_y_endpoint_legado(self):
        producto = self._crear_producto(nombre="Validaciones S6", stock=20, precio=12000)
        otro_producto = self._crear_producto(nombre="Ajeno S6", stock=20, precio=12000)
        pendiente = self._crear_pedido_bd(self.cliente, total=24000, estado_entrega="Pendiente")
        self._agregar_detalle(pendiente, producto, cantidad=2, precio_unitario=12000, subtotal=24000)
        no_elegible = self._get(
            f"/api/v1/devoluciones/elegibilidad/{pendiente.id_pedido}",
            headers=self.headers_cliente,
        )
        self.assertEqual(no_elegible.status_code, 200)
        self.assertFalse(no_elegible.json()["elegible"])
        self.assertIn("entregado", no_elegible.json()["razon"])
        self.assertEqual(
            self._post(
                "/api/v1/devoluciones/solicitudes",
                headers=self.headers_cliente,
                json={
                    "id_pedido": pendiente.id_pedido,
                    "items": [{"id_producto": producto.id_producto, "cantidad": 1}],
                    "motivo_tipo": "defectuoso",
                },
            ).status_code,
            400,
        )

        pedido = self._crear_pedido_bd(self.cliente, total=24000, estado_entrega="Entregado")
        self._agregar_detalle(pedido, producto, cantidad=2, precio_unitario=12000, subtotal=24000)

        def solicitar(items, motivo="defectuoso", comentario=None):
            return self._post(
                "/api/v1/devoluciones/solicitudes",
                headers=self.headers_cliente,
                json={
                    "id_pedido": pedido.id_pedido,
                    "items": items,
                    "motivo_tipo": motivo,
                    "motivo_otro": comentario,
                },
            )

        self.assertEqual(solicitar([]).status_code, 400)
        self.assertEqual(solicitar([{"id_producto": producto.id_producto}], motivo="inventado").status_code, 400)
        self.assertEqual(
            solicitar([{"id_producto": producto.id_producto}], motivo="otro").status_code, 400
        )
        self.assertEqual(
            solicitar([{"id_producto": otro_producto.id_producto, "cantidad": 1}]).status_code, 400
        )
        self.assertEqual(
            solicitar([{"id_producto": producto.id_producto, "cantidad": 5}]).status_code, 400
        )
        self.assertEqual(
            solicitar(
                [
                    {"id_producto": producto.id_producto, "cantidad": 2},
                    {"id_producto": producto.id_producto, "cantidad": 1},
                ]
            ).status_code,
            400,
        )

        legado = self._post(
            "/api/v1/devoluciones",
            headers=self.headers_cliente,
            json={
                "id_pedido": pedido.id_pedido,
                "id_producto": producto.id_producto,
                "motivo": "Llegó rayado",
            },
        )
        self.assertEqual(legado.status_code, 200, legado.text)
        cuerpo_legado = legado.json()
        self._ids_devolucion.append(cuerpo_legado["id_devolucion"])
        self._ids_solicitud_dv.append(cuerpo_legado["id_solicitud"])
        self.assertEqual(cuerpo_legado["estado"], "Pendiente")
        self.assertEqual(cuerpo_legado["id_pedido"], pedido.id_pedido)
        self.assertIsNotNone(cuerpo_legado["id_solicitud"])
        self.assertEqual(
            self._post(
                "/api/v1/devoluciones",
                headers=self.headers_otro,
                json={
                    "id_pedido": pedido.id_pedido,
                    "id_producto": producto.id_producto,
                    "motivo": "Ajeno",
                },
            ).status_code,
            404,
        )

    # ── pipeline administrativo y reembolsos ─────────────────────────────
    def test_admin_solicitudes_pipeline_y_reembolso(self):
        producto = self._crear_producto(nombre="Pipeline S6", stock=10, precio=10000)
        pedido = self._pedido_entregado(producto, cantidad=2, precio=10000)
        pago = self._crear_pago_bd(pedido, 20000)
        solicitud = self._crear_solicitud_api(
            pedido, [{"id_producto": producto.id_producto, "cantidad": 2}]
        )
        sid = solicitud["id_solicitud"]

        listado = self._get(
            f"/api/v1/devoluciones/admin/solicitudes?estado=Solicitada",
            headers=self.headers_admin,
        )
        self.assertEqual(listado.status_code, 200, listado.text)
        self.assertIn(sid, [s["id_solicitud"] for s in listado.json()])
        self.assertEqual(
            self._get("/api/v1/devoluciones/admin/solicitudes", headers=self.headers_cliente).status_code,
            401,
        )
        self.assertEqual(
            self._get("/api/v1/devoluciones/admin/solicitudes", headers=self.headers_tecnico).status_code,
            403,
        )

        # Transición inválida: de Solicitada no se puede saltar a Recibida.
        invalida = self._put(
            f"/api/v1/devoluciones/admin/solicitudes/{sid}/estado",
            headers=self.headers_admin,
            json={"estado": "Recibida"},
        )
        self.assertEqual(invalida.status_code, 400)
        nada = self._put(
            f"/api/v1/devoluciones/admin/solicitudes/{sid}/estado",
            headers=self.headers_admin,
            json={},
        )
        self.assertEqual(nada.status_code, 400)
        observaciones = self._put(
            f"/api/v1/devoluciones/admin/solicitudes/{sid}/estado",
            headers=self.headers_admin,
            json={"observaciones": "Revisado por el equipo"},
        )
        self.assertEqual(observaciones.status_code, 200, observaciones.text)
        self.assertEqual(observaciones.json()["observaciones_admin"], "Revisado por el equipo")

        aprobada = self._put(
            f"/api/v1/devoluciones/admin/solicitudes/{sid}/estado",
            headers=self.headers_admin,
            json={"estado": "Aprobada", "resolucion": "Reembolso", "observaciones": "Aprobada S6"},
        )
        self.assertEqual(aprobada.status_code, 200, aprobada.text)
        cuerpo = aprobada.json()
        self.assertEqual(cuerpo["estado"], "Aprobada")
        self.assertEqual(cuerpo["resolucion"], "Reembolso")
        self.assertIsNotNone(cuerpo["id_reembolso"])
        self.assertEqual(cuerpo["reembolso"]["estado"], "Reembolsado")
        self.assertEqual(cuerpo["reembolso"]["monto"], 20000.0)

        self._resincronizar()
        reembolso = (
            self.db.query(Reembolso)
            .filter(Reembolso.id_solicitud_origen == sid)
            .first()
        )
        self.assertIsNotNone(reembolso)
        self.assertEqual(reembolso.id_pedido, pedido.id_pedido)
        self.assertEqual(reembolso.monto, 20000.0)
        self.assertEqual(reembolso.estado, "Reembolsado")
        self.assertEqual(reembolso.numero_transaccion_original, pago.numero_transaccion)
        self.assertTrue(reembolso.numero_transaccion_reembolso)

        repetida = self._put(
            f"/api/v1/devoluciones/admin/solicitudes/{sid}/estado",
            headers=self.headers_admin,
            json={"estado": "Aprobada", "resolucion": "Reembolso"},
        )
        self.assertEqual(repetida.status_code, 400)

        admin_reembolsos = self._get("/api/v1/reembolsos", headers=self.headers_admin)
        self.assertEqual(admin_reembolsos.status_code, 200, admin_reembolsos.text)
        fila = next(r for r in admin_reembolsos.json() if r["id_reembolso"] == reembolso.id_reembolso)
        self.assertEqual(fila["tipo"], "pedido")
        self.assertEqual(fila["cliente_nombre"], "Cliente dvr")

        mis = self._get("/api/v1/reembolsos/mis", headers=self.headers_cliente)
        self.assertEqual(mis.status_code, 200, mis.text)
        self.assertIn(reembolso.id_reembolso, [r["id_reembolso"] for r in mis.json()])
        ajenos = self._get("/api/v1/reembolsos/mis", headers=self.headers_otro)
        self.assertEqual(ajenos.status_code, 200)
        self.assertEqual(ajenos.json(), [])

        elegibles = self._get("/api/v1/reembolsos/elegibles", headers=self.headers_admin)
        self.assertEqual(elegibles.status_code, 200)
        self.assertNotIn(
            pedido.id_pedido,
            [e.get("id_pedido") for e in elegibles.json() if e["tipo"] == "pedido"],
        )
        self.assertEqual(
            self._get("/api/v1/reembolsos", headers=self.headers_tecnico).status_code, 403
        )
        self.assertEqual(
            self._get("/api/v1/reembolsos/mis", headers=self.headers_admin).status_code, 401
        )
        ya_procesado = self._post(
            f"/api/v1/reembolsos/{reembolso.id_reembolso}/procesar",
            headers=self.headers_admin,
            json={},
        )
        self.assertEqual(ya_procesado.status_code, 400)

    def test_reembolsos_de_cita_y_pedido(self):
        cita = self._crear_cita_bd(
            self.cliente,
            estado="Cancelada",
            fecha=self._proxima_laboral(20),
            costo=80000,
            numero_transaccion=f"CITA-{uuid.uuid4().hex[:8]}",
        )
        elegibles = self._get("/api/v1/reembolsos/elegibles", headers=self.headers_admin)
        self.assertEqual(elegibles.status_code, 200, elegibles.text)
        self.assertIn(
            cita.id_cita,
            [e["id_cita"] for e in elegibles.json() if e["tipo"] == "cita"],
        )

        def manual(payload):
            return self._post(
                "/api/v1/reembolsos", headers=self.headers_admin, json=payload
            )

        self.assertEqual(manual({}).status_code, 400)
        self.assertEqual(
            manual({"id_cita": cita.id_cita, "id_pedido": 1}).status_code, 400
        )
        self.assertEqual(manual({"id_cita": 99999999}).status_code, 404)
        self.assertEqual(
            manual({"id_cita": cita.id_cita, "monto": 90000}).status_code, 400
        )

        vigente = self._crear_cita_bd(
            self.cliente, estado="Confirmada", costo=80000, estado_pago="aprobado"
        )
        self.assertEqual(manual({"id_cita": vigente.id_cita}).status_code, 400)
        sin_pago = self._crear_cita_bd(
            self.cliente, estado="Cancelada", costo=80000, estado_pago="pendiente"
        )
        self.assertEqual(manual({"id_cita": sin_pago.id_cita}).status_code, 400)
        sin_valor = self._crear_cita_bd(
            self.cliente, estado="Cancelada", costo=0, estado_pago="aprobado"
        )
        self.assertEqual(manual({"id_cita": sin_valor.id_cita}).status_code, 400)

        creado = manual(
            {"id_cita": cita.id_cita, "monto": 50000, "motivo": "Cancelación S6"}
        )
        self.assertEqual(creado.status_code, 201, creado.text)
        cuerpo_cita = creado.json()
        self.assertEqual(cuerpo_cita["tipo"], "cita")
        self.assertEqual(cuerpo_cita["monto"], 50000.0)
        self.assertEqual(cuerpo_cita["estado"], "Reembolsado")
        self.assertEqual(cuerpo_cita["cliente_nombre"], "Cliente dvr")
        self.assertEqual(manual({"id_cita": cita.id_cita}).status_code, 400)

        pedido = self._crear_pedido_bd(
            self.cliente, total=30000, estado_entrega="Pendiente"
        )
        producto = self._crear_producto(nombre="Reembolso S6", stock=5, precio=30000)
        self._agregar_detalle(pedido, producto, cantidad=1, precio_unitario=30000, subtotal=30000)
        sin_pago_pedido = self._crear_pedido_bd(
            self.otro_cliente, total=30000, estado_entrega="Pendiente"
        )
        self.assertEqual(
            self._post(
                f"/api/v1/reembolsos/pedido/{sin_pago_pedido.id_pedido}",
                headers=self.headers_otro,
                json={},
            ).status_code,
            400,
        )
        entregado = self._crear_pedido_bd(
            self.otro_cliente, total=30000, estado_entrega="Entregado"
        )
        self._crear_pago_bd(entregado, 30000)
        self.assertEqual(
            self._post(
                f"/api/v1/reembolsos/pedido/{entregado.id_pedido}",
                headers=self.headers_otro,
                json={},
            ).status_code,
            400,
        )
        self.assertEqual(
            self._post(
                f"/api/v1/reembolsos/pedido/{pedido.id_pedido}",
                headers=self.headers_otro,
                json={},
            ).status_code,
            404,
        )

        self._crear_pago_bd(pedido, 30000)
        solicitado = self._post(
            f"/api/v1/reembolsos/pedido/{pedido.id_pedido}",
            headers=self.headers_cliente,
            json={"motivo": "Ya no lo necesito"},
        )
        self.assertEqual(solicitado.status_code, 201, solicitado.text)
        cuerpo_pedido = solicitado.json()
        self.assertEqual(cuerpo_pedido["estado"], "Pendiente")
        self.assertEqual(cuerpo_pedido["monto"], 30000.0)
        self.assertEqual(
            self._post(
                f"/api/v1/reembolsos/pedido/{pedido.id_pedido}",
                headers=self.headers_cliente,
                json={},
            ).status_code,
            400,
        )

        procesado = self._post(
            f"/api/v1/reembolsos/{cuerpo_pedido['id_reembolso']}/procesar",
            headers=self.headers_admin,
            json={"porcentaje_cliente": 50},
        )
        self.assertEqual(procesado.status_code, 200, procesado.text)
        self.assertEqual(procesado.json()["estado"], "Reembolsado")
        self.assertEqual(procesado.json()["monto"], 15000.0)
        self.assertEqual(
            self._post(
                f"/api/v1/reembolsos/{cuerpo_pedido['id_reembolso']}/procesar",
                headers=self.headers_admin,
                json={},
            ).status_code,
            400,
        )
        self.assertEqual(
            self._post(
                f"/api/v1/reembolsos/{cuerpo_pedido['id_reembolso']}/procesar",
                headers=self.headers_tecnico,
                json={},
            ).status_code,
            403,
        )

        mis = self._get("/api/v1/reembolsos/mis", headers=self.headers_cliente)
        self.assertEqual(mis.status_code, 200)
        ids = [r["id_reembolso"] for r in mis.json()]
        self.assertIn(cuerpo_cita["id_reembolso"], ids)
        self.assertIn(cuerpo_pedido["id_reembolso"], ids)

    # ── recogidas y evidencias ───────────────────────────────────────────
    def test_recogida_evidencias_stock_y_cambio(self):
        producto = self._crear_producto(nombre="Recogida S6", stock=50, precio=10000)
        pedido = self._pedido_entregado(producto, cantidad=2, precio=10000)
        self._crear_pago_bd(pedido, 20000)
        solicitud = self._crear_solicitud_api(
            pedido, [{"id_producto": producto.id_producto, "cantidad": 2}]
        )
        sid = solicitud["id_solicitud"]
        self._asignar_recogida(sid, self.tecnico.id_tecnico)
        self._aprobar_solicitud(sid, "Reembolso")

        activas = self._get("/api/v1/devoluciones/mis-recogidas", headers=self.headers_tecnico)
        self.assertEqual(activas.status_code, 200, activas.text)
        fila = next(d for d in activas.json() if d["id_pedido"] == pedido.id_pedido)
        self.assertEqual(fila["recogida_estado"], "Asignada")
        self.assertEqual(fila["cliente"], "Cliente dvr")
        ajenas = self._get("/api/v1/devoluciones/mis-recogidas", headers=self.headers_tecnico2)
        self.assertEqual(ajenas.status_code, 200)
        self.assertNotIn(fila["id_devolucion"], [d["id_devolucion"] for d in ajenas.json()])

        ajena = self._put(
            f"/api/v1/devoluciones/{fila['id_devolucion']}/recogida",
            headers=self.headers_tecnico2,
            json={"recogida": True},
        )
        self.assertEqual(ajena.status_code, 404)
        marcada = self._put(
            f"/api/v1/devoluciones/{fila['id_devolucion']}/recogida",
            headers=self.headers_tecnico,
            json={"recogida": True},
        )
        self.assertEqual(marcada.status_code, 200, marcada.text)
        self.assertEqual(marcada.json()["recogida_estado"], "Recogida")
        desmarcada = self._put(
            f"/api/v1/devoluciones/{fila['id_devolucion']}/recogida",
            headers=self.headers_tecnico,
            json={"recogida": False},
        )
        self.assertEqual(desmarcada.json()["recogida_estado"], "Asignada")

        url_evidencia = f"/api/v1/devoluciones/{fila['id_devolucion']}/evidencia-recogida"
        formato = self._post(
            url_evidencia,
            headers=self.headers_tecnico,
            files={"file": ("recogida.txt", b"texto", "text/plain")},
        )
        self.assertEqual(formato.status_code, 400, formato.text)
        corrupta = self._post(
            url_evidencia,
            headers=self.headers_tecnico,
            files={"file": ("recogida.png", b"no-es-png", "image/png")},
        )
        self.assertEqual(corrupta.status_code, 400, corrupta.text)
        no_asignado = self._post(
            url_evidencia,
            headers=self.headers_tecnico2,
            files={"file": ("recogida.png", _png_valido(), "image/png")},
        )
        self.assertEqual(no_asignado.status_code, 404, no_asignado.text)

        stock_antes = float(producto.stock_producto)
        with patch(
            "app.routers.devoluciones.minio_service.subir_imagen_privada",
            return_value="recogidas/s6-recogida.png",
        ):
            subida = self._post(
                url_evidencia,
                headers=self.headers_tecnico,
                files={"file": ("recogida.png", _png_valido(), "image/png")},
            )
        self.assertEqual(subida.status_code, 200, subida.text)
        self.assertEqual(subida.json()["recogida_estado"], "Recogida")
        self.assertTrue(subida.json()["stock_reintegrado"])
        self.assertEqual(subida.json()["cantidad_reintegrada"], 2.0)
        self.assertTrue(subida.json()["evidencia_recogida_url"].endswith("/archivo"))
        repetida = self._post(
            url_evidencia,
            headers=self.headers_tecnico,
            files={"file": ("recogida.png", _png_valido(), "image/png")},
        )
        self.assertEqual(repetida.status_code, 400)

        self._resincronizar()
        producto_db = (
            self.db.query(Producto)
            .filter(Producto.id_producto == producto.id_producto)
            .first()
        )
        self.assertEqual(float(producto_db.stock_producto), stock_antes + 2)
        solicitud_db = (
            self.db.query(SolicitudDevolucion)
            .filter(SolicitudDevolucion.id_solicitud == sid)
            .first()
        )
        self.assertEqual(solicitud_db.estado, "Reembolso procesado")

        activas_post = self._get("/api/v1/devoluciones/mis-recogidas", headers=self.headers_tecnico)
        self.assertNotIn(fila["id_devolucion"], [d["id_devolucion"] for d in activas_post.json()])
        historial = self._get(
            "/api/v1/devoluciones/mis-recogidas?historial=true", headers=self.headers_tecnico
        )
        self.assertIn(fila["id_devolucion"], [d["id_devolucion"] for d in historial.json()])

        with patch(
            "app.routers.devoluciones.minio_service.leer_archivo",
            return_value=(b"PNGDATA", "image/png"),
        ):
            propia = self._get(
                f"/api/v1/devoluciones/{fila['id_devolucion']}/evidencia-recogida/archivo",
                headers=self.headers_cliente,
            )
            ajena_cliente = self._get(
                f"/api/v1/devoluciones/{fila['id_devolucion']}/evidencia-recogida/archivo",
                headers=self.headers_otro,
            )
            tecnico_ok = self._get(
                f"/api/v1/devoluciones/{fila['id_devolucion']}/evidencia-recogida/archivo",
                headers=self.headers_tecnico,
            )
            tecnico_no = self._get(
                f"/api/v1/devoluciones/{fila['id_devolucion']}/evidencia-recogida/archivo",
                headers=self.headers_tecnico2,
            )
            admin_ok = self._get(
                f"/api/v1/devoluciones/{fila['id_devolucion']}/evidencia-recogida/archivo",
                headers=self.headers_admin,
            )
        self.assertEqual(propia.status_code, 200)
        self.assertEqual(propia.content, b"PNGDATA")
        self.assertEqual(ajena_cliente.status_code, 403)
        self.assertEqual(tecnico_ok.status_code, 200)
        self.assertEqual(tecnico_no.status_code, 403)
        self.assertEqual(admin_ok.status_code, 200)

        # Resolución Reembolso: no admite evidencia de cambio.
        no_cambio = self._post(
            f"/api/v1/devoluciones/{fila['id_devolucion']}/evidencia-cambio",
            headers=self.headers_tecnico,
            files={"file": ("cambio.png", _png_valido(), "image/png")},
        )
        self.assertEqual(no_cambio.status_code, 400, no_cambio.text)

        # ── Segunda solicitud con resolución Cambio ──
        producto2 = self._crear_producto(nombre="Cambio S6", stock=10, precio=8000)
        pedido2 = self._pedido_entregado(producto2, cantidad=1, precio=8000)
        self._crear_pago_bd(pedido2, 8000)
        solicitud2 = self._crear_solicitud_api(
            pedido2, [{"id_producto": producto2.id_producto, "cantidad": 1}]
        )
        sid2 = solicitud2["id_solicitud"]
        self._asignar_recogida(sid2, self.tecnico.id_tecnico)
        self._aprobar_solicitud(sid2, "Cambio")
        linea2 = (
            self.db.query(Devolucion)
            .filter(Devolucion.id_solicitud_dv == sid2)
            .first()
        )
        antes_recogida = self._post(
            f"/api/v1/devoluciones/{linea2.id_devolucion}/evidencia-cambio",
            headers=self.headers_tecnico,
            files={"file": ("cambio.png", _png_valido(), "image/png")},
        )
        self.assertEqual(antes_recogida.status_code, 400, antes_recogida.text)
        with patch(
            "app.routers.devoluciones.minio_service.subir_imagen_privada",
            return_value="recogidas/s6-cambio-original.png",
        ):
            recogida2 = self._post(
                f"/api/v1/devoluciones/{linea2.id_devolucion}/evidencia-recogida",
                headers=self.headers_tecnico,
                files={"file": ("recogida.png", _png_valido(), "image/png")},
            )
        self.assertEqual(recogida2.status_code, 200, recogida2.text)
        self._resincronizar()
        estado2 = (
            self.db.query(SolicitudDevolucion)
            .filter(SolicitudDevolucion.id_solicitud == sid2)
            .first()
            .estado
        )
        self.assertEqual(estado2, "Recibida")

        cambio_ajeno = self._post(
            f"/api/v1/devoluciones/{linea2.id_devolucion}/evidencia-cambio",
            headers=self.headers_tecnico2,
            files={"file": ("cambio.png", _png_valido(), "image/png")},
        )
        self.assertEqual(cambio_ajeno.status_code, 404, cambio_ajeno.text)
        with patch(
            "app.routers.devoluciones.minio_service.subir_imagen_privada",
            return_value="recogidas/s6-cambio.png",
        ):
            cambio = self._post(
                f"/api/v1/devoluciones/{linea2.id_devolucion}/evidencia-cambio",
                headers=self.headers_tecnico,
                files={"file": ("cambio.png", _png_valido(), "image/png")},
            )
        self.assertEqual(cambio.status_code, 200, cambio.text)
        self.assertTrue(cambio.json()["evidencia_cambio_url"].endswith("/archivo"))
        self.assertIsNotNone(cambio.json()["fecha_entrega_cambio"])
        repetido = self._post(
            f"/api/v1/devoluciones/{linea2.id_devolucion}/evidencia-cambio",
            headers=self.headers_tecnico,
            files={"file": ("cambio.png", _png_valido(), "image/png")},
        )
        self.assertEqual(repetido.status_code, 400)
        with patch(
            "app.routers.devoluciones.minio_service.leer_archivo",
            return_value=(b"CAMBIO", "image/png"),
        ):
            descarga = self._get(
                f"/api/v1/devoluciones/{linea2.id_devolucion}/evidencia-cambio/archivo",
                headers=self.headers_cliente,
            )
            descarga_ajena = self._get(
                f"/api/v1/devoluciones/{linea2.id_devolucion}/evidencia-cambio/archivo",
                headers=self.headers_otro,
            )
        self.assertEqual(descarga.status_code, 200)
        self.assertEqual(descarga.content, b"CAMBIO")
        self.assertEqual(descarga_ajena.status_code, 403)

    def test_admin_devoluciones_reasignacion_y_resolucion_legado(self):
        producto = self._crear_producto(nombre="Legado S6", stock=10, precio=10000)
        pedido = self._pedido_entregado(producto, cantidad=2, precio=10000)
        self._crear_pago_bd(pedido, 20000)
        devolucion = self._crear_devolucion_bd(
            self.cliente,
            pedido=pedido,
            producto=producto,
            cantidad=2,
            id_tecnico_recogida=self.tecnico.id_tecnico,
        )

        listado = self._get("/api/v1/devoluciones", headers=self.headers_admin)
        self.assertEqual(listado.status_code, 200, listado.text)
        self.assertIn(devolucion.id_devolucion, [d["id_devolucion"] for d in listado.json()])
        self.assertEqual(
            self._get("/api/v1/devoluciones", headers=self.headers_cliente).status_code, 401
        )
        self.assertEqual(
            self._get("/api/v1/devoluciones", headers=self.headers_tecnico).status_code, 403
        )
        mias = self._get("/api/v1/devoluciones/mias", headers=self.headers_cliente)
        self.assertEqual(mias.status_code, 200)
        self.assertIn(devolucion.id_devolucion, [d["id_devolucion"] for d in mias.json()])
        ajenas = self._get("/api/v1/devoluciones/mias", headers=self.headers_otro)
        self.assertEqual(ajenas.status_code, 200)
        self.assertNotIn(devolucion.id_devolucion, [d["id_devolucion"] for d in ajenas.json()])

        reasignada = self._put(
            f"/api/v1/devoluciones/admin/{devolucion.id_devolucion}/reasignar-tecnico",
            headers=self.headers_admin,
            json={"id_tecnico": self.tecnico2.id_tecnico},
        )
        self.assertEqual(reasignada.status_code, 200, reasignada.text)
        self.assertEqual(reasignada.json()["id_tecnico_anterior"], self.tecnico.id_tecnico)
        self.assertEqual(reasignada.json()["id_tecnico_nuevo"], self.tecnico2.id_tecnico)
        self.assertEqual(
            self._put(
                f"/api/v1/devoluciones/admin/{devolucion.id_devolucion}/reasignar-tecnico",
                headers=self.headers_admin,
                json={"id_tecnico": self.tecnico2.id_tecnico},
            ).status_code,
            400,
        )
        self.assertEqual(
            self._put(
                "/api/v1/devoluciones/admin/99999999/reasignar-tecnico",
                headers=self.headers_admin,
                json={"id_tecnico": self.tecnico2.id_tecnico},
            ).status_code,
            404,
        )
        self.assertEqual(
            self._put(
                f"/api/v1/devoluciones/admin/{devolucion.id_devolucion}/reasignar-tecnico",
                headers=self.headers_admin,
                json={"id_tecnico": 99999999},
            ).status_code,
            404,
        )
        inactivo_user, inactivo = self._crear_tecnico("inactivo")
        inactivo_user.is_active = False
        self.db.commit()
        self.assertEqual(
            self._put(
                f"/api/v1/devoluciones/admin/{devolucion.id_devolucion}/reasignar-tecnico",
                headers=self.headers_admin,
                json={"id_tecnico": inactivo.id_tecnico},
            ).status_code,
            404,
        )

        self.assertEqual(
            self._put(
                f"/api/v1/devoluciones/{devolucion.id_devolucion}/estado",
                headers=self.headers_admin,
                json={"estado": "Pendiente"},
            ).status_code,
            400,
        )
        self.assertEqual(
            self._put(
                f"/api/v1/devoluciones/{devolucion.id_devolucion}/estado",
                headers=self.headers_admin,
                json={"estado": "Aprobada"},
            ).status_code,
            400,
        )
        aprobada = self._put(
            f"/api/v1/devoluciones/{devolucion.id_devolucion}/estado",
            headers=self.headers_admin,
            json={"estado": "Aprobada", "resolucion": "Reembolso"},
        )
        self.assertEqual(aprobada.status_code, 200, aprobada.text)
        self.assertEqual(aprobada.json()["estado"], "Aprobada")
        self.assertEqual(aprobada.json()["resolucion"], "Reembolso")
        self._resincronizar()
        self.db.refresh(devolucion)
        self.assertEqual(devolucion.estado, "Aprobada")
        reembolso = (
            self.db.query(Reembolso)
            .filter(Reembolso.id_pedido == pedido.id_pedido)
            .first()
        )
        self.assertIsNotNone(reembolso)
        self.assertEqual(reembolso.estado, "Pendiente")
        self.assertEqual(reembolso.monto, 20000.0)
        self.assertEqual(
            self._put(
                f"/api/v1/devoluciones/{devolucion.id_devolucion}/estado",
                headers=self.headers_admin,
                json={"estado": "Aprobada", "resolucion": "Reembolso"},
            ).status_code,
            400,
        )

        rechazable = self._crear_devolucion_bd(
            self.cliente, pedido=pedido, producto=producto, id_tecnico_recogida=self.tecnico2.id_tecnico
        )
        rechazada = self._put(
            f"/api/v1/devoluciones/{rechazable.id_devolucion}/estado",
            headers=self.headers_admin,
            json={"estado": "Rechazada"},
        )
        self.assertEqual(rechazada.status_code, 200, rechazada.text)
        self.assertEqual(rechazada.json()["estado"], "Rechazada")
        self.assertIsNone(rechazada.json()["resolucion"])
        self.assertEqual(
            self._put(
                "/api/v1/devoluciones/99999999/estado",
                headers=self.headers_admin,
                json={"estado": "Rechazada"},
            ).status_code,
            404,
        )
        historial_tec = self._get(
            "/api/v1/devoluciones/mis-recogidas?historial=true",
            headers=self.headers_tecnico2,
        )
        self.assertEqual(historial_tec.status_code, 200)
        self.assertIn(
            rechazable.id_devolucion,
            [d["id_devolucion"] for d in historial_tec.json()],
        )

    # ── novedades: catálogos y creación por el técnico ───────────────────
    def test_novedades_tecnicos_catalogos_creacion_y_evidencias(self):
        producto = self._crear_producto(nombre="Novedad S6", stock=5, precio=10000)
        pedido = self._crear_pedido_bd(
            self.cliente,
            total=10000,
            estado_entrega="Asignada",
            id_tecnico_entrega=self.tecnico.id_tecnico,
            nombre_tecnico_entrega="TECNICO DVR",
        )
        self._agregar_detalle(pedido, producto, cantidad=1, precio_unitario=10000, subtotal=10000)
        cita = self._crear_cita_bd(
            self.cliente,
            fecha=self._proxima_laboral(),
            id_tecnico=self.tecnico.id_tecnico,
        )
        devolucion = self._crear_devolucion_bd(
            self.cliente,
            pedido=pedido,
            producto=producto,
            id_tecnico_recogida=self.tecnico.id_tecnico,
        )
        pedido_ajeno = self._crear_pedido_bd(
            self.otro_cliente,
            total=0,
            estado_entrega="Asignada",
            id_tecnico_entrega=self.tecnico2.id_tecnico,
        )
        cita_ajena = self._crear_cita_bd(
            self.otro_cliente, fecha=self._proxima_laboral(31), id_tecnico=self.tecnico2.id_tecnico
        )

        self.assertEqual(self._get("/api/v1/novedades/tipos").status_code, 200)
        estados = self._get("/api/v1/novedades/estados")
        self.assertEqual(estados.status_code, 200)
        self.assertIn("Pendiente", estados.json())
        self.assertEqual(self._get("/api/v1/novedades/prioridades").status_code, 200)
        catalogos = self._get("/api/v1/novedades/catalogos")
        self.assertEqual(catalogos.status_code, 200)
        self.assertTrue({"tipos", "estados", "prioridades"} <= set(catalogos.json()))

        clientes = self._get(
            "/api/v1/novedades/clientes-buscar?q=dvr", headers=self.headers_tecnico
        )
        self.assertEqual(clientes.status_code, 200, clientes.text)
        self.assertIn(self.cliente.id_cliente, [c["id_cliente"] for c in clientes.json()])
        self.assertEqual(
            self._get("/api/v1/novedades/clientes-buscar", headers=self.headers_cliente).status_code,
            401,
        )
        pedidos_cliente = self._get(
            f"/api/v1/novedades/clientes/{self.cliente.id_cliente}/pedidos",
            headers=self.headers_tecnico,
        )
        self.assertEqual(pedidos_cliente.status_code, 200)
        self.assertIn(pedido.id_pedido, [p["id_pedido"] for p in pedidos_cliente.json()])
        citas_cliente = self._get(
            f"/api/v1/novedades/clientes/{self.cliente.id_cliente}/citas",
            headers=self.headers_tecnico,
        )
        self.assertEqual(citas_cliente.status_code, 200)
        self.assertIn(cita.id_cita, [c["id_cita"] for c in citas_cliente.json()])
        ajenos = self._get(
            f"/api/v1/novedades/clientes/{self.cliente.id_cliente}/pedidos",
            headers=self.headers_tecnico2,
        )
        self.assertEqual(ajenos.status_code, 200)
        self.assertEqual(ajenos.json(), [])

        def crear(payload):
            return self._post("/api/v1/novedades", headers=self.headers_tecnico, json=payload)

        self.assertEqual(
            crear({"tipo_novedad": "Inventado", "descripcion": "X"}).status_code, 400
        )
        self.assertEqual(
            crear({"tipo_novedad": "Otro", "descripcion": "X", "prioridad": "altísima"}).status_code,
            400,
        )
        self.assertEqual(
            crear(
                {
                    "tipo_novedad": "Otro",
                    "descripcion": "Ajeno",
                    "id_pedido": pedido_ajeno.id_pedido,
                }
            ).status_code,
            403,
        )
        self.assertEqual(
            crear(
                {
                    "tipo_novedad": "Otro",
                    "descripcion": "Cita ajena",
                    "id_cita": cita_ajena.id_cita,
                }
            ).status_code,
            403,
        )
        self.assertEqual(
            crear(
                {
                    "tipo_novedad": "Otro",
                    "descripcion": "Sin devolución",
                    "id_devolucion": 99999999,
                }
            ).status_code,
            404,
        )

        sin_cliente = crear({"tipo_novedad": "Otro", "descripcion": "Sin relaciones"})
        self.assertEqual(sin_cliente.status_code, 200, sin_cliente.text)
        self._ids_novedad.append(sin_cliente.json()["id_novedad"])

        creada = crear(
            {
                "tipo_novedad": "Producto dañado",
                "descripcion": "La caja llegó golpeada",
                "prioridad": "alta",
                "id_pedido": pedido.id_pedido,
                "lugar_ocurrencia": "Bodega S6",
            }
        )
        self.assertEqual(creada.status_code, 200, creada.text)
        novedad_id = creada.json()["id_novedad"]
        self._ids_novedad.append(novedad_id)
        self._resincronizar()
        from app.models.novedad import Novedad

        novedad_db = self.db.query(Novedad).filter(Novedad.id_novedad == novedad_id).first()
        self.assertEqual(novedad_db.id_tecnico_n, self.tecnico.id_tecnico)
        self.assertEqual(novedad_db.id_cliente, self.cliente.id_cliente)
        self.assertEqual(novedad_db.estado_novedad, "Pendiente")
        self.assertEqual(novedad_db.lugar_ocurrencia, "Bodega S6")

        por_cita = crear(
            {
                "tipo_novedad": "Cita no realizada",
                "descripcion": "El cliente no estaba",
                "id_cita": cita.id_cita,
            }
        )
        self.assertEqual(por_cita.status_code, 200, por_cita.text)
        self._ids_novedad.append(por_cita.json()["id_novedad"])
        por_devolucion = crear(
            {
                "tipo_novedad": "Problema durante la recogida",
                "descripcion": "No había quién entregara",
                "id_devolucion": devolucion.id_devolucion,
            }
        )
        self.assertEqual(por_devolucion.status_code, 200, por_devolucion.text)
        self._ids_novedad.append(por_devolucion.json()["id_novedad"])

        mias = self._get("/api/v1/novedades/mis-novedades", headers=self.headers_tecnico)
        self.assertEqual(mias.status_code, 200, mias.text)
        self.assertIn(novedad_id, [n["id_novedad"] for n in mias.json()])
        ajenas = self._get("/api/v1/novedades/mis-novedades", headers=self.headers_tecnico2)
        self.assertEqual(ajenas.status_code, 200)
        self.assertNotIn(novedad_id, [n["id_novedad"] for n in ajenas.json()])

        url_evidencia = f"/api/v1/novedades/{novedad_id}/evidencia"
        self.assertEqual(
            self._post(
                url_evidencia,
                headers=self.headers_tecnico2,
                files={"file": ("foto.png", _png_valido(), "image/png")},
            ).status_code,
            403,
        )
        self.assertEqual(
            self._post(
                url_evidencia,
                headers=self.headers_tecnico,
                files={"file": ("foto.pdf", b"%PDF", "application/pdf")},
            ).status_code,
            400,
        )
        self.assertEqual(
            self._post(
                url_evidencia,
                headers=self.headers_tecnico,
                files={"file": ("foto.png", b"corrupta", "image/png")},
            ).status_code,
            400,
        )
        with patch(
            "app.routers.novedades.minio_service.subir_imagen_privada",
            return_value="evidencias_novedades/s6.png",
        ):
            subida = self._post(
                url_evidencia,
                headers=self.headers_tecnico,
                files={"file": ("foto.png", _png_valido(), "image/png")},
                data={"descripcion": "Evidencia S6"},
            )
        self.assertEqual(subida.status_code, 200, subida.text)
        evidencia_id = subida.json()["id_evidencia_n"]

        listado = self._get(
            f"/api/v1/novedades/{novedad_id}/evidencias", headers=self.headers_tecnico
        )
        self.assertEqual(listado.status_code, 200)
        self.assertEqual(len(listado.json()), 1)
        self.assertEqual(listado.json()[0]["descripcion"], "Evidencia S6")
        from app.models.novedad import EvidenciaNovedad

        self._resincronizar()
        self.assertIsNotNone(
            self.db.query(EvidenciaNovedad)
            .filter(EvidenciaNovedad.id_evidencia_n == evidencia_id)
            .first()
        )
        self.assertEqual(
            self._get(
                f"/api/v1/novedades/{novedad_id}/evidencias", headers=self.headers_tecnico2
            ).status_code,
            403,
        )
        self.assertEqual(
            self._get(
                f"/api/v1/novedades/{novedad_id}/evidencias", headers=self.headers_admin
            ).status_code,
            200,
        )
        with patch(
            "app.routers.novedades.minio_service.leer_archivo",
            return_value=(b"PNGDATA", "image/png"),
        ):
            descarga_admin = self._get(
                f"/api/v1/novedades/evidencias/{evidencia_id}/archivo",
                headers=self.headers_admin,
            )
            descarga_cliente_oculta = self._get(
                f"/api/v1/novedades/evidencias/{evidencia_id}/archivo",
                headers=self.headers_cliente,
            )
            descarga_ajena = self._get(
                f"/api/v1/novedades/evidencias/{evidencia_id}/archivo",
                headers=self.headers_otro,
            )
        self.assertEqual(descarga_admin.status_code, 200)
        self.assertEqual(descarga_admin.content, b"PNGDATA")
        # Recién creada, la novedad no es visible al cliente.
        # El endpoint oculta evidencias no visibles o de otro cliente como 404.
        self.assertEqual(descarga_cliente_oculta.status_code, 404)
        self.assertEqual(descarga_ajena.status_code, 404)

        visible = self._post(
            f"/api/v1/novedades/{novedad_id}/mensaje-cliente",
            headers=self.headers_admin,
            json={"mensaje_cliente": "Adjuntamos la evidencia", "cliente_visible": True},
        )
        self.assertEqual(visible.status_code, 200, visible.text)
        with patch(
            "app.routers.novedades.minio_service.leer_archivo",
            return_value=(b"PNGDATA", "image/png"),
        ):
            descarga_cliente = self._get(
                f"/api/v1/novedades/evidencias/{evidencia_id}/archivo",
                headers=self.headers_cliente,
            )
        self.assertEqual(descarga_cliente.status_code, 200)
        self.assertEqual(descarga_cliente.content, b"PNGDATA")

        self.assertEqual(
            self._get(f"/api/v1/novedades/{novedad_id}", headers=self.headers_tecnico2).status_code,
            403,
        )
        detalle_cliente = self._get(
            f"/api/v1/novedades/{novedad_id}", headers=self.headers_cliente
        )
        self.assertEqual(detalle_cliente.status_code, 200, detalle_cliente.text)
        self.assertEqual(
            self._get(f"/api/v1/novedades/{novedad_id}", headers=self.headers_otro).status_code,
            404,
        )
        self.assertEqual(
            self._get("/api/v1/novedades/99999999", headers=self.headers_admin).status_code,
            404,
        )
        cliente_novedades = self._get(
            "/api/v1/novedades/cliente/novedades", headers=self.headers_cliente
        )
        self.assertEqual(cliente_novedades.status_code, 200)
        self.assertIn(novedad_id, [n["id_novedad"] for n in cliente_novedades.json()])

    # ── novedades: administración, mensajes y cupones ────────────────────
    def test_novedades_admin_estados_mensajes_cupones_y_reasignacion(self):
        producto = self._crear_producto(nombre="Cupon S6", stock=5, precio=10000)
        pedido = self._crear_pedido_bd(
            self.cliente,
            total=10000,
            estado_entrega="Asignada",
            id_tecnico_entrega=self.tecnico.id_tecnico,
        )
        self._agregar_detalle(pedido, producto, cantidad=1, precio_unitario=10000, subtotal=10000)
        creada = self._post(
            "/api/v1/novedades",
            headers=self.headers_tecnico,
            json={
                "tipo_novedad": "Otro",
                "descripcion": "Novedad para flujo admin",
                "prioridad": "alta",
                "id_pedido": pedido.id_pedido,
            },
        )
        self.assertEqual(creada.status_code, 200, creada.text)
        novedad_id = creada.json()["id_novedad"]
        self._ids_novedad.append(novedad_id)

        self.assertEqual(
            self._get("/api/v1/novedades", headers=self.headers_cliente).status_code, 401
        )
        self.assertEqual(
            self._get("/api/v1/novedades", headers=self.headers_tecnico).status_code, 403
        )
        listado = self._get(
            f"/api/v1/novedades?id_pedido={pedido.id_pedido}"
            f"&id_tecnico={self.tecnico.id_tecnico}"
            f"&id_cliente={self.cliente.id_cliente}"
            "&estado=Pendiente&prioridad=alta&tipo_origen=pedido&con_evidencia=false"
            f"&fecha_desde={date.today() - timedelta(days=1)}"
            f"&fecha_hasta={date.today() + timedelta(days=1)}",
            headers=self.headers_admin,
        )
        self.assertEqual(listado.status_code, 200, listado.text)
        self.assertIn(novedad_id, [n["id_novedad"] for n in listado.json()])
        self.assertEqual(
            self._get(
                f"/api/v1/novedades?tipo_origen=cita&id_pedido={pedido.id_pedido}",
                headers=self.headers_admin,
            ).json(),
            [],
        )
        filtros = self._get("/api/v1/novedades/admin/filtros", headers=self.headers_admin)
        self.assertEqual(filtros.status_code, 200, filtros.text)
        self.assertIn(
            self.tecnico.id_tecnico,
            [t["id_tecnico"] for t in filtros.json()["tecnicos"]],
        )
        self.assertIn(
            self.cliente.id_cliente,
            [c["id_cliente"] for c in filtros.json()["clientes"]],
        )

        invalido = self._put(
            f"/api/v1/novedades/{novedad_id}/estado",
            headers=self.headers_admin,
            json={"nuevo_estado": "Inventado"},
        )
        self.assertEqual(invalido.status_code, 400)
        cambio = self._put(
            f"/api/v1/novedades/{novedad_id}/estado",
            headers=self.headers_admin,
            json={"nuevo_estado": "En revisión", "accion_detalle": "Tomada por soporte"},
        )
        self.assertEqual(cambio.status_code, 200, cambio.text)
        self.assertEqual(
            self._put(
                "/api/v1/novedades/99999999/estado",
                headers=self.headers_admin,
                json={"nuevo_estado": "En revisión"},
            ).status_code,
            404,
        )
        respuesta = self._post(
            f"/api/v1/novedades/{novedad_id}/responder",
            headers=self.headers_admin,
            json={"respuesta": "Estamos revisando el caso"},
        )
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        self.assertEqual(
            self._post(
                "/api/v1/novedades/99999999/responder",
                headers=self.headers_admin,
                json={"respuesta": "X"},
            ).status_code,
            404,
        )
        mensaje = self._post(
            f"/api/v1/novedades/{novedad_id}/mensaje-cliente",
            headers=self.headers_admin,
            json={
                "mensaje_cliente": "Tu caso está en revisión",
                "solucion_cliente": "Te contactaremos",
                "cliente_visible": True,
            },
        )
        self.assertEqual(mensaje.status_code, 200, mensaje.text)
        self.assertTrue(mensaje.json()["cliente_visible"])
        oculto = self._post(
            f"/api/v1/novedades/{novedad_id}/mensaje-cliente",
            headers=self.headers_admin,
            json={"mensaje_cliente": "Interno", "cliente_visible": False},
        )
        self.assertEqual(oculto.status_code, 200)
        self.assertEqual(
            self._get(
                f"/api/v1/novedades/{novedad_id}", headers=self.headers_cliente
            ).status_code,
            404,
        )
        self._post(
            f"/api/v1/novedades/{novedad_id}/mensaje-cliente",
            headers=self.headers_admin,
            json={"mensaje_cliente": "Visible de nuevo", "cliente_visible": True},
        )
        detalle = self._get(
            f"/api/v1/novedades/{novedad_id}", headers=self.headers_cliente
        )
        self.assertEqual(detalle.status_code, 200, detalle.text)
        self.assertEqual(detalle.json()["estado_novedad"], "En revisión")

        cambio_tec = self._put(
            f"/api/v1/novedades/{novedad_id}/cambiar-tecnico",
            headers=self.headers_admin,
            json={"id_nuevo_tecnico": self.tecnico2.id_tecnico, "motivo": "Carga de trabajo"},
        )
        self.assertEqual(cambio_tec.status_code, 200, cambio_tec.text)
        self._resincronizar()
        from app.models.novedad import Novedad

        novedad_db = self.db.query(Novedad).filter(Novedad.id_novedad == novedad_id).first()
        self.assertEqual(novedad_db.id_tecnico_n, self.tecnico2.id_tecnico)
        self.assertEqual(
            self._get(
                f"/api/v1/novedades/{novedad_id}", headers=self.headers_tecnico
            ).status_code,
            403,
        )
        self.assertEqual(
            self._get(
                f"/api/v1/novedades/{novedad_id}", headers=self.headers_tecnico2
            ).status_code,
            200,
        )

        cupon = self._post(
            f"/api/v1/novedades/{novedad_id}/cupon",
            headers=self.headers_admin,
            json={
                "codigo": f"s6promo{uuid.uuid4().hex[:6]}",
                "tipo_descuento": "porcentaje",
                "valor_descuento": 15,
                "fecha_vencimiento": str(date.today() + timedelta(days=30)),
                "compra_minima": 50000,
                "usos_maximos": 2,
            },
        )
        self.assertEqual(cupon.status_code, 200, cupon.text)
        cuerpo_cupon = cupon.json()
        self._ids_cupon.append(cuerpo_cupon["id_cupon"])
        codigo = cuerpo_cupon["codigo"]
        self.assertEqual(codigo, codigo.upper())
        self.assertEqual(
            self._post(
                f"/api/v1/novedades/{novedad_id}/cupon",
                headers=self.headers_admin,
                json={
                    "codigo": codigo.lower(),
                    "tipo_descuento": "porcentaje",
                    "valor_descuento": 10,
                },
            ).status_code,
            400,
        )
        for invalido_cupon in (
            {"codigo": "X1", "tipo_descuento": "inventado", "valor_descuento": 10},
            {"codigo": "X2", "tipo_descuento": "porcentaje", "valor_descuento": 0},
            {"codigo": "X3", "tipo_descuento": "porcentaje", "valor_descuento": 101},
            {"codigo": "X4", "tipo_descuento": "fijo", "valor_descuento": 5000, "usos_maximos": 0},
        ):
            self.assertEqual(
                self._post(
                    f"/api/v1/novedades/{novedad_id}/cupon",
                    headers=self.headers_admin,
                    json=invalido_cupon,
                ).status_code,
                400,
                invalido_cupon,
            )

        validado = self._get(
            f"/api/v1/novedades/cupones/validar?codigo={codigo}", headers=self.headers_cliente
        )
        self.assertEqual(validado.status_code, 200, validado.text)
        self.assertEqual(validado.json()["codigo"], codigo)
        self.assertEqual(
            self._get(
                f"/api/v1/novedades/cupones/validar?codigo={codigo}", headers=self.headers_otro
            ).status_code,
            404,
        )
        self.assertEqual(
            self._get(
                "/api/v1/novedades/cupones/validar?codigo=NOEXISTE", headers=self.headers_cliente
            ).status_code,
            404,
        )
        mis_cupones = self._get(
            "/api/v1/novedades/cliente/mis-cupones", headers=self.headers_cliente
        )
        self.assertEqual(mis_cupones.status_code, 200)
        self.assertIn(codigo, [c["codigo"] for c in mis_cupones.json()])
        cupones_admin = self._get(
            f"/api/v1/novedades/cliente/{self.cliente.id_cliente}/cupones",
            headers=self.headers_admin,
        )
        self.assertEqual(cupones_admin.status_code, 200)
        self.assertIn(codigo, [c["codigo"] for c in cupones_admin.json()])

        self._resincronizar()
        from app.models.novedad import CuponDescuento

        cupon_db = (
            self.db.query(CuponDescuento)
            .filter(CuponDescuento.id_cupon == cuerpo_cupon["id_cupon"])
            .first()
        )
        cupon_db.fecha_vencimiento = date.today() - timedelta(days=1)
        self.db.commit()
        self.assertEqual(
            self._get(
                f"/api/v1/novedades/cupones/validar?codigo={codigo}", headers=self.headers_cliente
            ).status_code,
            404,
        )
        mis_vencidos = self._get(
            "/api/v1/novedades/cliente/mis-cupones", headers=self.headers_cliente
        ).json()
        self.assertNotIn(codigo, [c["codigo"] for c in mis_vencidos])

        sin_cliente = self._crear_novedad_bd(
            tecnico=self.tecnico2, descripcion="Sin cliente para cupón"
        )
        self.assertEqual(
            self._post(
                f"/api/v1/novedades/{sin_cliente.id_novedad}/cupon",
                headers=self.headers_admin,
                json={"codigo": "SINCLI", "tipo_descuento": "fijo", "valor_descuento": 1000},
            ).status_code,
            400,
        )


if __name__ == "__main__":
    unittest.main()
