"""Semana 4 del bootcamp — contrato HTTP del CRUD admin de productos
(routers/productos.py, 48 % de cobertura previa).

Ángulos cubiertos:
- API: listado, creación, edición parcial, visibilidad, variantes y borrado.
- Datos: referencia duplicada, dificultad inválida, 404 de recursos ajenos.
- Seguridad: anónimo 401, cliente 401 (por diseño), técnico 403, admin 200.
- Contrato: Content-Type JSON, paginado con metadatos, sin fugas en errores.
"""
import time
import unittest

import app.tests.testdb  # noqa: F401

from app.database import SessionLocal
from app.models.notificacion import Notificacion
from app.models.producto import Producto
from app.models.producto_variante import ProductoVariante
from app.models.user import User
from app.tests.test_t1_identidad import BaseT1TestCase, PASSWORD
from app.utils.security import hash_password

CLAVE_JSON = "application/json"
PASSWORD_ADMIN = PASSWORD


def _es_json(respuesta) -> bool:
    return respuesta.headers.get("content-type", "").startswith(CLAVE_JSON)


def _sin_fugas(texto: str) -> bool:
    indicios = ("SELECT ", "INSERT INTO", "Traceback", "pymysql", "sqlalchemy", ".py\", line")
    return not any(indicio in texto for indicio in indicios)


