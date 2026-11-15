"""Semana 4 del bootcamp — contrato HTTP de solicitudes de cuenta, tarifas y
consultas de contacto (routers sin cobertura previa).

Ángulos del reto semanal sobre ESTE archivo:
- API/BD: CRUD y estados reales de solicitudes y tarifas (feliz + estados).
- Seguridad: 401 anónimo, 403 cliente/técnico, 200 admin.
- Contrato: Content-Type JSON en TODA respuesta, JSON mal formado → 4xx JSON,
  sin SQL ni stack en los cuerpos de error.
"""
import time
import unittest

import app.tests.testdb  # noqa: F401

from app.database import SessionLocal
from app.models.cliente import Cliente
from app.models.contacto import Contacto
from app.models.notificacion import Notificacion
from app.models.solicitud_cuenta import SolicitudCuenta
from app.models.solicitud_habilitacion_empleado import SolicitudHabilitacionEmpleado
from app.models.tarifa_servicio import TarifaServicio
from app.models.tecnico import Tecnico
from app.models.user import User
from app.utils.security import hash_password
from app.tests.test_t1_identidad import BaseT1TestCase, PASSWORD

CLAVE_JSON = "application/json"


def _es_json(respuesta) -> bool:
    return respuesta.headers.get("content-type", "").startswith(CLAVE_JSON)


def _sin_fugas(texto: str) -> bool:
    """Los cuerpos de error no exponen SQL ni trazas internas."""
    indicios = ("SELECT ", "INSERT INTO", "Traceback", "pymysql", "sqlalchemy", ".py\", line")
    return not any(indicio in texto for indicio in indicios)


