"""S6 — Integración del ciclo de vida de citas con MySQL real.

Ejercita la creación de citas (asignación explícita y automática), las
validaciones de franja/pago, la gestión administrativa (estado, equipo,
comisiones, cancelación con reembolso), la reasignación con historial, las
ofertas de horarios liberados y los productos asociados a una cita.
"""
import unittest
import uuid
from datetime import date, datetime, timedelta
from unittest.mock import patch

import app.tests.testdb  # noqa: F401

from app.models.cita import Cita
from app.models.especializacion import HistorialCita, Reembolso
from app.models.oferta_horario import OfertaHorario
from app.models.tecnico import Tecnico
from app.tests.s6_base import BaseS6TestCase


class CitasIntegracionTestCase(BaseS6TestCase):
    def setUp(self):
        super().setUp()
        self.admin = self._crear_admin("cit")
        self.cliente = self._crear_cliente("cit")
        self.otro_cliente = self._crear_cliente("cit2")
        self.tecnico_user, self.tecnico = self._crear_tecnico("cit")
        self.tecnico2_user, self.tecnico2 = self._crear_tecnico("cit2")
        self.headers_admin = self._bearer(self._token(self._login(self.admin.email)))
        self.headers_cliente = self._bearer(self._token(self._login(self.cliente.email)))
        self.headers_otro = self._bearer(self._token(self._login(self.otro_cliente.email)))
        self.headers_tecnico = self._bearer(self._token(self._login(self.tecnico_user.email)))
        self.headers_tecnico2 = self._bearer(self._token(self._login(self.tecnico2_user.email)))

    def _fecha(self, minimo: int = 30) -> date:
        """Fecha laborable única dentro de un rango amplio."""
        dia = date.today() + timedelta(days=minimo + (uuid.uuid4().int % 120))
        while dia.weekday() == 6:
            dia += timedelta(days=1)
        return dia

    def _payload_cita(self, fecha, *, id_tecnico=None, metodo="tarjeta_credito", **extra):
        datos = {
            "tipo_servicio": "mantenimiento",
            "fecha": str(fecha),
            "hora": "08:00",
            "direccion": "Carrera 45 # 26-15, Bogotá",
            "descripcion": "Servicio de integración S6",
            "metodo_pago": metodo,
            "datos_pago": self._datos_tarjeta(),
        }
        if id_tecnico is not None:
            datos["id_tecnico"] = id_tecnico
        datos.update(extra)
        return datos

    def _crear_cita_http(self, fecha, **kwargs):
        r = self._post(
            "/api/v1/citas",
            headers=self.headers_cliente,
            json=self._payload_cita(fecha, **kwargs),
        )
        self.assertEqual(r.status_code, 200, r.text)
        self._track_cita(r.json()["id_cita"])
        return r.json()

    # ── creación ──────────────────────────────────────────────────────────
    def test_crear_cita_con_tecnico_explicito_y_pago_aprobado(self):
        fecha = self._fecha(30)
        cuerpo = self._crear_cita_http(fecha, id_tecnico=self.tecnico.id_tecnico)
        self.assertEqual(cuerpo["estado"], "Confirmada")
        self.assertEqual(cuerpo["estado_pago"], "aprobado")
        self.assertEqual(cuerpo["id_tecnico"], self.tecnico.id_tecnico)
        self.assertTrue(cuerpo["numero_transaccion"])

        self._resincronizar()
        cita = self.db.query(Cita).filter(Cita.id_cita == cuerpo["id_cita"]).first()
        self.assertIsNotNone(cita)
        self.assertEqual(cita.tipo_servicio, "mantenimiento")
        self.assertEqual(float(cita.costo_cita), 80000.0)

    def test_crear_cita_autoasigna_tecnico_disponible(self):
        fecha = self._fecha(40)
        r = self._post(
            "/api/v1/citas",
            headers=self.headers_cliente,
            json=self._payload_cita(fecha, metodo="punto_pago", datos_pago={"punto_pago": "Efecty"}),
        )
        self.assertEqual(r.status_code, 200, r.text)
        cuerpo = r.json()
        self._track_cita(cuerpo["id_cita"])
        self.assertIsNotNone(cuerpo["id_tecnico"])
        self.assertEqual(cuerpo["estado_pago"], "pendiente")

    def test_crear_cita_valida_pago_franja_y_tarifa(self):
        fecha = self._fecha(50)
        pasado = self._post(
            "/api/v1/citas",
            headers=self.headers_cliente,
            json=self._payload_cita(date.today() - timedelta(days=1)),
        )
        self.assertEqual(pasado.status_code, 400, pasado.text)

        # Hoy a una hora ya pasada (o con menos de 3 h de anticipación).
        hoy = self._post(
            "/api/v1/citas",
            headers=self.headers_cliente,
            json=self._payload_cita(date.today(), hora="00:30"),
        )
        self.assertEqual(hoy.status_code, 400, hoy.text)

        domingo = date.today() + timedelta(days=1)
        while domingo.weekday() != 6:
            domingo += timedelta(days=1)
        finde = self._post(
            "/api/v1/citas",
            headers=self.headers_cliente,
            json=self._payload_cita(domingo),
        )
        self.assertEqual(finde.status_code, 400, finde.text)

        hora_invalida = self._post(
            "/api/v1/citas",
            headers=self.headers_cliente,
            json=self._payload_cita(fecha, hora="07:00"),
        )
        self.assertEqual(hora_invalida.status_code, 400, hora_invalida.text)

        sin_tarifa = self._post(
            "/api/v1/citas",
            headers=self.headers_cliente,
            json=self._payload_cita(fecha, tipo_servicio="servicio_sin_tarifa"),
        )
        self.assertEqual(sin_tarifa.status_code, 400, sin_tarifa.text)

        metodo_invalido = self._post(
            "/api/v1/citas",
            headers=self.headers_cliente,
            json=self._payload_cita(fecha, metodo="bitcoin"),
        )
        self.assertEqual(metodo_invalido.status_code, 400, metodo_invalido.text)

        segundo_sin_principal = self._post(
            "/api/v1/citas",
            headers=self.headers_cliente,
            json=self._payload_cita(fecha, id_tecnico_2=self.tecnico2.id_tecnico),
        )
        self.assertEqual(segundo_sin_principal.status_code, 400, segundo_sin_principal.text)

    def test_crear_cita_rechaza_tecnico_inexistente_o_inactivo(self):
        fecha = self._fecha(60)
        inexistente = self._post(
            "/api/v1/citas",
            headers=self.headers_cliente,
            json=self._payload_cita(fecha, id_tecnico=99999999),
        )
        self.assertEqual(inexistente.status_code, 400, inexistente.text)

        inactivo_user = self._crear_usuario("inact", 2, activo=False)
        inactivo = Tecnico(id_usuario_t=inactivo_user.id_usuario, certificacion_t="")
        self.db.add(inactivo)
        self.db.commit()
        self.db.refresh(inactivo)
        r = self._post(
            "/api/v1/citas",
            headers=self.headers_cliente,
            json=self._payload_cita(fecha, id_tecnico=inactivo.id_tecnico),
        )
        self.assertEqual(r.status_code, 409, r.text)
        self.assertIn("disponible", r.json()["detail"].lower())

    def test_crear_cita_equipo_con_tecnico_repetido(self):
        fecha = self._fecha(70)
        r = self._post(
            "/api/v1/citas",
            headers=self.headers_cliente,
            json=self._payload_cita(
                fecha,
                id_tecnico=self.tecnico.id_tecnico,
                id_tecnico_2=self.tecnico.id_tecnico,
            ),
        )
        self.assertIn(r.status_code, (400, 422), r.text)

    # ── disponibilidad ────────────────────────────────────────────────────
    def test_horas_disponibles_por_tecnico_y_tipo(self):
        fecha = self._fecha(80)
        r = self._get(
            f"/api/v1/citas/horas-disponibles?fecha={fecha}&tecnico_id={self.tecnico.id_tecnico}",
            headers=self.headers_cliente,
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIsInstance(r.json(), list)
        self.assertIn("08:00", r.json())

        producto = self._crear_producto(stock=10)
        items = f'[{{"id_producto": {producto.id_producto}, "cantidad": 1}}]'
        con_items = self._get(
            f"/api/v1/citas/horas-disponibles?fecha={fecha}&tipo_servicio=mantenimiento"
            f"&items={items}",
            headers=self.headers_cliente,
        )
        self.assertEqual(con_items.status_code, 200, con_items.text)

        domingo = date.today() + timedelta(days=1)
        while domingo.weekday() != 6:
            domingo += timedelta(days=1)
        sin_labor = self._get(
            f"/api/v1/citas/horas-disponibles?fecha={domingo}", headers=self.headers_cliente
        )
        self.assertEqual(sin_labor.status_code, 200)
        self.assertEqual(sin_labor.json(), [])

        pasada = self._get(
            f"/api/v1/citas/horas-disponibles?fecha={date.today() - timedelta(days=2)}"
        )
        self.assertEqual(pasada.status_code, 200)
        self.assertEqual(pasada.json(), [])

    def test_tecnico_ocupado_refleja_cita_existente(self):
        fecha = self._fecha(90)
        self._crear_cita_bd(
            self.cliente,
            fecha=fecha,
            hora="10:00",
            id_tecnico=self.tecnico.id_tecnico,
        )
        r = self._get(
            f"/api/v1/citas/tecnico-ocupado?tecnico_id={self.tecnico.id_tecnico}&fecha={fecha}"
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn("10:00", r.json()["horas"])

    # ── administración ────────────────────────────────────────────────────
    def test_admin_lista_citas_y_actualiza_estado(self):
        cita = self._crear_cita_bd(
            self.cliente, fecha=self._fecha(100), id_tecnico=self.tecnico.id_tecnico
        )
        listado = self._get("/api/v1/citas/all-admin", headers=self.headers_admin)
        self.assertEqual(listado.status_code, 200, listado.text)
        ids = [c["id_cita"] for c in listado.json()]
        self.assertIn(cita.id_cita, ids)

        r = self._put(
            f"/api/v1/citas/admin/{cita.id_cita}",
            headers=self.headers_admin,
            json={"estado": "Finalizada"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["estado"], "Finalizada")

        invalido = self._put(
            f"/api/v1/citas/admin/{cita.id_cita}",
            headers=self.headers_admin,
            json={"estado": "Inexistente"},
        )
        self.assertEqual(invalido.status_code, 400, invalido.text)

        faltante = self._put(
            "/api/v1/citas/admin/99999999",
            headers=self.headers_admin,
            json={"estado": "Finalizada"},
        )
        self.assertEqual(faltante.status_code, 404)

    def test_admin_actualiza_equipo_comision_y_errores(self):
        cita = self._crear_cita_bd(
            self.cliente,
            fecha=self._fecha(110),
            id_tecnico=self.tecnico.id_tecnico,
            costo=100000,
        )
        con_segundo = self._put(
            f"/api/v1/citas/admin/{cita.id_cita}",
            headers=self.headers_admin,
            json={"id_tecnico_2": self.tecnico2.id_tecnico},
        )
        self.assertEqual(con_segundo.status_code, 200, con_segundo.text)
        self.assertEqual(con_segundo.json()["id_tecnico_2"], self.tecnico2.id_tecnico)

        repetido = self._put(
            f"/api/v1/citas/admin/{cita.id_cita}",
            headers=self.headers_admin,
            json={"id_tecnico_3": self.tecnico2.id_tecnico},
        )
        self.assertEqual(repetido.status_code, 400, repetido.text)

        comision = self._put(
            f"/api/v1/citas/admin/{cita.id_cita}",
            headers=self.headers_admin,
            json={"comision_porcentaje": 10},
        )
        self.assertEqual(comision.status_code, 200, comision.text)
        self.assertAlmostEqual(comision.json()["comision_valor"], 10000.0, places=2)
        if comision.json().get("id_comision_c"):
            self._ids_comision.append(comision.json()["id_comision_c"])

        cero = self._put(
            f"/api/v1/citas/admin/{cita.id_cita}",
            headers=self.headers_admin,
            json={"comision_porcentaje": 0},
        )
        self.assertEqual(cero.status_code, 400)

        comision_inexistente = self._put(
            f"/api/v1/citas/admin/{cita.id_cita}",
            headers=self.headers_admin,
            json={"id_comision_c": 99999999},
        )
        self.assertEqual(comision_inexistente.status_code, 400)

        quitar = self._put(
            f"/api/v1/citas/admin/{cita.id_cita}",
            headers=self.headers_admin,
            json={"id_tecnico_2": None, "id_tecnico": None},
        )
        self.assertEqual(quitar.status_code, 200, quitar.text)
        self.assertIsNone(quitar.json()["id_tecnico"])

    def test_admin_cancela_con_reembolso_y_historial(self):
        cita = self._crear_cita_bd(
            self.cliente,
            fecha=self._fecha(120),
            id_tecnico=self.tecnico.id_tecnico,
            costo=100000,
            estado_pago="aprobado",
        )
        r = self._put(
            f"/api/v1/citas/admin/{cita.id_cita}",
            headers=self.headers_admin,
            json={"estado": "Cancelada"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        cuerpo = r.json()
        self.assertEqual(cuerpo["estado"], "Cancelada")
        self.assertIsNotNone(cuerpo["reembolso"])
        self.assertAlmostEqual(cuerpo["reembolso"]["monto"], 100000.0, places=2)
        self._ids_reembolso.append(cuerpo["reembolso"]["id_reembolso"])

        historial = self._get(
            f"/api/v1/citas/admin/{cita.id_cita}/historial", headers=self.headers_admin
        )
        self.assertEqual(historial.status_code, 200, historial.text)
        self.assertTrue(any(h["accion"] == "cancelacion" for h in historial.json()))

        resumen = self._get(
            "/api/v1/citas/admin/reasignaciones-historial?limit=5",
            headers=self.headers_admin,
        )
        self.assertEqual(resumen.status_code, 200, resumen.text)

    def test_admin_reasigna_y_consulta_apoyo(self):
        cita = self._crear_cita_bd(
            self.cliente,
            fecha=self._fecha(130),
            id_tecnico=self.tecnico.id_tecnico,
        )
        disponibles = self._get(
            f"/api/v1/citas/admin/{cita.id_cita}/tecnicos-disponibles",
            headers=self.headers_admin,
        )
        self.assertEqual(disponibles.status_code, 200, disponibles.text)
        self.assertTrue(any(t["id_tecnico"] == self.tecnico2.id_tecnico for t in disponibles.json()))

        proxima = self._get(
            f"/api/v1/citas/admin/{cita.id_cita}/proxima-fecha", headers=self.headers_admin
        )
        self.assertEqual(proxima.status_code, 200, proxima.text)
        self.assertIn("fecha", proxima.json())

        r = self._post(
            f"/api/v1/citas/admin/{cita.id_cita}/reasignar",
            headers=self.headers_admin,
            json={
                "id_tecnico": self.tecnico2.id_tecnico,
                "fecha": str(self._fecha(131)),
                "hora": "11:00",
                "motivo": "Reasignación de prueba S6",
            },
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["id_tecnico"], self.tecnico2.id_tecnico)

        historial = self._get(
            f"/api/v1/citas/admin/{cita.id_cita}/historial", headers=self.headers_admin
        )
        self.assertEqual(historial.status_code, 200)
        self.assertTrue(any(h["accion"] == "reasignacion" for h in historial.json()))

    def test_admin_reasignar_valida_estado_y_tecnico(self):
        fecha = self._fecha(140)
        no_encontrada = self._post(
            "/api/v1/citas/admin/99999999/reasignar",
            headers=self.headers_admin,
            json={"id_tecnico": self.tecnico.id_tecnico},
        )
        self.assertEqual(no_encontrada.status_code, 404)

        cancelada = self._crear_cita_bd(
            self.cliente, fecha=fecha, estado="Cancelada", id_tecnico=self.tecnico.id_tecnico
        )
        r = self._post(
            f"/api/v1/citas/admin/{cancelada.id_cita}/reasignar",
            headers=self.headers_admin,
            json={"id_tecnico": self.tecnico2.id_tecnico},
        )
        self.assertEqual(r.status_code, 400, r.text)

        cita = self._crear_cita_bd(
            self.cliente, fecha=fecha, hora="12:00", id_tecnico=self.tecnico.id_tecnico
        )
        invalido = self._post(
            f"/api/v1/citas/admin/{cita.id_cita}/reasignar",
            headers=self.headers_admin,
            json={"id_tecnico": 99999999},
        )
        self.assertEqual(invalido.status_code, 400, invalido.text)

        duplicado = self._post(
            f"/api/v1/citas/admin/{cita.id_cita}/reasignar",
            headers=self.headers_admin,
            json={
                "id_tecnico": self.tecnico.id_tecnico,
                "id_tecnico_2": self.tecnico.id_tecnico,
            },
        )
        self.assertEqual(duplicado.status_code, 400, duplicado.text)

    def test_admin_lista_pendientes_de_reasignar(self):
        inactivo_user = self._crear_usuario("reasig", 2, activo=False)
        inactivo = Tecnico(id_usuario_t=inactivo_user.id_usuario, certificacion_t="")
        self.db.add(inactivo)
        self.db.commit()
        self.db.refresh(inactivo)
        cita = self._crear_cita_bd(
            self.cliente,
            fecha=self._fecha(150),
            estado="Confirmada",
            id_tecnico=inactivo.id_tecnico,
        )
        r = self._get("/api/v1/citas/admin/reasignar-pendientes", headers=self.headers_admin)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn(cita.id_cita, [c["id_cita"] for c in r.json()])

    # ── cliente ───────────────────────────────────────────────────────────
    def test_cliente_lista_edita_y_cancela_su_cita(self):
        fecha = self._fecha(160)
        cita = self._crear_cita_bd(
            self.cliente,
            fecha=fecha,
            hora="10:00",
            id_tecnico=self.tecnico.id_tecnico,
            costo=90000,
        )
        listado = self._get("/api/v1/citas/mis-citas", headers=self.headers_cliente)
        self.assertEqual(listado.status_code, 200, listado.text)
        self.assertIn(cita.id_cita, [c["id_cita"] for c in listado.json()])

        nueva_fecha = self._fecha(170)
        editada = self._put(
            f"/api/v1/citas/{cita.id_cita}",
            headers=self.headers_cliente,
            json={"fecha": str(nueva_fecha), "hora": "14:00", "descripcion": "Reprogramada S6"},
        )
        self.assertEqual(editada.status_code, 200, editada.text)
        self.assertEqual(editada.json()["hora"], "14:00")

        cancelada = self._delete(f"/api/v1/citas/{cita.id_cita}", headers=self.headers_cliente)
        self.assertEqual(cancelada.status_code, 200, cancelada.text)
        self.assertEqual(cancelada.json()["estado"], "Cancelada")
        self.assertIsNotNone(cancelada.json()["reembolso"])
        if cancelada.json()["reembolso"]:
            self._ids_reembolso.append(cancelada.json()["reembolso"]["id_reembolso"])

        repetida = self._delete(f"/api/v1/citas/{cita.id_cita}", headers=self.headers_cliente)
        self.assertEqual(repetida.status_code, 400)

    def test_cliente_no_puede_editar_cita_ajena_ni_finalizada(self):
        cita_ajena = self._crear_cita_bd(
            self.otro_cliente, fecha=self._fecha(180), id_tecnico=self.tecnico.id_tecnico
        )
        ajena = self._put(
            f"/api/v1/citas/{cita_ajena.id_cita}",
            headers=self.headers_cliente,
            json={"descripcion": "No permitido"},
        )
        self.assertEqual(ajena.status_code, 404)

        finalizada = self._crear_cita_bd(
            self.cliente,
            fecha=self._fecha(181),
            estado="Finalizada",
            id_tecnico=self.tecnico.id_tecnico,
        )
        r = self._put(
            f"/api/v1/citas/{finalizada.id_cita}",
            headers=self.headers_cliente,
            json={"descripcion": "No permitido"},
        )
        self.assertEqual(r.status_code, 400)
        cancelar = self._delete(
            f"/api/v1/citas/{finalizada.id_cita}", headers=self.headers_cliente
        )
        self.assertEqual(cancelar.status_code, 400)

    def test_cliente_no_puede_editar_con_menos_de_tres_horas(self):
        from app.routers import citas as citas_router

        fijo = datetime(2026, 6, 15, 9, 0)
        cita = self._crear_cita_bd(
            self.cliente,
            fecha=fijo.date(),
            hora="10:00",
            id_tecnico=self.tecnico.id_tecnico,
        )
        with patch.object(citas_router, "_ahora_bogota", return_value=fijo):
            r = self._put(
                f"/api/v1/citas/{cita.id_cita}",
                headers=self.headers_cliente,
                json={"hora": "11:00"},
            )
        self.assertEqual(r.status_code, 400, r.text)

    # ── ofertas ───────────────────────────────────────────────────────────
    def _crear_oferta(self, *, estado="Ofrecida", expira=None, puntaje=0, tipo="mantenimiento"):
        cita = self._crear_cita_bd(
            self.otro_cliente,
            fecha=self._fecha(200),
            hora="10:00",
            id_tecnico=self.tecnico.id_tecnico,
        )
        oferta = OfertaHorario(
            id_cliente=self.otro_cliente.id_cliente,
            fecha=cita.fecha - timedelta(days=2),
            hora="08:00",
            tipo_servicio=tipo,
            id_tecnico=self.tecnico.id_tecnico,
            nombre_tecnico="TECNICO OFERTA",
            puntaje=puntaje,
            estado=estado,
            expira_en=expira or (datetime.now() + timedelta(hours=2)),
        )
        self.db.add(oferta)
        self.db.commit()
        self.db.refresh(oferta)
        self._ids_oferta.append(oferta.id_oferta)
        return cita, oferta

    def test_ofertas_pendientes_y_aceptar_mueve_la_cita(self):
        cita, oferta = self._crear_oferta()
        listado = self._get("/api/v1/citas/ofertas-pendientes", headers=self.headers_otro)
        self.assertEqual(listado.status_code, 200, listado.text)
        ids = [o["id_oferta"] for o in listado.json()]
        self.assertIn(oferta.id_oferta, ids)

        r = self._post(
            f"/api/v1/citas/ofertas/{oferta.id_oferta}/aceptar", headers=self.headers_otro
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["id_cita"], cita.id_cita)
        self._resincronizar()
        self.db.expire_all()
        actualizada = self.db.query(Cita).filter(Cita.id_cita == cita.id_cita).first()
        self.assertEqual(actualizada.fecha, oferta.fecha)
        self.assertEqual(actualizada.hora, oferta.hora)

        repetida = self._post(
            f"/api/v1/citas/ofertas/{oferta.id_oferta}/aceptar", headers=self.headers_otro
        )
        self.assertEqual(repetida.status_code, 409)

    def test_oferta_expirada_y_prioridad_mayor(self):
        _, expirada = self._crear_oferta(expira=datetime.now() - timedelta(minutes=5))
        r = self._post(
            f"/api/v1/citas/ofertas/{expirada.id_oferta}/aceptar", headers=self.headers_otro
        )
        self.assertEqual(r.status_code, 410, r.text)

        _, oferta = self._crear_oferta()
        self.db.add(
            OfertaHorario(
                id_cliente=self.cliente.id_cliente,
                fecha=oferta.fecha,
                hora=oferta.hora,
                tipo_servicio=oferta.tipo_servicio,
                id_tecnico=oferta.id_tecnico,
                puntaje=10,
                estado="Ofrecida",
                expira_en=datetime.now() + timedelta(hours=2),
            )
        )
        self.db.commit()
        prioridad = self._post(
            f"/api/v1/citas/ofertas/{oferta.id_oferta}/aceptar", headers=self.headers_otro
        )
        self.assertEqual(prioridad.status_code, 403, prioridad.text)

    def test_oferta_de_otro_servicio_y_sin_cita_movible(self):
        _, oferta = self._crear_oferta(tipo="instalacion")
        r = self._post(
            f"/api/v1/citas/ofertas/{oferta.id_oferta}/aceptar", headers=self.headers_otro
        )
        self.assertEqual(r.status_code, 409, r.text)

        cliente_sin_cita = self._crear_cliente("sincita")
        headers = self._bearer(self._token(self._login(cliente_sin_cita.email)))
        otra = OfertaHorario(
            id_cliente=cliente_sin_cita.id_cliente,
            fecha=self._fecha(220),
            hora="08:00",
            tipo_servicio="mantenimiento",
            id_tecnico=self.tecnico.id_tecnico,
            puntaje=0,
            estado="Ofrecida",
            expira_en=datetime.now() + timedelta(hours=2),
        )
        self.db.add(otra)
        self.db.commit()
        self.db.refresh(otra)
        self._ids_oferta.append(otra.id_oferta)
        sin_cita = self._post(f"/api/v1/citas/ofertas/{otra.id_oferta}/aceptar", headers=headers)
        self.assertEqual(sin_cita.status_code, 409, sin_cita.text)

        inexistente = self._post("/api/v1/citas/ofertas/99999999/aceptar", headers=headers)
        self.assertEqual(inexistente.status_code, 409)

    # ── productos de la cita ──────────────────────────────────────────────
    def test_productos_cita_crud_y_permisos(self):
        cita = self._crear_cita_bd(
            self.cliente, fecha=self._fecha(230), id_tecnico=self.tecnico.id_tecnico
        )
        producto = self._crear_producto(stock=10)

        agregado = self._post(
            f"/api/v1/citas/{cita.id_cita}/productos",
            headers=self.headers_admin,
            json={"id_producto": producto.id_producto, "cantidad": 2, "notas": "Llevar"},
        )
        self.assertEqual(agregado.status_code, 200, agregado.text)
        cita_producto_id = agregado.json()["id_cita_producto"]
        self._ids_cita_producto.append(cita_producto_id)

        listado_admin = self._get(
            f"/api/v1/citas/{cita.id_cita}/productos", headers=self.headers_admin
        )
        self.assertEqual(listado_admin.status_code, 200, listado_admin.text)
        self.assertEqual(len(listado_admin.json()), 1)

        listado_tecnico = self._get(
            f"/api/v1/citas/{cita.id_cita}/productos", headers=self.headers_tecnico
        )
        self.assertEqual(listado_tecnico.status_code, 200, listado_tecnico.text)

        ajeno = self._get(
            f"/api/v1/citas/{cita.id_cita}/productos", headers=self.headers_tecnico2
        )
        self.assertEqual(ajeno.status_code, 403, ajeno.text)

        inexistente = self._post(
            f"/api/v1/citas/{cita.id_cita}/productos",
            headers=self.headers_admin,
            json={"id_producto": 99999999, "cantidad": 1},
        )
        self.assertEqual(inexistente.status_code, 404)

        cantidad_cero = self._post(
            f"/api/v1/citas/{cita.id_cita}/productos",
            headers=self.headers_admin,
            json={"id_producto": producto.id_producto, "cantidad": 0},
        )
        self.assertEqual(cantidad_cero.status_code, 400)

        eliminado = self._delete(
            f"/api/v1/citas/{cita.id_cita}/productos/{cita_producto_id}",
            headers=self.headers_admin,
        )
        self.assertEqual(eliminado.status_code, 200, eliminado.text)

        no_existe = self._delete(
            f"/api/v1/citas/{cita.id_cita}/productos/{cita_producto_id}",
            headers=self.headers_admin,
        )
        self.assertEqual(no_existe.status_code, 404)

        cita_faltante = self._get(
            "/api/v1/citas/99999999/productos", headers=self.headers_admin
        )
        self.assertEqual(cita_faltante.status_code, 404)


if __name__ == "__main__":
    unittest.main()
