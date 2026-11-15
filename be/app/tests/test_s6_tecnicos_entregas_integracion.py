"""S6 — Integración del portal del técnico con MySQL real.

Cubre catálogo y administración de técnicos, especializaciones, mis-citas,
comisiones, reagendamiento, finalización con evidencias, entregas con sus
transiciones, ubicación GPS, historial y descarga autenticada de evidencias.
"""
import io
import unittest
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

import app.tests.testdb  # noqa: F401

from app.models.especializacion import Especializacion
from app.models.evidencia import Evidencia, EvidenciaEntrega
from app.models.otros import Comision
from app.models.tecnico import Tecnico
from app.tests.s6_base import BaseS6TestCase


def _png_valido() -> bytes:
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), (200, 30, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


class TecnicosEntregasIntegracionTestCase(BaseS6TestCase):
    def setUp(self):
        super().setUp()
        self.admin = self._crear_admin("tec")
        self.cliente = self._crear_cliente("tec")
        self.tecnico_user, self.tecnico = self._crear_tecnico("tec")
        self.tecnico2_user, self.tecnico2 = self._crear_tecnico("tec2")
        self.tecnico3_user, self.tecnico3 = self._crear_tecnico("tec3")
        self.headers_admin = self._bearer(self._token(self._login(self.admin.email)))
        self.headers_tecnico = self._bearer(self._token(self._login(self.tecnico_user.email)))
        self.headers_tecnico2 = self._bearer(self._token(self._login(self.tecnico2_user.email)))
        self.headers_tecnico3 = self._bearer(self._token(self._login(self.tecnico3_user.email)))
        self.headers_cliente = self._bearer(self._token(self._login(self.cliente.email)))
        self.fecha = self._proxima_laboral(30)
        self.fecha2 = self._proxima_laboral(45)
        self.producto = self._crear_producto(precio=20000, stock=20)

    def _crear_especializacion(self, nombre="Instalación eléctrica S6"):
        esp = Especializacion(
            nombre=f"{nombre} {uuid.uuid4().hex[:8]}",
            descripcion="Especialización de prueba S6",
            activa=True,
        )
        self.db.add(esp)
        self.db.commit()
        self.db.refresh(esp)
        self._ids_especializacion.append(esp.id_especializacion)
        return esp

    # ── catálogo y administración ─────────────────────────────────────────
    def test_catalogo_publico_y_admin_de_tecnicos(self):
        publicos = self._get(
            f"/api/v1/tecnicos/publicos?fecha={self.fecha}&hora=08:00"
        )
        self.assertEqual(publicos.status_code, 200, publicos.text)
        ids = [t["id_tecnico"] for t in publicos.json()]
        self.assertIn(self.tecnico.id_tecnico, ids)
        mi_ficha = next(t for t in publicos.json() if t["id_tecnico"] == self.tecnico.id_tecnico)
        self.assertTrue(mi_ficha["disponible"])

        admin = self._get("/api/v1/tecnicos", headers=self.headers_admin)
        self.assertEqual(admin.status_code, 200, admin.text)
        self.assertIn(self.tecnico.id_tecnico, [t["id_tecnico"] for t in admin.json()])
        self.assertEqual(
            self._get("/api/v1/tecnicos", headers=self.headers_cliente).status_code,
            401,
        )
        self.assertEqual(
            self._get("/api/v1/tecnicos", headers=self.headers_tecnico).status_code,
            403,
        )

        sin_ficha = self._crear_usuario("sinficha", 2)
        self.db.commit()
        unassigned = self._get("/api/v1/tecnicos/unassigned", headers=self.headers_admin)
        self.assertEqual(unassigned.status_code, 200, unassigned.text)
        self.assertIn(sin_ficha.id_usuario, unassigned.json())

        actualizada = self._put(
            f"/api/v1/tecnicos/{self.tecnico.id_tecnico}",
            headers=self.headers_admin,
            json={"certificacion": "Certificación S6"},
        )
        self.assertEqual(actualizada.status_code, 200, actualizada.text)
        self.assertEqual(actualizada.json()["certificacion_t"], "Certificación S6")
        self.assertEqual(
            self._put(
                "/api/v1/tecnicos/99999999",
                headers=self.headers_admin,
                json={"certificacion": "X"},
            ).status_code,
            404,
        )

        _, desechable = self._crear_tecnico("borrar")
        eliminada = self._delete(
            f"/api/v1/tecnicos/{desechable.id_tecnico}", headers=self.headers_admin
        )
        self.assertEqual(eliminada.status_code, 200, eliminada.text)
        self.assertEqual(
            self._delete(
                f"/api/v1/tecnicos/{desechable.id_tecnico}", headers=self.headers_admin
            ).status_code,
            404,
        )

    def test_especializaciones_del_tecnico(self):
        esp = self._crear_especializacion()
        agregada = self._post(
            f"/api/v1/tecnicos/mis-especializaciones/{esp.id_especializacion}",
            headers=self.headers_tecnico,
        )
        self.assertEqual(agregada.status_code, 200, agregada.text)
        self.assertIn(esp.nombre, [e["nombre"] for e in agregada.json()["especializaciones"]])
        self.assertEqual(
            self._post(
                f"/api/v1/tecnicos/mis-especializaciones/{esp.id_especializacion}",
                headers=self.headers_tecnico,
            ).status_code,
            400,
        )
        self.assertEqual(
            self._post(
                "/api/v1/tecnicos/mis-especializaciones/99999999",
                headers=self.headers_tecnico,
            ).status_code,
            404,
        )
        quitada = self._delete(
            f"/api/v1/tecnicos/mis-especializaciones/{esp.id_especializacion}",
            headers=self.headers_tecnico,
        )
        self.assertEqual(quitada.status_code, 200, quitada.text)
        self.assertEqual(
            self._delete(
                f"/api/v1/tecnicos/mis-especializaciones/{esp.id_especializacion}",
                headers=self.headers_tecnico,
            ).status_code,
            404,
        )
        # El token de cliente no es de empleado: la dependencia lo rechaza
        # antes de buscar la ficha de técnico.
        self.assertEqual(
            self._post(
                f"/api/v1/tecnicos/mis-especializaciones/{esp.id_especializacion}",
                headers=self.headers_cliente,
            ).status_code,
            401,
        )

    def test_mis_citas_clientes_y_comisiones(self):
        comision = Comision(
            porcentaje_comision=Decimal("10.00"),
            valor_comision=Decimal("8000.00"),
        )
        self.db.add(comision)
        self.db.commit()
        self.db.refresh(comision)
        self._ids_comision.append(comision.id_comision)

        cita = self._crear_cita_bd(
            self.cliente,
            fecha=self.fecha,
            id_tecnico=self.tecnico.id_tecnico,
            id_tecnico_2=self.tecnico2.id_tecnico,
            nombre_tecnico="TECNICO TEC",
            nombre_tecnico_2="TECNICO TEC2",
            costo=80000,
        )
        cita.id_comision_c = comision.id_comision
        self.db.commit()

        mis = self._get("/api/v1/tecnicos/mis-citas", headers=self.headers_tecnico)
        self.assertEqual(mis.status_code, 200, mis.text)
        fila = next(c for c in mis.json() if c["id_cita"] == cita.id_cita)
        self.assertEqual(fila["mi_rol"], "principal")

        apoyo = self._get("/api/v1/tecnicos/mis-citas", headers=self.headers_tecnico2)
        self.assertEqual(apoyo.status_code, 200, apoyo.text)
        fila_apoyo = next(c for c in apoyo.json() if c["id_cita"] == cita.id_cita)
        self.assertEqual(fila_apoyo["mi_rol"], "segundo")
        self.assertIn("TECNICO TEC", [c for c in fila_apoyo["companeros"]])

        clientes = self._get(
            "/api/v1/tecnicos/mis-clientes?q=tec&skip=0&limit=10",
            headers=self.headers_tecnico,
        )
        self.assertEqual(clientes.status_code, 200, clientes.text)
        self.assertIn(self.cliente.id_cliente, [c["id_cliente"] for c in clientes.json()])

        citas_cliente = self._get(
            f"/api/v1/tecnicos/clientes/{self.cliente.id_cliente}/citas",
            headers=self.headers_tecnico,
        )
        self.assertEqual(citas_cliente.status_code, 200, citas_cliente.text)
        self.assertIn(cita.id_cita, [c["id_cita"] for c in citas_cliente.json()])
        self.assertEqual(
            self._get(
                "/api/v1/tecnicos/clientes/99999999/citas",
                headers=self.headers_tecnico,
            ).status_code,
            404,
        )

        comisiones = self._get("/api/v1/tecnicos/comisiones", headers=self.headers_tecnico)
        self.assertEqual(comisiones.status_code, 200, comisiones.text)
        fila_com = next(c for c in comisiones.json() if c["id_cita"] == cita.id_cita)
        self.assertEqual(fila_com["porcentaje_comision"], 10.0)
        self.assertEqual(fila_com["valor_comision"], 8000.0)

    # ── citas del técnico ────────────────────────────────────────────────
    def test_tecnico_finaliza_cita_solo_con_evidencia(self):
        cita = self._crear_cita_bd(
            self.cliente,
            fecha=self.fecha,
            id_tecnico=self.tecnico.id_tecnico,
            id_tecnico_2=self.tecnico2.id_tecnico,
        )
        sin_evidencia = self._put(
            f"/api/v1/tecnicos/citas/{cita.id_cita}/estado",
            headers=self.headers_tecnico,
            json={"estado": "Finalizada"},
        )
        self.assertEqual(sin_evidencia.status_code, 400, sin_evidencia.text)

        evidencia = Evidencia(
            id_cita=cita.id_cita,
            id_tecnico=self.tecnico.id_tecnico,
            url_archivo="evidencia_s6.jpg",
            descripcion="Trabajo terminado",
        )
        self.db.add(evidencia)
        self.db.commit()

        apoyo = self._put(
            f"/api/v1/tecnicos/citas/{cita.id_cita}/estado",
            headers=self.headers_tecnico2,
            json={"estado": "Finalizada"},
        )
        self.assertEqual(apoyo.status_code, 403, apoyo.text)

        invalido = self._put(
            f"/api/v1/tecnicos/citas/{cita.id_cita}/estado",
            headers=self.headers_tecnico,
            json={"estado_id": 99},
        )
        self.assertEqual(invalido.status_code, 400)

        no_final = self._put(
            f"/api/v1/tecnicos/citas/{cita.id_cita}/estado",
            headers=self.headers_tecnico,
            json={"estado": "Cancelada"},
        )
        self.assertEqual(no_final.status_code, 400)

        finalizada = self._put(
            f"/api/v1/tecnicos/citas/{cita.id_cita}/estado",
            headers=self.headers_tecnico,
            json={"estado_id": 3},
        )
        self.assertEqual(finalizada.status_code, 200, finalizada.text)
        self.assertEqual(finalizada.json()["estado"], "Finalizada")

        repetida = self._put(
            f"/api/v1/tecnicos/citas/{cita.id_cita}/estado",
            headers=self.headers_tecnico,
            json={"estado": "Finalizada"},
        )
        self.assertEqual(repetida.status_code, 400)

        ajena = self._put(
            f"/api/v1/tecnicos/citas/{cita.id_cita}/estado",
            headers=self.headers_tecnico3,
            json={"estado": "Finalizada"},
        )
        self.assertEqual(ajena.status_code, 404)

    def test_tecnico_reagenda_y_consulta_disponibilidad(self):
        cita = self._crear_cita_bd(
            self.cliente,
            fecha=self.fecha,
            hora="08:00",
            id_tecnico=self.tecnico.id_tecnico,
        )
        proxima = self._get(
            f"/api/v1/tecnicos/citas/{cita.id_cita}/proxima-fecha",
            headers=self.headers_tecnico,
        )
        self.assertEqual(proxima.status_code, 200, proxima.text)
        self.assertIn("fecha", proxima.json())

        horas = self._get(
            f"/api/v1/tecnicos/citas/{cita.id_cita}/horas-disponibles?fecha={self.fecha2}",
            headers=self.headers_tecnico,
        )
        self.assertEqual(horas.status_code, 200, horas.text)
        self.assertIn("11:00", horas.json())

        reagendada = self._put(
            f"/api/v1/tecnicos/citas/{cita.id_cita}/reagendar",
            headers=self.headers_tecnico,
            json={"fecha": str(self.fecha2), "hora": "11:00", "id_comision": 0},
        )
        self.assertEqual(reagendada.status_code, 200, reagendada.text)
        self.assertEqual(reagendada.json()["hora"], "11:00")

        pasada = self._put(
            f"/api/v1/tecnicos/citas/{cita.id_cita}/reagendar",
            headers=self.headers_tecnico,
            json={"fecha": str(date.today() - timedelta(days=2)), "hora": "11:00", "id_comision": 0},
        )
        self.assertEqual(pasada.status_code, 400)

        hora_invalida = self._put(
            f"/api/v1/tecnicos/citas/{cita.id_cita}/reagendar",
            headers=self.headers_tecnico,
            json={"fecha": str(self._proxima_laboral(50)), "hora": "09:00", "id_comision": 0},
        )
        self.assertEqual(hora_invalida.status_code, 400, hora_invalida.text)

        ajena = self._put(
            f"/api/v1/tecnicos/citas/{cita.id_cita}/reagendar",
            headers=self.headers_tecnico3,
            json={"fecha": str(self.fecha2), "hora": "11:00", "id_comision": 0},
        )
        self.assertEqual(ajena.status_code, 404)

        cancelada = self._crear_cita_bd(
            self.cliente,
            fecha=self.fecha,
            estado="Cancelada",
            id_tecnico=self.tecnico.id_tecnico,
        )
        self.assertEqual(
            self._put(
                f"/api/v1/tecnicos/citas/{cancelada.id_cita}/reagendar",
                headers=self.headers_tecnico,
                json={"fecha": str(self.fecha2), "hora": "11:00", "id_comision": 0},
            ).status_code,
            400,
        )

    # ── entregas ─────────────────────────────────────────────────────────
    def test_entregas_del_tecnico_y_transiciones(self):
        pedido = self._crear_pedido_bd(
            self.cliente,
            total=20000,
            estado_entrega="Asignada",
            fecha_entrega=self.fecha,
            hora_entrega="11:00",
            id_tecnico_entrega=self.tecnico.id_tecnico,
            nombre_tecnico_entrega="TECNICO TEC",
        )
        self._agregar_detalle(pedido, self.producto, cantidad=1)

        for url in ("/api/v1/tecnicos/mis-entregas", "/api/v1/tecnicos/entregas"):
            listado = self._get(url, headers=self.headers_tecnico)
            self.assertEqual(listado.status_code, 200, listado.text)
            self.assertIn(pedido.id_pedido, [p["id_pedido"] for p in listado.json()])
        ajeno = self._get("/api/v1/tecnicos/mis-entregas", headers=self.headers_tecnico2)
        self.assertEqual(ajeno.status_code, 200)
        self.assertNotIn(pedido.id_pedido, [p["id_pedido"] for p in ajeno.json()])

        recogido = self._put(
            f"/api/v1/tecnicos/entregas/{pedido.id_pedido}/estado",
            headers=self.headers_tecnico,
            json={"estado": "Recogido"},
        )
        self.assertEqual(recogido.status_code, 200, recogido.text)
        self.assertEqual(recogido.json()["estado_entrega"], "Recogido")

        repetido = self._put(
            f"/api/v1/tecnicos/entregas/{pedido.id_pedido}/estado",
            headers=self.headers_tecnico,
            json={"estado": "Recogido"},
        )
        self.assertEqual(repetido.status_code, 200, repetido.text)

        salto = self._put(
            f"/api/v1/tecnicos/entregas/{pedido.id_pedido}/estado",
            headers=self.headers_tecnico,
            json={"estado": "Entregado"},
        )
        self.assertEqual(salto.status_code, 409, salto.text)

        en_camino = self._put(
            f"/api/v1/tecnicos/entregas/{pedido.id_pedido}/estado",
            headers=self.headers_tecnico,
            json={"estado": "En camino"},
        )
        self.assertEqual(en_camino.status_code, 200, en_camino.text)

        sin_foto = self._put(
            f"/api/v1/tecnicos/entregas/{pedido.id_pedido}/estado",
            headers=self.headers_tecnico,
            json={"estado": "Entregado"},
        )
        self.assertEqual(sin_foto.status_code, 400, sin_foto.text)

        self.db.add(
            EvidenciaEntrega(
                id_pedido=pedido.id_pedido,
                id_tecnico=self.tecnico.id_tecnico,
                url_archivo="evidencia_entrega_s6.jpg",
            )
        )
        self.db.commit()
        entregado = self._put(
            f"/api/v1/tecnicos/entregas/{pedido.id_pedido}/estado",
            headers=self.headers_tecnico,
            json={"estado": "Entregado"},
        )
        self.assertEqual(entregado.status_code, 200, entregado.text)
        self.assertEqual(entregado.json()["estado_entrega"], "Entregado")
        self.assertEqual(len(entregado.json()["evidencias_entrega"]), 1)

        retroceso = self._put(
            f"/api/v1/tecnicos/entregas/{pedido.id_pedido}/estado",
            headers=self.headers_tecnico,
            json={"estado": "En camino"},
        )
        self.assertEqual(retroceso.status_code, 409)

        invalido = self._put(
            f"/api/v1/tecnicos/entregas/{pedido.id_pedido}/estado",
            headers=self.headers_tecnico,
            json={"estado": "Volando"},
        )
        self.assertEqual(invalido.status_code, 409)

        ajena = self._put(
            f"/api/v1/tecnicos/entregas/{pedido.id_pedido}/estado",
            headers=self.headers_tecnico2,
            json={"estado": "Recogido"},
        )
        self.assertEqual(ajena.status_code, 404)

    def test_tecnico_reporta_ubicacion(self):
        primera = self._post(
            "/api/v1/tecnicos/ubicacion",
            headers=self.headers_tecnico,
            json={"latitud": 4.711, "longitud": -74.0721},
        )
        self.assertEqual(primera.status_code, 200, primera.text)
        self.assertTrue(primera.json()["ok"])

        actualizada = self._post(
            "/api/v1/tecnicos/ubicacion",
            headers=self.headers_tecnico,
            json={"latitud": 4.72, "longitud": -74.08},
        )
        self.assertEqual(actualizada.status_code, 200)
        self._resincronizar()
        from app.models.ubicacion_tecnico import UbicacionTecnico

        registro = (
            self.db.query(UbicacionTecnico)
            .filter(UbicacionTecnico.id_tecnico_ut == self.tecnico.id_tecnico)
            .first()
        )
        self.assertEqual(registro.latitud, 4.72)

        fuera = self._post(
            "/api/v1/tecnicos/ubicacion",
            headers=self.headers_tecnico,
            json={"latitud": 100, "longitud": 0},
        )
        self.assertEqual(fuera.status_code, 400)

        sin_ficha = self._post(
            "/api/v1/tecnicos/ubicacion",
            headers=self.headers_admin,
            json={"latitud": 4.6, "longitud": -74.0},
        )
        self.assertEqual(sin_ficha.status_code, 404)

    def test_historial_completo_del_tecnico(self):
        cita = self._crear_cita_bd(
            self.cliente,
            fecha=self.fecha,
            id_tecnico=self.tecnico.id_tecnico,
            costo=80000,
        )
        pedido = self._crear_pedido_bd(
            self.cliente,
            total=20000,
            estado_entrega="Entregado",
            fecha_entrega=self.fecha,
            id_tecnico_entrega=self.tecnico.id_tecnico,
        )
        self._agregar_detalle(pedido, self.producto, cantidad=1)
        self._crear_devolucion_bd(
            self.cliente,
            pedido=pedido,
            producto=self.producto,
            id_tecnico_recogida=self.tecnico.id_tecnico,
        )
        self.db.add(
            Evidencia(
                id_cita=cita.id_cita,
                id_tecnico=self.tecnico.id_tecnico,
                url_archivo="historial_cita.jpg",
            )
        )
        self.db.add(
            EvidenciaEntrega(
                id_pedido=pedido.id_pedido,
                id_tecnico=self.tecnico.id_tecnico,
                url_archivo="historial_entrega.jpg",
            )
        )
        self.db.commit()

        r = self._get(
            f"/api/v1/tecnicos/admin/{self.tecnico.id_tecnico}/historial",
            headers=self.headers_admin,
        )
        self.assertEqual(r.status_code, 200, r.text)
        cuerpo = r.json()
        self.assertIn(cita.id_cita, [s["id_cita"] for s in cuerpo["servicios"]])
        self.assertIn(pedido.id_pedido, [e["id_pedido"] for e in cuerpo["entregas"]])
        self.assertGreaterEqual(len(cuerpo["devoluciones"]), 1)
        self.assertEqual(
            self._get(
                "/api/v1/tecnicos/admin/99999999/historial", headers=self.headers_admin
            ).status_code,
            404,
        )
        self.assertEqual(
            self._get(
                f"/api/v1/tecnicos/admin/{self.tecnico.id_tecnico}/historial",
                headers=self.headers_tecnico,
            ).status_code,
            403,
        )

    # ── evidencias (MinIO simulado) ──────────────────────────────────────
    def test_evidencias_de_entrega_subida_listado_y_descarga(self):
        pedido = self._crear_pedido_bd(
            self.cliente,
            total=20000,
            estado_entrega="En camino",
            id_tecnico_entrega=self.tecnico.id_tecnico,
        )
        url = f"/api/v1/tecnicos/entregas/{pedido.id_pedido}/evidencias"

        formato = self._post(
            url,
            headers=self.headers_tecnico,
            files=[("files", ("notas.txt", b"texto", "text/plain"))],
        )
        self.assertEqual(formato.status_code, 400, formato.text)

        corrupta = self._post(
            url,
            headers=self.headers_tecnico,
            files=[("files", ("foto.png", b"no-es-imagen", "image/png"))],
        )
        self.assertEqual(corrupta.status_code, 400, corrupta.text)

        with patch(
            "app.routers.tecnicos.minio_service.subir_imagen_privada",
            return_value="evidencias_entrega/s6.png",
        ):
            subida = self._post(
                url,
                headers=self.headers_tecnico,
                files=[("files", ("foto.png", _png_valido(), "image/png"))],
            )
        self.assertEqual(subida.status_code, 200, subida.text)
        self.assertEqual(len(subida.json()["urls"]), 1)

        listado = self._get(url, headers=self.headers_tecnico)
        self.assertEqual(listado.status_code, 200, listado.text)
        self.assertEqual(len(listado.json()), 1)

        self._resincronizar()
        evidencia = (
            self.db.query(EvidenciaEntrega)
            .filter(EvidenciaEntrega.id_pedido == pedido.id_pedido)
            .first()
        )
        with patch(
            "app.routers.tecnicos.minio_service.leer_archivo",
            return_value=(b"PNGDATA", "image/png"),
        ):
            descarga = self._get(
                f"/api/v1/tecnicos/evidencias/entrega/{evidencia.id}/archivo",
                headers=self.headers_tecnico,
            )
            denegada = self._get(
                f"/api/v1/tecnicos/evidencias/entrega/{evidencia.id}/archivo",
                headers=self.headers_tecnico2,
            )
            admin = self._get(
                f"/api/v1/tecnicos/evidencias/entrega/{evidencia.id}/archivo",
                headers=self.headers_admin,
            )
        self.assertEqual(descarga.status_code, 200)
        self.assertEqual(descarga.content, b"PNGDATA")
        self.assertEqual(denegada.status_code, 403, denegada.text)
        self.assertEqual(admin.status_code, 200)
        self.assertEqual(
            self._get(
                "/api/v1/tecnicos/evidencias/entrega/99999999/archivo",
                headers=self.headers_admin,
            ).status_code,
            404,
        )

    def test_evidencias_de_cita_subida_companeros_y_borrado(self):
        cita = self._crear_cita_bd(
            self.cliente,
            fecha=self.fecha,
            id_tecnico=self.tecnico.id_tecnico,
            id_tecnico_2=self.tecnico2.id_tecnico,
        )
        url = f"/api/v1/tecnicos/citas/{cita.id_cita}/evidencias"

        ajeno = self._post(
            url,
            headers=self.headers_tecnico3,
            files={"file": ("foto.png", _png_valido(), "image/png")},
            data={"descripcion": "No permitido"},
        )
        self.assertEqual(ajeno.status_code, 404, ajeno.text)

        apoyo = self._post(
            url,
            headers=self.headers_tecnico2,
            files={"file": ("foto.png", _png_valido(), "image/png")},
        )
        self.assertEqual(apoyo.status_code, 403, apoyo.text)

        formato = self._post(
            url,
            headers=self.headers_tecnico,
            files={"file": ("notas.pdf", b"%PDF", "application/pdf")},
        )
        self.assertEqual(formato.status_code, 400)

        with patch(
            "app.routers.tecnicos.minio_service.subir_imagen_privada",
            return_value="evidencias_citas/s6.png",
        ):
            subida = self._post(
                url,
                headers=self.headers_tecnico,
                files={"file": ("foto.png", _png_valido(), "image/png")},
                data={"descripcion": "Trabajo finalizado S6"},
            )
        self.assertEqual(subida.status_code, 200, subida.text)
        evidencias = subida.json()["evidencias"]
        self.assertEqual(len(evidencias), 1)
        evidencia_id = evidencias[0]["id_evidencia"]
        self.assertEqual(evidencias[0]["descripcion"], "Trabajo finalizado S6")

        with patch(
            "app.routers.tecnicos.minio_service.leer_archivo",
            return_value=(b"PNGDATA", "image/png"),
        ):
            companero = self._get(
                f"/api/v1/tecnicos/evidencias/cita/{evidencia_id}/archivo",
                headers=self.headers_tecnico2,
            )
            no_asignado = self._get(
                f"/api/v1/tecnicos/evidencias/cita/{evidencia_id}/archivo",
                headers=self.headers_tecnico3,
            )
        self.assertEqual(companero.status_code, 200, companero.text)
        self.assertEqual(no_asignado.status_code, 403, no_asignado.text)

        borrado_apoyo = self._delete(
            f"/api/v1/tecnicos/citas/{cita.id_cita}/evidencias/{evidencia_id}",
            headers=self.headers_tecnico2,
        )
        self.assertEqual(borrado_apoyo.status_code, 404)

        with patch("app.routers.tecnicos.minio_service.eliminar_objeto_privado"):
            borrado = self._delete(
                f"/api/v1/tecnicos/citas/{cita.id_cita}/evidencias/{evidencia_id}",
                headers=self.headers_tecnico,
            )
        self.assertEqual(borrado.status_code, 200, borrado.text)
        self.assertEqual(borrado.json()["evidencias"], [])


if __name__ == "__main__":
    unittest.main()