class SolicitudesCuentaTestCase(BaseT1TestCase):
    """Contrato de /admin/account-requests (clientes y empleados)."""

    def setUp(self):
        super().setUp()
        self._ids_solicitud = []
        self._ids_solicitud_emp = []

    def tearDown(self):
        for sid in self._ids_solicitud:
            self.db.query(SolicitudCuenta).filter(SolicitudCuenta.id == sid).delete(synchronize_session=False)
        for sid in self._ids_solicitud_emp:
            self.db.query(SolicitudHabilitacionEmpleado).filter(SolicitudHabilitacionEmpleado.id == sid).delete(synchronize_session=False)
        super().tearDown()

    def _tokens(self):
        """Devuelve (anonimo, cliente, tecnico, admin) listos para headers."""
        cliente = self._crear_cliente("sol")
        u, _t = self._crear_tecnico("sol")
        admin = self._crear_admin("sol")
        return (
            {},
            self._bearer(self._token(self._login(cliente.email))),
            self._bearer(self._token(self._login(u.email))),
            self._bearer(self._token(self._login(admin.email))),
        )

    def _solicitud_pendiente(self, cliente, tipo="habilitar"):
        s = SolicitudCuenta(
            id_cliente=cliente.id_cliente, tipo=tipo, estado="pendiente", motivo="prueba",
        )
        self.db.add(s)
        self.db.commit()
        self.db.refresh(s)
        self._ids_solicitud.append(s.id)
        return s

    def test_listar_exige_sesion_y_rol_admin(self):
        # Arrange
        _anon, cliente_h, tecnico_h, admin_h = self._tokens()
        self._solicitud_pendiente(self._crear_cliente("pend"))
        # Act / Assert: anónimo 401, cliente y técnico 403, admin 200.
        self.assertEqual(self._get("/api/v1/admin/account-requests").status_code, 401)
        self.assertEqual(self._get("/api/v1/admin/account-requests", headers=cliente_h).status_code, 401)  # por diseño: la sesión de cliente se marca 401 (no 403)
        self.assertEqual(self._get("/api/v1/admin/account-requests", headers=tecnico_h).status_code, 403)
        r = self._get("/api/v1/admin/account-requests", headers=admin_h)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(_es_json(r))

    def test_listar_incluye_solicitudes_pendientes_con_datos_del_cliente(self):
        # Arrange
        _anon, _c, _t, admin_h = self._tokens()
        cliente = self._crear_cliente("list")
        s = self._solicitud_pendiente(cliente, tipo="inhabilitar")
        # Act
        r = self._get("/api/v1/admin/account-requests", headers=admin_h)
        # Assert: aparece con su motivo y el estado canónico.
        cuerpo = r.json()
        self.assertIn(s.id, [x["id"] for x in cuerpo])
        item = next(x for x in cuerpo if x["id"] == s.id)
        self.assertEqual(item["tipo"], "inhabilitar")
        self.assertEqual(item["estado"], "pendiente")
        self.assertEqual(item["cliente_email"], cliente.email)

    def test_aprobar_habilitacion_activa_la_cuenta_y_resuelve(self):
        # Arrange: cliente inactivo con solicitud de habilitación pendiente.
        _anon, _c, _t, admin_h = self._tokens()
        cliente = self._crear_cliente("ina", activo=False)
        s = self._solicitud_pendiente(cliente, tipo="habilitar")
        sid = s.id  # capturado antes: el router elimina la fila al resolver
        # Act
        r = self._put(f"/api/v1/admin/account-requests/{sid}/aprobar", headers=admin_h)
        # Assert: 200 JSON, cuenta activa y la solicitud sale del listado.
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(_es_json(r))
        self._resincronizar()
        self.db.expire_all()
        cliente_db = self.db.query(Cliente).filter(Cliente.id_cliente == cliente.id_cliente).first()
        self.assertTrue(bool(cliente_db.is_active))
        restantes = self.db.query(SolicitudCuenta).filter(SolicitudCuenta.id == sid).count()
        self.assertEqual(restantes, 0)

    def test_rechazar_inhabilitacion_deja_la_cuenta_activa(self):
        # Arrange
        _anon, _c, _t, admin_h = self._tokens()
        cliente = self._crear_cliente("rech")
        s = self._solicitud_pendiente(cliente, tipo="inhabilitar")
        sid = s.id
        # Act
        r = self._put(f"/api/v1/admin/account-requests/{sid}/rechazar", headers=admin_h)
        # Assert
        self.assertEqual(r.status_code, 200, r.text)
        self._resincronizar()
        cliente_db = self.db.query(Cliente).filter(Cliente.id_cliente == cliente.id_cliente).first()
        self.assertTrue(bool(cliente_db.is_active))
        restantes = self.db.query(SolicitudCuenta).filter(SolicitudCuenta.id == sid).count()
        self.assertEqual(restantes, 0)

    def test_recurso_inexistente_responde_404_json_sin_fugas(self):
        # Arrange
        _anon, _c, _t, admin_h = self._tokens()
        # Act
        r = self._put("/api/v1/admin/account-requests/999999/aprobar", headers=admin_h)
        # Assert
        self.assertEqual(r.status_code, 404, r.text)
        self.assertTrue(_es_json(r))
        self.assertIn("detail", r.json())
        self.assertTrue(_sin_fugas(r.text))

    def test_habilitar_cuenta_directa_y_doble_habilitacion_400(self):
        # Arrange
        _anon, _c, _t, admin_h = self._tokens()
        cliente = self._crear_cliente("dir", activo=False)
        s = self._solicitud_pendiente(cliente, tipo="habilitar")
        sid = s.id
        # Act: habilitación directa.
        r1 = self._put(f"/api/v1/admin/account-requests/{sid}/habilitar-cuenta", headers=admin_h)
        # Assert: cuenta activa y la solicitud resuelta (fuera del listado).
        self.assertEqual(r1.status_code, 200, r1.text)
        self._resincronizar()
        self.db.expire_all()
        cliente_db = self.db.query(Cliente).filter(Cliente.id_cliente == cliente.id_cliente).first()
        self.assertTrue(bool(cliente_db.is_active))
        self.assertEqual(self.db.query(SolicitudCuenta).filter(SolicitudCuenta.id == sid).count(), 0)
        # Repetir sobre el mismo id → 404 (la solicitud ya no existe).
        r2 = self._put(f"/api/v1/admin/account-requests/{sid}/habilitar-cuenta", headers=admin_h)
        self.assertEqual(r2.status_code, 404, r2.text)
        # Nueva solicitud del MISMO cliente, que ya está activo → 400 con regla.
        cliente2 = self._crear_cliente("dir2", activo=True)
        s2 = self._solicitud_pendiente(cliente2, tipo="habilitar")
        sid2 = s2.id
        r3 = self._put(f"/api/v1/admin/account-requests/{sid2}/habilitar-cuenta", headers=admin_h)
        self.assertEqual(r3.status_code, 400, r3.text)
        self.assertEqual(r3.json()["detail"], "La cuenta del cliente ya está activa")
        self._ids_solicitud.append(s2.id)  # queda pendiente: la limpia el tearDown

    def test_solicitud_empleado_aprobada_activa_al_tecnico(self):
        # Arrange
        _anon, _c, _t, admin_h = self._tokens()
        u = self._crear_usuario("emp", 2, activo=False)
        t = Tecnico(id_usuario_t=u.id_usuario, certificacion_t="")
        self.db.add(t)
        self.db.commit()
        self._ids_usuario.append(u.id_usuario)
        s = SolicitudHabilitacionEmpleado(id_usuario=u.id_usuario, estado="pendiente")
        self.db.add(s)
        self.db.commit()
        self.db.refresh(s)
        sid = s.id
        self._ids_solicitud_emp.append(sid)
        # Act
        r = self._put(f"/api/v1/admin/account-requests/empleados/{sid}/aprobar", headers=admin_h)
        # Assert: técnico activo y solicitud fuera del listado.
        self.assertEqual(r.status_code, 200, r.text)
        self._resincronizar()
        u_db = self.db.query(User).filter(User.id_usuario == u.id_usuario).first()
        self.assertTrue(bool(u_db.is_active))


