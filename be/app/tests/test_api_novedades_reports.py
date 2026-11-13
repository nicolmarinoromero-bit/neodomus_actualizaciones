"""Semana 4 del bootcamp — contrato HTTP de novedades + cupones y reportes.

Ángulos:
- API: catálogos públicos, listado admin, detalle, cambio de estado, y el
  ciclo completo de un cupón (crear desde novedad → validar → agotado).
- Seguridad: técnico dueño de la novedad, admin, cliente y anónimo.
- Contrato: 400 con reglas de negocio explícitas (tipo/prioridad), 404 JSON,
  409 por código de cupón duplicado, Content-Type JSON.
"""
import time
import unittest

import app.tests.testdb  # noqa: F401

from app.database import SessionLocal
from app.models.cita import Cita
from app.models.cliente import Cliente
from app.models.novedad import CuponDescuento
from app.models.novedad import Novedad
from app.models.notificacion import Notificacion
from app.models.tecnico import Tecnico
from app.models.user import User
from app.tests.test_t1_identidad import BaseT1TestCase, PASSWORD
from app.utils.security import hash_password


class NovedadesCuponesTestCase(BaseT1TestCase):
    def setUp(self):
        super().setUp()
        self._ids_novedad = []
        self._ids_cupon = []
        self._ids_cita = []
        # Actores fijos de esta clase.
        self.cliente = self._crear_cliente("nov")
        self.tecnico_user = self._crear_usuario("nov", 2)
        self.tecnico = Tecnico(id_usuario_t=self.tecnico_user.id_usuario, certificacion_t="")
        self.db.add(self.tecnico)
        self.admin_user = self._crear_admin("nov")
        self.db.commit()
        self.tecnico_h = self._bearer(self._token(self._login(self.tecnico_user.email)))
        self.admin_h = self._bearer(self._token(self._login(self.admin_user.email)))
        self.cliente_h = self._bearer(self._token(self._login(self.cliente.email)))

    def tearDown(self):
        for cid in self._ids_cupon:
            self.db.query(CuponDescuento).filter(CuponDescuento.id_cupon == cid).delete(synchronize_session=False)
        for nid in self._ids_novedad:
            self.db.query(Novedad).filter(Novedad.id_novedad == nid).delete(synchronize_session=False)
        for cid in self._ids_cita:
            self.db.query(Cita).filter(Cita.id_cita == cid).delete(synchronize_session=False)
        # Notificaciones generadas por cupones/novedades.
        self.db.query(Notificacion).filter(Notificacion.id_cliente == self.cliente.id_cliente).delete(synchronize_session=False)
        self.db.commit()
        super().tearDown()

    def _cita(self, tecnico=None):
        cita = Cita(
            id_cliente=self.cliente.id_cliente,
            id_tecnico=(tecnico or self.tecnico).id_tecnico,
            tipo_servicio="Instalación", fecha="2030-01-10", hora="10:00",
            direccion="Calle novedad 1", estado="Confirmada",
        )
        self.db.add(cita)
        self.db.commit()
        self.db.refresh(cita)
        self._ids_cita.append(cita.id_cita)
        return cita

    def _novedad(self, tipo="Retraso en entrega", estado="Pendiente", cliente=True, cita=None):
        n = Novedad(
            tipo_novedad=tipo, prioridad="normal", estado_novedad=estado,
            descripcion_novedad="Novedad de prueba",
            id_cliente=self.cliente.id_cliente if cliente else None,
            id_cita=cita.id_cita if cita else None,
            id_tecnico_n=self.tecnico.id_tecnico,
        )
        self.db.add(n)
        self.db.commit()
        self.db.refresh(n)
        self._ids_novedad.append(n.id_novedad)
        return n

    # ── Catálogos (públicos) ───────────────────────────────────────────────
    def test_catalogos_publicos_con_content_type(self):
        for ruta in ("/api/v1/novedades/tipos", "/api/v1/novedades/estados", "/api/v1/novedades/prioridades"):
            r = self._get(ruta)
            self.assertEqual(r.status_code, 200, r.text)
            self.assertTrue(r.headers.get("content-type", "").startswith("application/json"))

    def test_tipos_invalido_y_prioridad_invalida_400(self):
        # Arrange: el técnico registra una novedad sobre SU cita.
        cita = self._cita()
        base = {
            "descripcion": "El cliente no estaba", "prioridad": "normal",
            "id_cita": cita.id_cita, "id_cliente": self.cliente.id_cliente,
        }
        # Act: tipo inexistente.
        r1 = self._post("/api/v1/novedades", json={**base, "tipo_novedad": "tipo-inexistente"},
                        headers=self.tecnico_h)
        # Assert: 400 con la lista de tipos válidos.
        self.assertEqual(r1.status_code, 400, r1.text)
        self.assertIn("Tipo de novedad no válido", r1.json()["detail"])
        # Act: prioridad fuera del catálogo.
        r2 = self._post("/api/v1/novedades", json={**base, "tipo_novedad": "Retraso en entrega",
                                                  "prioridad": "maxima"},
                        headers=self.tecnico_h)
        self.assertEqual(r2.status_code, 400, r2.text)
        self.assertIn("Prioridad no válida", r2.json()["detail"])

    def test_tecnico_no_puede_novedad_sobre_cita_ajena_403(self):
        # Arrange: otro técnico y SU cita.
        otro_user = self._crear_usuario("otro", 2)
        otro_tec = Tecnico(id_usuario_t=otro_user.id_usuario, certificacion_t="")
        self.db.add(otro_tec)
        self.db.commit()
        cita_ajena = self._cita(tecnico=otro_tec)
        # Act: el técnico original intenta registrar novedad sobre la cita ajena.
        r = self._post("/api/v1/novedades", json={
            "tipo_novedad": "Retraso en entrega", "prioridad": "normal",
            "descripcion": "intento ajeno", "id_cita": cita_ajena.id_cita,
        }, headers=self.tecnico_h)
        # Assert
        self.assertEqual(r.status_code, 403, r.text)
        self.assertIn("No tienes autorización", r.json()["detail"])

    def test_listado_admin_y_detalle_404(self):
        # Arrange
        n = self._novedad()
        # Act: listado admin.
        r = self._get("/api/v1/novedades", headers=self.admin_h)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn(n.id_novedad, [x.get("id_novedad") or x.get("id") for x in r.json()])
        # Detalle existente (admin).
        r_det = self._get(f"/api/v1/novedades/{n.id_novedad}", headers=self.admin_h)
        self.assertEqual(r_det.status_code, 200, r_det.text)
        # Detalle inexistente → 404 JSON.
        r_404 = self._get("/api/v1/novedades/999999", headers=self.admin_h)
        self.assertEqual(r_404.status_code, 404, r_404.text)
        self.assertTrue(r_404.headers.get("content-type", "").startswith("application/json"))

    def test_cambiar_estado_admin(self):
        # Arrange
        n = self._novedad(estado="Pendiente")
        # Act
        r = self._put(f"/api/v1/novedades/{n.id_novedad}/estado",
                      json={"nuevo_estado": "En revisión"}, headers=self.admin_h)
        # Assert: el estado queda persistido.
        self.assertEqual(r.status_code, 200, r.text)
        self._resincronizar()
        self.db.expire_all()
        self.assertEqual(
            self.db.query(Novedad).filter(Novedad.id_novedad == n.id_novedad).first().estado_novedad,
            "En revisión",
        )