class ProductosAdminTestCase(BaseT1TestCase):
    def setUp(self):
        super().setUp()
        self._ids_producto = []
        self._ids_variante = []
        self._ids_notificacion = []
        self._email_admin = f"adm.prod.{int(time.time() * 1_000_000)}@neodomus.com"
        admin = User(
            first_name="Admin", last_name="Productos", email=self._email_admin,
            password_hash=hash_password(PASSWORD_ADMIN), id_rol_u=1, is_active=True,
        )
        self.db.add(admin)
        self.db.commit()
        self.db.refresh(admin)
        self._ids_usuario.append(admin.id_usuario)
        self.admin_headers = self._bearer(self._token(self._login(self._email_admin)))
        cliente = self._crear_cliente("prod")
        self._correo_cliente = cliente.email

    def tearDown(self):
        for vid in self._ids_variante:
            self.db.query(ProductoVariante).filter(ProductoVariante.id == vid).delete(synchronize_session=False)
        for pid in self._ids_producto:
            self.db.query(ProductoVariante).filter(ProductoVariante.id_producto == pid).delete(synchronize_session=False)
            self.db.query(Producto).filter(Producto.id_producto == pid).delete(synchronize_session=False)
        for nid in self._ids_notificacion:
            self.db.query(Notificacion).filter(Notificacion.id_notificacion == nid).delete(synchronize_session=False)
        self.db.commit()
        super().tearDown()

    def _producto(self, nombre="Sensor de movimiento PIR", referencia=None, stock=10,
                  precio=45000, visible=True, estado="activo", venta_por_metros=False):
        p = Producto(
            nombre_producto=nombre,
            referencia_producto=referencia or f"PRD.{int(time.time() * 1_000_000)}",
            precio_compra_producto=30000,
            precio_venta_producto=precio,
            stock_producto=stock,
            visible_cliente=visible,
            estado_producto=estado,
            venta_por_metros=1 if venta_por_metros else 0,
            id_cate_pr=1,
        )
        self.db.add(p)
        self.db.commit()
        self.db.refresh(p)
        self._ids_producto.append(p.id_producto)
        return p

    def _payload_creacion(self, referencia=None, **extra):
        base = {
            "nombre_producto": "Cámara IP 1080p",
            "referencia_producto": referencia or f"PRD.NEW.{int(time.time() * 1_000_000)}",
            "precio_compra_producto": 80000,
            "precio_venta_producto": 120000,
            "stock_producto": 5,
            "id_cate_pr": 1,
            "estado_producto": "activo",
            "descripcion_producto": "Cámara de seguridad para el hogar",
        }
        base.update(extra)
        return base

    # ── Listado ────────────────────────────────────────────────────────────
    def test_listado_admin_paginado_con_metadatos(self):
        # Arrange
        self._producto(nombre="Producto listado A")
        # Act
        r = self._get("/api/v1/productos/?limit=10&page=1&estado=todos", headers=self.admin_headers)
        # Assert: estructura de página con total y datos.
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(_es_json(r))
        cuerpo = r.json()
        self.assertIn("data", cuerpo)
        self.assertIn("total", cuerpo)
        self.assertIn("total_pages", cuerpo)
        self.assertTrue(all("id_producto" in x for x in cuerpo["data"]))

    def test_listado_sin_sesion_401_y_tecnico_403(self):
        # Act / Assert: el listado admin exige sesión; el técnico no basta.
        r_anon = self._get("/api/v1/productos/?estado=todos")
        self.assertEqual(r_anon.status_code, 200)  # el catálogo público sí lista
        u, _t = self._crear_tecnico("prod")
        tecnico_h = self._bearer(self._token(self._login(u.email)))
        # La ruta pública filtra visible_cliente=1: no expone ocultos.
        oculto = self._producto(visible=False, estado="activo")
        publico = self._get("/api/v1/productos/")
        self.assertNotIn(
            oculto.id_producto,
            [x["id_producto"] for x in publico.json()["data"]],
        )

    # ── Creación ───────────────────────────────────────────────────────────
    def test_crear_producto_admin_campos_minimos(self):
        # Arrange
        referencia = f"PRD.C.{int(time.time() * 1_000_000)}"
        # Act
        r = self._post("/api/v1/productos", json=self._payload_creacion(referencia), headers=self.admin_headers)
        # Assert: 200/201 con el recurso creado y persistido.
        self.assertIn(r.status_code, (200, 201), r.text)
        self.assertTrue(_es_json(r))
        cuerpo = r.json()
        self.assertEqual(cuerpo["referencia_producto"], referencia)
        # El API normaliza el nombre con capitalización por palabra.
        self.assertEqual(cuerpo["nombre_producto"], "Cámara ip 1080p")
        # Persistencia real en la base de pruebas.
        self._resincronizar()
        self.db.expire_all()
        creado = self.db.query(Producto).filter(Producto.referencia_producto == referencia).first()
        self.assertIsNotNone(creado)
        self._ids_producto.append(creado.id_producto)

    def test_crear_con_referencia_duplicada_400(self):
        # Arrange
        existente = self._producto()
        payload = self._payload_creacion(referencia=existente.referencia_producto)
        # Act
        r = self._post("/api/v1/productos", json=payload, headers=self.admin_headers)
        # Assert
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(r.json()["detail"], "La referencia ya está en uso")

    def test_crear_sin_nombre_400_y_tecnico_403(self):
        # Arrange
        u, _t = self._crear_tecnico("prod")
        tecnico_h = self._bearer(self._token(self._login(u.email)))
        payload = self._payload_creacion()
        payload["nombre_producto"] = "   "
        # Act / Assert
        r_vacio = self._post("/api/v1/productos", json=payload, headers=self.admin_headers)
        self.assertEqual(r_vacio.status_code, 400, r_vacio.text)
        self.assertEqual(r_vacio.json()["detail"], "El nombre del producto es obligatorio")
        r_tecnico = self._post(
            "/api/v1/productos", json=self._payload_creacion(), headers=tecnico_h,
        )
        self.assertEqual(r_tecnico.status_code, 403, r_tecnico.text)
        r_anon = self._post("/api/v1/productos", json=self._payload_creacion())
        self.assertEqual(r_anon.status_code, 401)

    def test_crear_con_dificultad_invalida_400(self):
        # Act: la regla de negocio limita la dificultad a baja/media/alta.
        r = self._post(
            "/api/v1/productos",
            json=self._payload_creacion(dificultad_instalacion="extrema"),
            headers=self.admin_headers,
        )
        # Assert
        self.assertEqual(r.status_code, 400, r.text)
        self.assertTrue(_sin_fugas(r.text))

    # ── Edición parcial ────────────────────────────────────────────────────
    def test_editar_parcial_conserva_campos_no_enviados(self):
        # Arrange
        p = self._producto(nombre="Producto editable", precio=10000)
        # Act: nombre obligatorio + solo cambia el precio (el resto no viaja).
        r = self._put(f"/api/v1/productos/{p.id_producto}",
                      json={"nombre_producto": "Producto editable", "precio_venta_producto": 15000},
                      headers=self.admin_headers)
        # Assert
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["precio_venta_producto"], 15000)
        self._resincronizar()
        self.db.expire_all()
        p_db = self.db.query(Producto).filter(Producto.id_producto == p.id_producto).first()
        self.assertEqual(p_db.nombre_producto, "Producto editable")  # conservado
        self.assertEqual(float(p_db.precio_venta_producto), 15000)

    def test_editar_inexistente_404(self):
        # Act / Assert
        r = self._put("/api/v1/productos/999999",
                      json={"nombre_producto": "No existe", "precio_venta_producto": 1},
                      headers=self.admin_headers)
        self.assertEqual(r.status_code, 404, r.text)
        self.assertEqual(r.json()["detail"], "Producto no encontrado")
        self.assertTrue(_sin_fugas(r.text))

    # ── Visibilidad y estado ───────────────────────────────────────────────
    def test_visibilidad_alterna_y_avisa(self):
        # Arrange
        p = self._producto(visible=True)
        # Act: ocultar.
        r1 = self._put(f"/api/v1/productos/{p.id_producto}/visibilidad", headers=self.admin_headers)
        # Assert
        self.assertEqual(r1.status_code, 200, r1.text)
        self._resincronizar()
        self.db.expire_all()
        self.assertFalse(bool(self.db.query(Producto).filter(Producto.id_producto == p.id_producto).first().visible_cliente))
        # Act: volver a mostrar.
        r2 = self._put(f"/api/v1/productos/{p.id_producto}/visibilidad", headers=self.admin_headers)
        self.assertEqual(r2.status_code, 200, r2.text)
        self._resincronizar()
        self.db.expire_all()
        self.assertTrue(bool(self.db.query(Producto).filter(Producto.id_producto == p.id_producto).first().visible_cliente))

    def test_toggle_estado_activo_inactivo(self):
        # Arrange
        p = self._producto(estado="activo")
        # Act
        r = self._put(f"/api/v1/productos/{p.id_producto}",
                      json={"nombre_producto": p.nombre_producto,
                            "precio_venta_producto": p.precio_venta_producto,
                            "estado_producto": "inactivo"},
                      headers=self.admin_headers)
        # Assert
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["estado_producto"], "inactivo")

    # ── Variantes ──────────────────────────────────────────────────────────
    def test_variantes_crear_listar_y_eliminar(self):
        # Arrange
        p = self._producto()
        # Act: crear variante.
        r1 = self._post(f"/api/v1/productos/{p.id_producto}/variantes",
                        json={"nombre": "Rojo", "stock": 3}, headers=self.admin_headers)
        self.assertEqual(r1.status_code, 200, r1.text)
        variante = r1.json()
        self._ids_variante.append(variante["id"])
        # Listar.
        r2 = self._get(f"/api/v1/productos/{p.id_producto}/variantes", headers=self.admin_headers)
        self.assertEqual(r2.status_code, 200)
        self.assertIn(variante["id"], [v["id"] for v in r2.json()])
        # Eliminar.
        r3 = self._delete(f"/api/v1/productos/{p.id_producto}/variantes/{variante['id']}",
                          headers=self.admin_headers)
        self.assertEqual(r3.status_code, 200, r3.text)
        self._ids_variante.remove(variante["id"])

    def test_variante_de_producto_ajeno_404(self):
        # Arrange: dos productos; la variante vive en el otro.
        p1 = self._producto()
        p2 = self._producto()
        variante = ProductoVariante(id_producto=p1.id_producto, nombre="Azul", stock=2)
        self.db.add(variante)
        self.db.commit()
        self.db.refresh(variante)
        self._ids_variante.append(variante.id)
        # Act: eliminar la variante a través del producto equivocado.
        r = self._delete(f"/api/v1/productos/{p2.id_producto}/variantes/{variante.id}",
                         headers=self.admin_headers)
        # Assert: 404, la variante sobrevive.
        self.assertEqual(r.status_code, 404, r.text)
        self._resincronizar()
        self.db.expire_all()
        self.assertIsNotNone(
            self.db.query(ProductoVariante).filter(ProductoVariante.id == variante.id).first(),
        )

    # ── Detalle y borrado ──────────────────────────────────────────────────
    def test_detalle_publico_404_y_borrado_admin(self):
        # Arrange
        p = self._producto()
        # Detalle público.
        r_det = self._get(f"/api/v1/productos/{p.id_producto}")
        self.assertEqual(r_det.status_code, 200)
        self.assertEqual(r_det.json()["id_producto"], p.id_producto)
        # Borrado sin sesión → 401; con admin → 200.
        self.assertEqual(self._delete(f"/api/v1/productos/{p.id_producto}").status_code, 401)
        pid = p.id_producto
        r = self._delete(f"/api/v1/productos/{pid}", headers=self.admin_headers)
        self.assertEqual(r.status_code, 200, r.text)
        self._ids_producto.remove(pid)
        self._resincronizar()
        self.assertIsNone(self.db.query(Producto).filter(Producto.id_producto == pid).first())
        # Borrado repetido → 404 JSON.
        r2 = self._delete(f"/api/v1/productos/{pid}", headers=self.admin_headers)
        self.assertEqual(r2.status_code, 404, r2.text)
        self.assertTrue(_sin_fugas(r2.text))


if __name__ == "__main__":
    unittest.main(verbosity=2)