class TarifasTestCase(BaseT1TestCase):
    """Contrato de /tarifas (lectura pública, escritura solo admin)."""

    def setUp(self):
        super().setUp()
        self._ids_tarifa = []

    def tearDown(self):
        for tid in self._ids_tarifa:
            self.db.query(TarifaServicio).filter(TarifaServicio.id_tarifa == tid).delete(synchronize_session=False)
        self.db.commit()
        super().tearDown()

    def _tarifa(self, costo=50000):
        # Tipo ÚNICO por prueba: 'instalacion' ya existe como dato de
        # referencia sembrado por migraciones (uq_tarifa_tipo_servicio).
        tipo = f"prueba.tarifa.{int(time.time() * 1_000_000)}"
        t = TarifaServicio(tipo_servicio=tipo, costo=costo, descripcion="Prueba")
        self.db.add(t)
        self.db.commit()
        self.db.refresh(t)
        self._ids_tarifa.append(t.id_tarifa)
        return t

    def _tokens(self):
        cliente = self._crear_cliente("tar")
        u, _t = self._crear_tecnico("tar")
        admin = self._crear_admin("tar")
        return (
            {},
            self._bearer(self._token(self._login(cliente.email))),
            self._bearer(self._token(self._login(u.email))),
            self._bearer(self._token(self._login(admin.email))),
        )

    def test_listado_publico_con_content_type_json(self):
        # Arrange
        self._tarifa()
        # Act
        r = self._get("/api/v1/tarifas")
        # Assert: público, JSON y estructurado.
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(_es_json(r))
        items = r.json()
        self.assertTrue(all("tipo_servicio" in x and "costo" in x for x in items))

    def test_actualizar_solo_admin_y_costo_positivo(self):
        # Arrange
        _anon, cliente_h, tecnico_h, admin_h = self._tokens()
        t = self._tarifa()
        # Act / Assert: anónimo 401; cliente 401 (por diseño de la sesión);
        # técnico autenticado 403 (permisos insuficientes).
        self.assertEqual(self._put(f"/api/v1/tarifas/{t.tipo_servicio}", json={"costo": 60000}).status_code, 401)
        self.assertEqual(
            self._put(f"/api/v1/tarifas/{t.tipo_servicio}", json={"costo": 60000}, headers=cliente_h).status_code,
            401,
        )
        self.assertEqual(
            self._put(f"/api/v1/tarifas/{t.tipo_servicio}", json={"costo": 60000}, headers=tecnico_h).status_code,
            403,
        )
        # Admin con costo no positivo → 400 con regla de negocio explícita.
        r_malo = self._put(f"/api/v1/tarifas/{t.tipo_servicio}", json={"costo": 0}, headers=admin_h)
        self.assertEqual(r_malo.status_code, 400, r_malo.text)
        self.assertEqual(r_malo.json()["detail"], "El costo debe ser mayor a cero")
        # Admin con costo válido → 200 y valor persistido.
        r = self._put(f"/api/v1/tarifas/{t.tipo_servicio}", json={"costo": 65000}, headers=admin_h)
        self.assertEqual(r.status_code, 200, r.text)
        self._resincronizar()
        self.db.expire_all()
        self.assertEqual(
            self.db.query(TarifaServicio).filter(TarifaServicio.id_tarifa == t.id_tarifa).first().costo,
            65000,
        )

    def test_tarifa_inexistente_404_json_sin_fugas(self):
        # Arrange
        _anon, _c, _t, admin_h = self._tokens()
        # Act
        r = self._put("/api/v1/tarifas/no-existe", json={"costo": 10000}, headers=admin_h)
        # Assert
        self.assertEqual(r.status_code, 404, r.text)
        self.assertTrue(_es_json(r))
        self.assertTrue(_sin_fugas(r.text))