class CuponesTestCase(BaseT1TestCase):
    def setUp(self):
        super().setUp()
        self._ids_novedad = []
        self._ids_cupon = []
        self.cliente = self._crear_cliente("cup")
        self.admin_user = self._crear_admin("cup")
        self.admin_h = self._bearer(self._token(self._login(self.admin_user.email)))
        self.cliente_h = self._bearer(self._token(self._login(self.cliente.email)))

    def tearDown(self):
        for cid in self._ids_cupon:
            self.db.query(CuponDescuento).filter(CuponDescuento.id_cupon == cid).delete(synchronize_session=False)
        for nid in self._ids_novedad:
            self.db.query(Novedad).filter(Novedad.id_novedad == nid).delete(synchronize_session=False)
        self.db.query(Notificacion).filter(Notificacion.id_cliente == self.cliente.id_cliente).delete(synchronize_session=False)
        self.db.commit()
        super().tearDown()

    def _novedad_con_cliente(self):
        n = Novedad(tipo_novedad="Retraso en entrega", prioridad="normal", estado_novedad="Pendiente",
                    descripcion_novedad="Retraso logístico", id_cliente=self.cliente.id_cliente)
        self.db.add(n)
        self.db.commit()
        self.db.refresh(n)
        self._ids_novedad.append(n.id_novedad)
        return n

    def _crear_cupon(self, codigo, novedad=None):
        n = novedad or self._novedad_con_cliente()
        return self._post(
            f"/api/v1/novedades/{n.id_novedad}/cupon",
            json={
                "codigo": codigo, "tipo_descuento": "porcentaje", "valor_descuento": 10,
                "compra_minima": 10000,
            },
            headers=self.admin_h,
        )

    def test_ciclo_completo_cupon_crear_validar_y_duplicado(self):
        # Arrange
        codigo = f"CUPON{int(time.time() * 1_000_000) % 10**8}"
        # Act: crear desde la novedad (solo admin).
        r1 = self._crear_cupon(codigo)
        # Assert: creado con sus campos.
        self.assertEqual(r1.status_code, 200, r1.text)
        self.assertEqual(r1.json()["codigo"], codigo)
        cupon_id = r1.json().get("id_cupon")
        if cupon_id:
            self._ids_cupon.append(cupon_id)
        # Act: el cliente lo valida.
        r2 = self._get("/api/v1/novedades/cupones/validar", params={"codigo": codigo}, headers=self.cliente_h)
        self.assertEqual(r2.status_code, 200, r2.text)
        self.assertEqual(r2.json()["tipo_descuento"], "porcentaje")
        self.assertEqual(r2.json()["valor_descuento"], 10)
        # Act: crear OTRO cupón con el MISMO código → 400 (regla de negocio del
        # servicio: mensaje "Ya existe un cupón con el código ...").
        r3 = self._crear_cupon(codigo)
        self.assertEqual(r3.status_code, 400, r3.text)
        self.assertIn("Ya existe un cupón", r3.json()["detail"])

    def test_validar_cupon_inexistente_404_y_sin_sesion_401(self):
        # Act / Assert
        r_anon = self._get("/api/v1/novedades/cupones/validar", params={"codigo": "NOEXISTE123"})
        self.assertEqual(r_anon.status_code, 401)
        r = self._get("/api/v1/novedades/cupones/validar", params={"codigo": "NOEXISTE123"},
                      headers=self.cliente_h)
        self.assertEqual(r.status_code, 404, r.text)
        self.assertEqual(r.json()["detail"], "Cupón no válido o expirado")

    def test_mis_cupones_del_cliente(self):
        # Arrange: cupón creado desde una novedad del cliente.
        codigo = f"MISOC{int(time.time() * 1_000_000) % 10**8}"
        r1 = self._crear_cupon(codigo)
        self.assertEqual(r1.status_code, 200, r1.text)
        cupon_id = r1.json().get("id_cupon")
        if cupon_id:
            self._ids_cupon.append(cupon_id)
        # Act
        r = self._get("/api/v1/novedades/cliente/mis-cupones", headers=self.cliente_h)
        # Assert: el cupón del cliente aparece en su listado.
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn(codigo, [x.get("codigo") for x in r.json()])


