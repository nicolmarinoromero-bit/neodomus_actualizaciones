"""Autorización de clientes al consultar evidencias de novedades."""
import unittest
from unittest.mock import patch

import app.tests.testdb  # noqa: F401

from app.models.novedad import EvidenciaNovedad, Novedad
from app.tests.test_t1_identidad import BaseT1TestCase


class EvidenciaNovedadClienteTestCase(BaseT1TestCase):
    def setUp(self):
        super().setUp()
        self._ids_novedad = []

    def tearDown(self):
        for evidencia_id in getattr(self, "_ids_evidencia_novedad", []):
            self.db.query(EvidenciaNovedad).filter(
                EvidenciaNovedad.id_evidencia_n == evidencia_id
            ).delete(synchronize_session=False)
        for novedad_id in getattr(self, "_ids_novedad", []):
            self.db.query(Novedad).filter(
                Novedad.id_novedad == novedad_id
            ).delete(synchronize_session=False)
        self.db.commit()
        super().tearDown()

    def _crear_evidencia(self, cliente, visible=True):
        novedad = Novedad(
            id_cliente=cliente.id_cliente,
            tipo_novedad="Prueba de acceso",
            descripcion_novedad="Registro sintético de prueba",
            cliente_visible=visible,
        )
        self.db.add(novedad)
        self.db.flush()
        evidencia = EvidenciaNovedad(
            id_novedad=novedad.id_novedad,
            url_archivo="privado:evidencias_novedades/sintetica.jpg",
        )
        self.db.add(evidencia)
        self.db.commit()
        self._ids_novedad.append(novedad.id_novedad)
        self._ids_evidencia_novedad = getattr(self, "_ids_evidencia_novedad", [])
        self._ids_evidencia_novedad.append(evidencia.id_evidencia_n)
        return evidencia

    def _crear_novedad_con_evidencia_legacy(self, cliente, visible=True):
        novedad = Novedad(
            id_cliente=cliente.id_cliente,
            tipo_novedad="Prueba de acceso legado",
            descripcion_novedad="Registro sintético de prueba",
            evidencia_url="privado:evidencias_migradas/aa/sintetica.jpg",
            cliente_visible=visible,
        )
        self.db.add(novedad)
        self.db.commit()
        self._ids_novedad.append(novedad.id_novedad)
        return novedad

    def test_cliente_propietario_ve_evidencia_visible(self):
        cliente = self._crear_cliente("evid-novedad-propio")
        evidencia = self._crear_evidencia(cliente)
        token = self._token(self._login(cliente.email))

        with patch(
            "app.routers.novedades.minio_service.leer_archivo",
            return_value=(b"imagen sintetica", "image/jpeg"),
        ):
            respuesta = self._get(
                f"/api/v1/novedades/evidencias/{evidencia.id_evidencia_n}/archivo",
                headers=self._bearer(token),
            )

        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        self.assertEqual(respuesta.content, b"imagen sintetica")

    def test_cliente_no_ve_evidencia_de_otro_cliente(self):
        propietario = self._crear_cliente("evid-novedad-otro")
        lector = self._crear_cliente("evid-novedad-lector")
        evidencia = self._crear_evidencia(propietario)
        token = self._token(self._login(lector.email))

        respuesta = self._get(
            f"/api/v1/novedades/evidencias/{evidencia.id_evidencia_n}/archivo",
            headers=self._bearer(token),
        )

        self.assertEqual(respuesta.status_code, 404, respuesta.text)

    def test_cliente_no_ve_evidencia_no_visible(self):
        cliente = self._crear_cliente("evid-novedad-oculta")
        evidencia = self._crear_evidencia(cliente, visible=False)
        token = self._token(self._login(cliente.email))

        respuesta = self._get(
            f"/api/v1/novedades/evidencias/{evidencia.id_evidencia_n}/archivo",
            headers=self._bearer(token),
        )

        self.assertEqual(respuesta.status_code, 404, respuesta.text)

    def test_anonimo_no_ve_evidencia(self):
        cliente = self._crear_cliente("evid-novedad-anonimo")
        evidencia = self._crear_evidencia(cliente)

        respuesta = self._get(
            f"/api/v1/novedades/evidencias/{evidencia.id_evidencia_n}/archivo"
        )

        self.assertEqual(respuesta.status_code, 401, respuesta.text)

    def test_cliente_propietario_descarga_evidencia_legacy_visible(self):
        cliente = self._crear_cliente("evid-legacy-propio")
        novedad = self._crear_novedad_con_evidencia_legacy(cliente)
        token = self._token(self._login(cliente.email))

        with patch(
            "app.routers.novedades.minio_service.leer_archivo",
            return_value=(b"legacy privada", "image/jpeg"),
        ):
            respuesta = self._get(
                f"/api/v1/novedades/{novedad.id_novedad}/evidencia/archivo",
                headers=self._bearer(token),
            )

        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        self.assertEqual(respuesta.content, b"legacy privada")

    def test_cliente_no_descarga_evidencia_legacy_ajena_ni_oculta(self):
        propietario = self._crear_cliente("evid-legacy-otro")
        lector = self._crear_cliente("evid-legacy-lector")
        propia_oculta = self._crear_novedad_con_evidencia_legacy(propietario, visible=False)
        propia_visible = self._crear_novedad_con_evidencia_legacy(propietario)
        token_lector = self._token(self._login(lector.email))
        token_propietario = self._token(self._login(propietario.email))

        for novedad_id, token in (
            (propia_oculta.id_novedad, token_propietario),
            (propia_visible.id_novedad, token_lector),
        ):
            with self.subTest(novedad_id=novedad_id):
                respuesta = self._get(
                    f"/api/v1/novedades/{novedad_id}/evidencia/archivo",
                    headers=self._bearer(token),
                )
                self.assertEqual(respuesta.status_code, 404, respuesta.text)

    def test_anonimo_no_descarga_evidencia_legacy(self):
        cliente = self._crear_cliente("evid-legacy-anonimo")
        novedad = self._crear_novedad_con_evidencia_legacy(cliente)

        respuesta = self._get(f"/api/v1/novedades/{novedad.id_novedad}/evidencia/archivo")

        self.assertEqual(respuesta.status_code, 401, respuesta.text)


if __name__ == "__main__":
    unittest.main()