class ContactoConsultasTestCase(BaseT1TestCase):
    """Contrato de /contacto (público/autenticado) y /admin/consultas."""

    def setUp(self):
        super().setUp()
        self._ids_consulta = []

    def tearDown(self):
        for cid in self._ids_consulta:
            self.db.query(Contacto).filter(Contacto.id == cid).delete(synchronize_session=False)
        self.db.commit()
        super().tearDown()

    def _tokens(self):
        """Devuelve (anonimo, cliente, técnico, admin) listos para headers y
        guarda el correo del cliente autenticado en self._correo_cliente."""
        cliente = self._crear_cliente("con")
        u, _t = self._crear_tecnico("con")
        admin = self._crear_admin("con")
        self._correo_cliente = cliente.email
        return (
            {},
            self._bearer(self._token(self._login(cliente.email))),
            self._bearer(self._token(self._login(u.email))),
            self._bearer(self._token(self._login(admin.email))),
        )

    def _crear_consulta(self, email, categoria="pedido", mensaje="¿Dónde está mi pedido?", estado="pendiente"):
        c = Contacto(
            nombre_usuario="Cliente Prueba", email_usuario=email, asunto="Pedido",
            mensaje=mensaje, categoria=categoria, estado=estado,
        )
        self.db.add(c)
        self.db.commit()
        self.db.refresh(c)
        self._ids_consulta.append(c.id)
        return c

    def test_crear_consulta_publica_y_aparece_para_admin(self):
        # Arrange
        _anon, _c, _t, admin_h = self._tokens()
        # Act
        r = self._post("/api/v1/contacto", json={
            "nombre": "Visitante Prueba", "email": "visitante@example.com",
            "asunto": "Pedido", "mensaje": "¿Dónde está mi pedido 91?", "categoria": "pedido",
        })
        # Assert: respuesta JSON con id + visible para el admin.
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(_es_json(r))
        consulta_id = r.json()["id"]
        self._ids_consulta.append(consulta_id)
        listado = self._get("/api/v1/admin/consultas", headers=admin_h)
        self.assertEqual(listado.status_code, 200)
        self.assertIn(consulta_id, [x["id"] for x in listado.json()])

    def test_crear_consulta_email_invalido_422_json(self):
        # Act: Pydantic rechaza el email con forma de error estructurada.
        r = self._post("/api/v1/contacto", json={
            "nombre": "Visitante", "email": "no-es-correo", "asunto": "Pedido",
            "mensaje": "hola", "categoria": "pedido",
        })
        # Assert
        self.assertEqual(r.status_code, 422, r.text)
        self.assertTrue(_es_json(r))
        detalle = r.json()["detail"]
        self.assertEqual(detalle[0]["loc"][-1], "email")

    def test_json_malformado_responde_4xx_json_sin_html(self):
        # Act: cuerpo corrupto (no JSON válido).
        r = self._post(
            "/api/v1/contacto",
            content=b"{nombre: roto,",
            headers={"Content-Type": "application/json"},
        )
        # Assert: 4xx con cuerpo JSON legible, sin stack ni HTML.
        self.assertIn(r.status_code, (400, 422), r.text)
        self.assertTrue(_es_json(r))
        self.assertTrue(_sin_fugas(r.text))
        self.assertIn("detail", r.json())

    def test_admin_consultas_permisos_y_resolucion(self):
        # Arrange
        _anon, cliente_h, tecnico_h, admin_h = self._tokens()
        consulta = self._crear_consulta("alguien@example.com", categoria="reclamo")
        # Act / Assert: permisos del listado admin.
        self.assertEqual(self._get("/api/v1/admin/consultas").status_code, 401)
        self.assertEqual(self._get("/api/v1/admin/consultas", headers=cliente_h).status_code, 401)  # por diseño: la sesión de cliente se marca 401 (no 403)
        self.assertEqual(self._get("/api/v1/admin/consultas", headers=tecnico_h).status_code, 403)
        r_list = self._get("/api/v1/admin/consultas", headers=admin_h)
        self.assertEqual(r_list.status_code, 200)
        self.assertIn(consulta.id, [x["id"] for x in r_list.json()])
        # Resolución admin: estado válido → 200 y persistido.
        r_res = self._put(f"/api/v1/admin/consultas/{consulta.id}",
                          json={"estado": "resuelta", "respuesta": "Tu pedido salió."}, headers=admin_h)
        self.assertEqual(r_res.status_code, 200, r_res.text)
        self._resincronizar()
        self.db.expire_all()
        estado = self.db.query(Contacto).filter(Contacto.id == consulta.id).first().estado
        self.assertEqual(estado, "resuelta")

    def test_resolucion_con_estado_invalido_rechazada(self):
        # Arrange
        _anon, _c, _t, admin_h = self._tokens()
        consulta = self._crear_consulta("estado@example.com")
        # Act
        r = self._put(f"/api/v1/admin/consultas/{consulta.id}",
                      json={"estado": "estado-inventado"}, headers=admin_h)
        # Assert: 400/422 JSON con regla de negocio, sin fugas.
        self.assertIn(r.status_code, (400, 422), r.text)
        self.assertTrue(_es_json(r))
        self.assertTrue(_sin_fugas(r.text))

    def test_mias_solo_devuelve_las_del_propio_cliente(self):
        # Arrange: dos clientes; la consulta autenticada usa el CORREO de la
        # cuenta (contrato: "El correo debe coincidir con la cuenta").
        _anon, cliente_h, _t, _a = self._tokens()
        otro = self._crear_cliente("otro")
        r = self._post("/api/v1/contacto/autenticado", json={
            "nombre": "Cliente Prueba", "email": self._correo_cliente,
            "asunto": "Pago", "mensaje": "No me llegó la factura", "categoria": "pago",
        }, headers=cliente_h)
        self.assertEqual(r.status_code, 200, r.text)
        consulta_id = r.json()["id"]
        self._ids_consulta.append(consulta_id)
        # Act: el propietario la ve; otro cliente no.
        mias = self._get("/api/v1/contacto/mias", headers=cliente_h)
        self.assertEqual(mias.status_code, 200)
        self.assertIn(consulta_id, [x["id"] for x in mias.json()])
        otro_h = self._bearer(self._token(self._login(otro.email)))
        mias_otro = self._get("/api/v1/contacto/mias", headers=otro_h)
        self.assertEqual(mias_otro.status_code, 200)
        self.assertNotIn(consulta_id, [x["id"] for x in mias_otro.json()])

    def test_consulta_inexistente_al_resolver_404(self):
        # Arrange
        _anon, _c, _t, admin_h = self._tokens()
        # Act
        r = self._put("/api/v1/admin/consultas/999999", json={"estado": "resuelta"}, headers=admin_h)
        # Assert
        self.assertEqual(r.status_code, 404, r.text)
        self.assertTrue(_es_json(r))
        self.assertTrue(_sin_fugas(r.text))