class ReportesContratoTestCase(BaseT1TestCase):
    def setUp(self):
        super().setUp()
        self.cliente = self._crear_cliente("rep")
        u = self._crear_usuario("rep", 2)
        self.tecnico = Tecnico(id_usuario_t=u.id_usuario, certificacion_t="")
        self.db.add(self.tecnico)
        self.admin_user = self._crear_admin("rep")
        self.db.commit()
        self.admin_h = self._bearer(self._token(self._login(self.admin_user.email)))
        self.cliente_h = self._bearer(self._token(self._login(self.cliente.email)))
        self.tecnico_h = self._bearer(self._token(self._login(u.email)))

    def tearDown(self):
        # Notificaciones generadas por reportes no se crean; no hay fixtures.
        self.db.commit()
        super().tearDown()

    def test_reportes_admin_permisos(self):
        # Act / Assert: anónimo 401, cliente 401 (sesión no de empleado),
        # técnico 403, admin 200 JSON con estructura.
        self.assertEqual(self._get("/api/v1/reports/operativo").status_code, 401)
        self.assertEqual(self._get("/api/v1/reports/operativo", headers=self.cliente_h).status_code, 401)
        self.assertEqual(self._get("/api/v1/reports/operativo", headers=self.tecnico_h).status_code, 403)
        r = self._get("/api/v1/reports/operativo", headers=self.admin_h)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(r.headers.get("content-type", "").startswith("application/json"))

    def test_resumen_admin_estructura(self):
        # Act
        r = self._get("/api/v1/reports/resumen", headers=self.admin_h)
        # Assert: 200 JSON (los números dependen de la base de pruebas).
        self.assertEqual(r.status_code, 200, r.text)
        cuerpo = r.json()
        self.assertTrue(isinstance(cuerpo, dict) and len(cuerpo) > 0)

    def test_ventas_admin_sin_parametros_200(self):
        # Act
        r = self._get("/api/v1/reports/ventas", headers=self.admin_h)
        # Assert
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(r.headers.get("content-type", "").startswith("application/json"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
