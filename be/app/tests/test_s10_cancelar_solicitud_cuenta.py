"""Semana 10 del bootcamp - TDD: cancelar una solicitud de baja pendiente.

Historia: como cliente quiero retirar mi solicitud de inhabilitacion mientras
el administrador aun no la ha resuelto, sin perder el rastro de auditoria.

Contrato nuevo (aditivo): DELETE /api/v1/clients/me/cuenta-solicitud
- 204 si cancela la solicitud pendiente del propio cliente.
- 404 si no tiene una solicitud pendiente.
- 401 sin sesion de cliente.
La solicitud no se borra: pasa a estado "cancelada" y queda resuelta.
"""
import unittest

import app.tests.testdb  # noqa: F401

from app.models.solicitud_cuenta import SolicitudCuenta
from app.tests.test_t1_identidad import BaseT1TestCase

URL = "/api/v1/clients/me/cuenta-solicitud"


class CancelarSolicitudCuentaTestCase(BaseT1TestCase):
    def setUp(self):
        super().setUp()
        self._ids_solicitud = []

    def tearDown(self):
        for sid in self._ids_solicitud:
            self.db.query(SolicitudCuenta).filter(
                SolicitudCuenta.id == sid
            ).delete(synchronize_session=False)
        super().tearDown()

    def _cliente_con_sesion(self, sufijo="cancel"):
        cliente = self._crear_cliente(sufijo)
        headers = self._bearer(self._token(self._login(cliente.email)))
        return cliente, headers

    def _solicitud(self, cliente, tipo="inhabilitar", estado="pendiente"):
        solicitud = SolicitudCuenta(
            id_cliente=cliente.id_cliente,
            tipo=tipo,
            estado=estado,
            motivo="motivo de prueba",
        )
        self.db.add(solicitud)
        self.db.commit()
        self.db.refresh(solicitud)
        self._ids_solicitud.append(solicitud.id)
        return solicitud

    def test_cliente_cancela_su_solicitud_pendiente(self):
        # Arrange
        cliente, headers = self._cliente_con_sesion()
        solicitud = self._solicitud(cliente)

        # Act
        respuesta = self._delete(URL, headers=headers)

        # Assert: 204 sin cuerpo y la solicitud queda resuelta como cancelada.
        self.assertEqual(respuesta.status_code, 204, respuesta.text)
        self.assertEqual(respuesta.content, b"")
        self.db.rollback()  # cierra el snapshot REPEATABLE READ y lee el commit del endpoint
        actual = (
            self.db.query(SolicitudCuenta)
            .filter(SolicitudCuenta.id == solicitud.id)
            .one()
        )
        self.assertEqual(actual.estado, "cancelada")
        self.assertIsNotNone(actual.resuelta_at)

    def test_cancelar_sin_solicitud_pendiente_responde_404(self):
        # Arrange: cliente sin solicitudes.
        _cliente, headers = self._cliente_con_sesion("sin-pend")

        # Act
        respuesta = self._delete(URL, headers=headers)

        # Assert
        self.assertEqual(respuesta.status_code, 404, respuesta.text)

    def test_cancelar_no_afecta_la_solicitud_de_otro_cliente(self):
        # Arrange: dos clientes con una solicitud pendiente cada uno.
        cliente, headers = self._cliente_con_sesion("propia")
        otro = self._crear_cliente("ajena")
        propia = self._solicitud(cliente)
        ajena = self._solicitud(otro)

        # Act
        respuesta = self._delete(URL, headers=headers)

        # Assert
        self.assertEqual(respuesta.status_code, 204, respuesta.text)
        self.db.rollback()  # cierra el snapshot REPEATABLE READ y lee el commit del endpoint
        estados = {
            s.id: s.estado
            for s in self.db.query(SolicitudCuenta)
            .filter(SolicitudCuenta.id.in_([propia.id, ajena.id]))
            .all()
        }
        self.assertEqual(estados[propia.id], "cancelada")
        self.assertEqual(estados[ajena.id], "pendiente")

    def test_no_cancela_una_solicitud_ya_resuelta(self):
        # Arrange: la ultima solicitud fue rechazada; no hay pendiente.
        cliente, headers = self._cliente_con_sesion("resuelta")
        solicitud = self._solicitud(cliente, estado="rechazada")

        # Act
        respuesta = self._delete(URL, headers=headers)

        # Assert
        self.assertEqual(respuesta.status_code, 404, respuesta.text)
        self.db.rollback()  # cierra el snapshot REPEATABLE READ y lee el commit del endpoint
        self.assertEqual(
            self.db.query(SolicitudCuenta)
            .filter(SolicitudCuenta.id == solicitud.id)
            .one()
            .estado,
            "rechazada",
        )

    def test_cancelar_exige_sesion_de_cliente(self):
        # Arrange / Act: sin cabecera Authorization.
        respuesta = self._delete(URL)

        # Assert
        self.assertEqual(respuesta.status_code, 401, respuesta.text)