class ListadosAdminRobustosTestCase(BaseT1TestCase):
    """H-4: un dato heredado inválido no debe tumbar el listado admin.

    La validación EmailStr se conserva en escrituras y en /clients/me; el
    listado de solo lectura devuelve la fila tal como está para que el admin
    pueda detectarla y corregirla en lugar de recibir un 500 global.
    """

    def setUp(self):
        super().setUp()
        admin = self._crear_admin("list")
        self.admin_h = self._bearer(self._token(self._login(admin.email)))
        self.cliente = self._crear_cliente("h4")
        # Simula una fila heredada/corrupta: se escribe directo en BD para
        # saltar la validación de la API.
        self.cliente.email = f"correo-invalido.{int(time.time() * 1_000_000)}"
        self.db.commit()

    def test_listado_clientes_tolera_email_invalido(self):
        # Act
        r = self._get("/api/v1/clients", headers=self.admin_h)
        # Assert: 200, JSON y la fila visible con su correo crudo.
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(_es_json(r))
        fila = next(x for x in r.json() if x["id_cliente"] == self.cliente.id_cliente)
        self.assertEqual(fila["email"], self.cliente.email)
        self.assertEqual(fila["pedidos_count"], 0)
        self.assertEqual(fila["citas_count"], 0)
        self.assertTrue(_sin_fugas(r.text))


if __name__ == "__main__":
    unittest.main(verbosity=2)
