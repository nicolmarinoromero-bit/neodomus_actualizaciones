"""S6 — Integración de reportes con MySQL real.

Cubre los endpoints de reportes del panel administrativo (operativo, resumen,
ventas, citas, técnico y listado de técnicos) y las tres descargas PDF,
incluido el reporte general completo. Las pruebas usan datos persistidos en
``neodomus_test`` y verifican las respuestas reales de la API.
"""
import unittest
from datetime import date, timedelta

import app.tests.testdb  # noqa: F401

from app.tests.s6_base import BaseS6TestCase


class ReportesIntegracionTestCase(BaseS6TestCase):
    def setUp(self):
        super().setUp()
        self.admin = self._crear_admin("rep")
        self.cliente = self._crear_cliente("rep")
        self.tecnico_user, self.tecnico = self._crear_tecnico("rep")
        self.headers_admin = self._bearer(self._token(self._login(self.admin.email)))
        self.headers_cliente = self._bearer(self._token(self._login(self.cliente.email)))
        self.headers_tecnico = self._bearer(self._token(self._login(self.tecnico_user.email)))

        hoy = date.today()
        self.cita = self._crear_cita_bd(
            self.cliente,
            estado="Finalizada",
            fecha=hoy,
            hora="10:00",
            id_tecnico=self.tecnico.id_tecnico,
            costo=90000,
            estado_pago="aprobado",
        )
        self.producto = self._crear_producto(precio=30000, stock=20)
        self.pedido = self._crear_pedido_bd(
            self.cliente,
            estado_pedido="Pagado",
            total=60000,
            estado_entrega="Entregado",
            fecha_entrega=hoy,
            id_tecnico_entrega=self.tecnico.id_tecnico,
            nombre_tecnico_entrega="TECNICO REP",
        )
        self._agregar_detalle(self.pedido, self.producto, cantidad=2, subtotal=60000)

    def test_operativo_exige_admin_y_devuelve_metricas(self):
        self.assertEqual(self._get("/api/v1/reports/operativo").status_code, 401)
        self.assertEqual(
            self._get("/api/v1/reports/operativo", headers=self.headers_cliente).status_code,
            401,
        )
        self.assertEqual(
            self._get("/api/v1/reports/operativo", headers=self.headers_tecnico).status_code,
            403,
        )
        r = self._get("/api/v1/reports/operativo", headers=self.headers_admin)
        self.assertEqual(r.status_code, 200, r.text)
        cuerpo = r.json()
        for clave in (
            "citas_pendientes_asignacion",
            "citas_reprogramadas",
            "citas_canceladas",
            "tecnicos_disponibles_hoy",
            "entregas_sin_tecnico",
            "entregas_asignadas",
        ):
            self.assertIn(clave, cuerpo)
        self.assertGreaterEqual(cuerpo["entregas_asignadas"], 0)

    def test_resumen_sin_filtros_y_con_rango(self):
        r = self._get("/api/v1/reports/resumen", headers=self.headers_admin)
        self.assertEqual(r.status_code, 200, r.text)
        cuerpo = r.json()
        self.assertIn("ventas_total", cuerpo)
        self.assertIn("citas_por_estado", cuerpo)
        self.assertGreaterEqual(cuerpo["citas_total"], 1)
        self.assertGreaterEqual(cuerpo["pedidos_total"], 1)

        inicio = date.today() - timedelta(days=1)
        fin = date.today() + timedelta(days=1)
        rango = self._get(
            f"/api/v1/reports/resumen?fecha_inicio={inicio}&fecha_fin={fin}",
            headers=self.headers_admin,
        )
        self.assertEqual(rango.status_code, 200, rango.text)
        self.assertIn("clientes_total", rango.json())

    def test_resumen_valida_fechas(self):
        una = self._get(
            f"/api/v1/reports/resumen?fecha_inicio={date.today()}",
            headers=self.headers_admin,
        )
        self.assertEqual(una.status_code, 400)
        invertida = self._get(
            f"/api/v1/reports/resumen?fecha_inicio={date.today()}&fecha_fin={date.today() - timedelta(days=3)}",
            headers=self.headers_admin,
        )
        self.assertEqual(invertida.status_code, 400)

    def test_ventas_por_todos_los_periodos(self):
        for periodo in ("dia", "semana", "mes", "anio"):
            r = self._get(
                f"/api/v1/reports/ventas?periodo={periodo}", headers=self.headers_admin
            )
            self.assertEqual(r.status_code, 200, f"{periodo}: {r.text}")
            cuerpo = r.json()
            self.assertEqual(cuerpo["periodo"], periodo)
            self.assertIn("resumen", cuerpo)
            self.assertIn("ventas_por_periodo", cuerpo)

    def test_ventas_filtra_por_tecnico_y_valida_fechas(self):
        r = self._get(
            f"/api/v1/reports/ventas?id_tecnico={self.tecnico.id_tecnico}",
            headers=self.headers_admin,
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["id_tecnico_filtro"], self.tecnico.id_tecnico)

        solo_inicio = self._get(
            f"/api/v1/reports/ventas?fecha_inicio={date.today()}",
            headers=self.headers_admin,
        )
        self.assertEqual(solo_inicio.status_code, 400)
        invertida = self._get(
            f"/api/v1/reports/ventas?fecha_inicio={date.today()}&fecha_fin={date.today() - timedelta(days=1)}",
            headers=self.headers_admin,
        )
        self.assertEqual(invertida.status_code, 400)

    def test_citas_por_periodo_y_filtro_tecnico(self):
        for periodo in ("dia", "semana", "mes", "anio"):
            r = self._get(
                f"/api/v1/reports/citas?periodo={periodo}", headers=self.headers_admin
            )
            self.assertEqual(r.status_code, 200, f"{periodo}: {r.text}")
            self.assertIn("citas_por_periodo", r.json())
        filtrado = self._get(
            f"/api/v1/reports/citas?periodo=mes&id_tecnico={self.tecnico.id_tecnico}",
            headers=self.headers_admin,
        )
        self.assertEqual(filtrado.status_code, 200, filtrado.text)
        self.assertEqual(filtrado.json()["id_tecnico_filtro"], self.tecnico.id_tecnico)

    def test_reporte_tecnico_y_tecnico_inexistente(self):
        r = self._get(
            f"/api/v1/reports/tecnico?id_tecnico={self.tecnico.id_tecnico}",
            headers=self.headers_admin,
        )
        self.assertEqual(r.status_code, 200, r.text)
        cuerpo = r.json()
        self.assertEqual(cuerpo["tecnico"]["id_tecnico"], self.tecnico.id_tecnico)
        self.assertGreaterEqual(cuerpo["resumen"]["total_citas"], 1)
        faltante = self._get(
            "/api/v1/reports/tecnico?id_tecnico=99999999", headers=self.headers_admin
        )
        self.assertEqual(faltante.status_code, 404)

    def test_lista_tecnicos_con_busqueda_y_paginacion(self):
        r = self._get(
            "/api/v1/reports/tecnicos?q=TECNICO&skip=0&limit=5",
            headers=self.headers_admin,
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIsInstance(r.json(), list)

    def test_pdfs_ventas_citas_y_reporte_general(self):
        ventas = self._get(
            "/api/v1/reports/ventas/pdf?periodo=mes", headers=self.headers_admin
        )
        self.assertEqual(ventas.status_code, 200, ventas.text[:300])
        self.assertEqual(ventas.headers.get("content-type"), "application/pdf")
        self.assertTrue(ventas.content.startswith(b"%PDF"))

        citas = self._get(
            "/api/v1/reports/citas/pdf?periodo=anio", headers=self.headers_admin
        )
        self.assertEqual(citas.status_code, 200, citas.text[:300])
        self.assertTrue(citas.content.startswith(b"%PDF"))

        general = self._get("/api/v1/reports/pdf?periodo=mes", headers=self.headers_admin)
        self.assertEqual(general.status_code, 200, general.text[:300])
        self.assertTrue(general.content.startswith(b"%PDF"))
        self.assertGreater(len(general.content), 1000)

        personalizado = self._get(
            f"/api/v1/reports/pdf?fecha_inicio={date.today() - timedelta(days=7)}"
            f"&fecha_fin={date.today()}",
            headers=self.headers_admin,
        )
        self.assertEqual(personalizado.status_code, 200, personalizado.text[:300])
        self.assertTrue(personalizado.content.startswith(b"%PDF"))

    def test_pdf_valida_fechas_y_permisos(self):
        self.assertEqual(
            self._get("/api/v1/reports/pdf?periodo=mes", headers=self.headers_cliente).status_code,
            401,
        )
        self.assertEqual(
            self._get("/api/v1/reports/pdf?periodo=mes", headers=self.headers_tecnico).status_code,
            403,
        )
        solo_inicio = self._get(
            f"/api/v1/reports/pdf?fecha_inicio={date.today()}",
            headers=self.headers_admin,
        )
        self.assertEqual(solo_inicio.status_code, 400)
        invertida = self._get(
            f"/api/v1/reports/pdf?fecha_inicio={date.today()}&fecha_fin={date.today() - timedelta(days=2)}",
            headers=self.headers_admin,
        )
        self.assertEqual(invertida.status_code, 400)


if __name__ == "__main__":
    unittest.main()
