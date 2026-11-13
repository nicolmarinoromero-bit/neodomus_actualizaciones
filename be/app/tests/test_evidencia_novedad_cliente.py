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


if __name__ == "__main__":
    unittest.main()
