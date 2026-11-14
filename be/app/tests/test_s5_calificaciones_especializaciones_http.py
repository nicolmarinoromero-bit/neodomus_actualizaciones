"""Semana 5 del bootcamp — contrato HTTP de calificaciones y especializaciones.

Ambos routers tenían poca cobertura: aquí se ejercitan por HTTP real (ASGI)
los caminos felices y las reglas de negocio: solo se califica una cita
Finalizada y propia, una sola vez; las fotos validan formato/tamaño; el
catálogo de especializaciones exige rol administrador para escribir y no
permite borrar una especialización en uso.
"""
import time
import unittest
from datetime import date, timedelta
from unittest.mock import patch

import app.tests.testdb  # noqa: F401  (aislamiento antes de importar la app)

from app.database import SessionLocal
from app.models.calificacion import Calificacion
from app.models.calificacion_producto import CalificacionProducto
from app.models.cita import Cita
from app.models.especializacion import (
    Especializacion,
    producto_especializacion,
    tecnico_especializacion,
)
from app.models.pedido import DetallePedido, Pedido
from app.models.producto import Producto
from app.tests.test_t1_identidad import BaseT1TestCase


def _sufijo() -> str:
    return str(time.time_ns())


class CalificacionesHttpTestCase(BaseT1TestCase):
    def setUp(self):
        super().setUp()
        self._ids_calificacion = []
        self._ids_calificacion_producto = []
        self._ids_producto = []
        self._ids_detalle = []

    def tearDown(self):
        if self._ids_calificacion:
            self.db.query(Calificacion).filter(
                Calificacion.id_calificacion.in_(self._ids_calificacion)
            ).delete(synchronize_session=False)
        if self._ids_calificacion_producto:
            self.db.query(CalificacionProducto).filter(
                CalificacionProducto.id_calificacion_producto.in_(
                    self._ids_calificacion_producto
                )
            ).delete(synchronize_session=False)
        if self._ids_detalle:
            self.db.query(DetallePedido).filter(
                DetallePedido.id_detalle.in_(self._ids_detalle)
            ).delete(synchronize_session=False)
        if self._ids_pedido:
            self.db.query(DetallePedido).filter(
                DetallePedido.id_pedido_d.in_(self._ids_pedido)
            ).delete(synchronize_session=False)
        if self._ids_producto:
            self.db.query(Producto).filter(
                Producto.id_producto.in_(self._ids_producto)
            ).delete(synchronize_session=False)
        self.db.commit()
        super().tearDown()

    # ── Fixtures ────────────────────────────────────────────────────────────
    def _headers_cliente(self, cliente):
        r = self._login(cliente.email)
        self.assertEqual(r.status_code, 200, r.text)
        return self._bearer(self._token(r))

    def _cita(self, cliente, estado="Finalizada", tecnico=None, dias=5):
        cita = Cita(
            id_cliente=cliente.id_cliente,
            id_tecnico=tecnico.id_tecnico if tecnico else None,
            tipo_servicio="mantenimiento",
            fecha=date.today() + timedelta(days=dias),
            hora="09:00",
            direccion="Calle 1 # 2-3",
            estado=estado,
        )
        self.db.add(cita)
        self.db.commit()
        self.db.refresh(cita)
        self._ids_cita.append(cita.id_cita)
        return cita

    def _pedido(self, cliente, estado_entrega="Entregado"):
        pedido = Pedido(
            id_cliente_pe=cliente.id_cliente,
            total_pedido=100000,
            estado_pedido="Pagado",
            estado_entrega=estado_entrega,
        )
        self.db.add(pedido)
        self.db.commit()
        self.db.refresh(pedido)
        self._ids_pedido.append(pedido.id_pedido)
        return pedido

    def _producto(self, nombre="Silla"):
        producto = Producto(
            nombre_producto=nombre,
            referencia_producto=f"REF-{_sufijo()}",
            precio_venta_producto=50000,
            estado_producto="activo",
            stock_producto=10,
        )
        self.db.add(producto)
        self.db.commit()
        self.db.refresh(producto)
        self._ids_producto.append(producto.id_producto)
        return producto

    def _detalle(self, pedido, producto):
        detalle = DetallePedido(
            id_pedido_d=pedido.id_pedido,
            id_producto_d=producto.id_producto,
            cantidad_detalle=1,
            precio_unitario_detalle=50000,
            subtotal_detalle=50000,
        )
        self.db.add(detalle)
        self.db.commit()
        self.db.refresh(detalle)
        self._ids_detalle.append(detalle.id_detalle)
        return detalle

    def _calificacion_producto(self, cliente, pedido, producto, valor=5):
        fila = CalificacionProducto(
            id_cliente_cp=cliente.id_cliente,
            id_pedido_cp=pedido.id_pedido,
            id_producto_cp=producto.id_producto,
            calificacion=valor,
            comentario="Muy bueno",
        )
        self.db.add(fila)
        self.db.commit()
        self.db.refresh(fila)
        self._ids_calificacion_producto.append(fila.id_calificacion_producto)
        return fila

    # ── Calificaciones de citas ─────────────────────────────────────────────
    def test_crear_calificacion_finalizada_y_rechazar_duplicada(self):
        cliente = self._crear_cliente("califica")
        _tecnico_user, tecnico = self._crear_tecnico("califica")
        cita = self._cita(cliente, "Finalizada", tecnico)
        headers = self._headers_cliente(cliente)

        r = self._post(
            "/api/v1/calificaciones",
            headers=headers,
            json={"id_cita": cita.id_cita, "calificacion": 5, "comentario": "  Excelente  "},
        )
        self.assertEqual(r.status_code, 200, r.text)
        datos = r.json()
        self.assertEqual(datos["calificacion"], 5)
        self.assertEqual(datos["comentario"], "Excelente")
        self._ids_calificacion.append(datos["id_calificacion"])

        r2 = self._post(
            "/api/v1/calificaciones",
            headers=headers,
            json={"id_cita": cita.id_cita, "calificacion": 4},
        )
        self.assertEqual(r2.status_code, 400, r2.text)
        self.assertIn("Ya calificaste", r2.json()["detail"])

        # El comentario vacío se normaliza a None.
        cita2 = self._cita(cliente, "Finalizada", tecnico, dias=6)
        r3 = self._post(
            "/api/v1/calificaciones",
            headers=headers,
            json={"id_cita": cita2.id_cita, "calificacion": 1, "comentario": "   "},
        )
        self.assertEqual(r3.status_code, 200, r3.text)
        self.assertIsNone(r3.json()["comentario"])
        self._ids_calificacion.append(r3.json()["id_calificacion"])

    def test_crear_calificacion_valida_cita_ajena_estado_y_tecnico(self):
        cliente = self._crear_cliente("duena")
        otro = self._crear_cliente("ajena")
        _tu, tecnico = self._crear_tecnico("cita")
        headers = self._headers_cliente(cliente)

        # Cita inexistente.
        r = self._post(
            "/api/v1/calificaciones", headers=headers,
            json={"id_cita": 99999999, "calificacion": 3},
        )
        self.assertEqual(r.status_code, 404, r.text)
        # Cita de otro cliente: también 404 (no se filtra su existencia).
        ajena = self._cita(otro, "Finalizada", tecnico)
        r = self._post(
            "/api/v1/calificaciones", headers=headers,
            json={"id_cita": ajena.id_cita, "calificacion": 3},
        )
        self.assertEqual(r.status_code, 404, r.text)
        # Cita aún no finalizada.
        pendiente = self._cita(cliente, "Confirmada", tecnico, dias=7)
        r = self._post(
            "/api/v1/calificaciones", headers=headers,
            json={"id_cita": pendiente.id_cita, "calificacion": 3},
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIn("completada", r.json()["detail"])
        # Finalizada pero sin técnico asignado.
        sin_tecnico = self._cita(cliente, "Finalizada", None, dias=8)
        r = self._post(
            "/api/v1/calificaciones", headers=headers,
            json={"id_cita": sin_tecnico.id_cita, "calificacion": 3},
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIn("no tiene técnico", r.json()["detail"])
        # Valor fuera de rango: valida Pydantic.
        r = self._post(
            "/api/v1/calificaciones", headers=headers,
            json={"id_cita": sin_tecnico.id_cita, "calificacion": 6},
        )
        self.assertEqual(r.status_code, 422, r.text)

    def test_calificaciones_publicas_de_tecnico_y_404(self):
        cliente = self._crear_cliente("publico")
        _tu, tecnico = self._crear_tecnico("publico")
        cita = self._cita(cliente, "Finalizada", tecnico)
        headers = self._headers_cliente(cliente)
        r = self._post(
            "/api/v1/calificaciones", headers=headers,
            json={"id_cita": cita.id_cita, "calificacion": 4, "comentario": "Bien"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self._ids_calificacion.append(r.json()["id_calificacion"])

        r = self._get(f"/api/v1/calificaciones/tecnico/{tecnico.id_tecnico}")
        self.assertEqual(r.status_code, 200, r.text)
        datos = r.json()
        self.assertEqual(datos["id_tecnico"], tecnico.id_tecnico)
        self.assertEqual(datos["promedio"], 4.0)
        self.assertEqual(datos["total"], 1)
        self.assertEqual(datos["calificaciones"][0]["cliente"], "Cliente publico")
        self.assertEqual(datos["calificaciones"][0]["comentario"], "Bien")
        self.assertIsNotNone(datos["calificaciones"][0]["created_at"])

        r = self._get("/api/v1/calificaciones/tecnico/99999999")
        self.assertEqual(r.status_code, 404, r.text)

    def test_mis_calificaciones_y_estado_por_cita(self):
        cliente = self._crear_cliente("misdadas")
        _tu, tecnico = self._crear_tecnico("misdadas")
        cita = self._cita(cliente, "Finalizada", tecnico)
        headers = self._headers_cliente(cliente)

        # Sin reseñas: lista vacía y estado no calificado.
        self.assertEqual(self._get("/api/v1/calificaciones/mis-dadas", headers=headers).json(), [])
        r = self._get(f"/api/v1/calificaciones/cita/{cita.id_cita}", headers=headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json(), {"calificada": False, "calificacion": None, "comentario": None})

        r = self._post(
            "/api/v1/calificaciones", headers=headers,
            json={"id_cita": cita.id_cita, "calificacion": 5, "comentario": "Genial"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self._ids_calificacion.append(r.json()["id_calificacion"])

        r = self._get("/api/v1/calificaciones/mis-dadas", headers=headers)
        self.assertEqual(r.status_code, 200, r.text)
        filas = r.json()
        self.assertEqual(len(filas), 1)
        self.assertEqual(filas[0]["nombre_tecnico"], "Usuario misdadas")
        self.assertEqual(filas[0]["tipo_servicio"], "mantenimiento")
        self.assertEqual(filas[0]["id_cita"], cita.id_cita)
        self.assertEqual(filas[0]["fecha_cita"], cita.fecha.isoformat())
        self.assertEqual(filas[0]["hora_cita"], "09:00")

        r = self._get(f"/api/v1/calificaciones/cita/{cita.id_cita}", headers=headers)
        self.assertEqual(
            r.json(), {"calificada": True, "calificacion": 5, "comentario": "Genial"}
        )
        # Cita ajena: 404.
        otro = self._crear_cliente("ajena2")
        ajena = self._cita(otro, "Finalizada", tecnico)
        r = self._get(f"/api/v1/calificaciones/cita/{ajena.id_cita}", headers=headers)
        self.assertEqual(r.status_code, 404, r.text)

    def test_calificacion_pendiente_antes_y_despues_de_calificar(self):
        cliente = self._crear_cliente("pendiente")
        _tu, tecnico = self._crear_tecnico("pendiente")
        headers = self._headers_cliente(cliente)

        r = self._get("/api/v1/calificaciones/pendiente", headers=headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json(), {"pendiente": False})

        cita = self._cita(cliente, "Finalizada", tecnico)
        r = self._get("/api/v1/calificaciones/pendiente", headers=headers)
        self.assertEqual(r.status_code, 200, r.text)
        datos = r.json()
        self.assertTrue(datos["pendiente"])
        self.assertEqual(datos["id_cita"], cita.id_cita)
        self.assertEqual(datos["tecnico_nombre"], "Usuario pendiente")
        self.assertEqual(datos["id_tecnico"], tecnico.id_tecnico)

        r = self._post(
            "/api/v1/calificaciones", headers=headers,
            json={"id_cita": cita.id_cita, "calificacion": 3},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self._ids_calificacion.append(r.json()["id_calificacion"])
        self.assertFalse(
            self._get("/api/v1/calificaciones/pendiente", headers=headers).json()["pendiente"]
        )

    def test_mis_calificaciones_del_tecnico_autenticado(self):
        cliente = self._crear_cliente("recibe")
        tecnico_user, tecnico = self._crear_tecnico("recibe")
        cita = self._cita(cliente, "Finalizada", tecnico)
        headers_cliente = self._headers_cliente(cliente)
        r = self._post(
            "/api/v1/calificaciones", headers=headers_cliente,
            json={"id_cita": cita.id_cita, "calificacion": 5},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self._ids_calificacion.append(r.json()["id_calificacion"])

        r = self._login(tecnico_user.email)
        self.assertEqual(r.status_code, 200, r.text)
        headers_tecnico = self._bearer(self._token(r))
        r = self._get("/api/v1/calificaciones/mis", headers=headers_tecnico)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["total"], 1)

        # Un administrador sin ficha de técnico recibe 404.
        admin = self._crear_admin("sincalif")
        r = self._login(admin.email)
        headers_admin = self._bearer(self._token(r))
        r = self._get("/api/v1/calificaciones/mis", headers=headers_admin)
        self.assertEqual(r.status_code, 404, r.text)

    # ── Calificaciones de productos ─────────────────────────────────────────
    def test_calificar_producto_reglas_y_consultas(self):
        cliente = self._crear_cliente("prod")
        otro = self._crear_cliente("prodajeno")
        pedido = self._pedido(cliente)
        producto = self._producto("Mesa")
        self._detalle(pedido, producto)
        headers = self._headers_cliente(cliente)

        # Producto que no pertenece al pedido.
        ajeno = self._producto("Silla ajena")
        r = self._post(
            "/api/v1/calificaciones/producto", headers=headers,
            json={"id_pedido": pedido.id_pedido, "id_producto": ajeno.id_producto, "calificacion": 4},
        )
        self.assertEqual(r.status_code, 400, r.text)
        # Pedido inexistente / de otro cliente.
        r = self._post(
            "/api/v1/calificaciones/producto", headers=headers,
            json={"id_pedido": 99999999, "id_producto": producto.id_producto, "calificacion": 4},
        )
        self.assertEqual(r.status_code, 404, r.text)
        pedido_ajeno = self._pedido(otro)
        r = self._post(
            "/api/v1/calificaciones/producto", headers=headers,
            json={"id_pedido": pedido_ajeno.id_pedido, "id_producto": producto.id_producto, "calificacion": 4},
        )
        self.assertEqual(r.status_code, 404, r.text)
        # Pedido no entregado.
        sin_entregar = self._pedido(cliente, estado_entrega="Pendiente")
        self._detalle(sin_entregar, producto)
        r = self._post(
            "/api/v1/calificaciones/producto", headers=headers,
            json={"id_pedido": sin_entregar.id_pedido, "id_producto": producto.id_producto, "calificacion": 4},
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIn("entregados", r.json()["detail"])

        # Alta correcta y duplicado.
        r = self._post(
            "/api/v1/calificaciones/producto", headers=headers,
            json={"id_pedido": pedido.id_pedido, "id_producto": producto.id_producto,
                  "calificacion": 4, "comentario": "  Cómoda  "},
        )
        self.assertEqual(r.status_code, 200, r.text)
        datos = r.json()
        self.assertEqual(datos["nombre_producto"], "Mesa")
        self.assertEqual(datos["comentario"], "Cómoda")
        self.assertIsNotNone(datos["created_at"])
        self._ids_calificacion_producto.append(datos["id_calificacion_producto"])
        r = self._post(
            "/api/v1/calificaciones/producto", headers=headers,
            json={"id_pedido": pedido.id_pedido, "id_producto": producto.id_producto, "calificacion": 2},
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIn("Ya calificaste", r.json()["detail"])

        # Consultas de mis calificaciones.
        r = self._get(f"/api/v1/calificaciones/producto/pedido/{pedido.id_pedido}", headers=headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["estado_entrega"], "Entregado")
        self.assertEqual(len(r.json()["calificaciones"]), 1)
        self.assertEqual(r.json()["calificaciones"][0]["id_producto"], producto.id_producto)
        r = self._get("/api/v1/calificaciones/producto/mis-dadas", headers=headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()[0]["nombre_producto"], "Mesa")
        # Pedido ajeno: 404.
        r = self._get(
            f"/api/v1/calificaciones/producto/pedido/{pedido_ajeno.id_pedido}", headers=headers
        )
        self.assertEqual(r.status_code, 404, r.text)

    def test_foto_de_calificacion_valida_estado_formato_tamano_y_guarda(self):
        cliente = self._crear_cliente("foto")
        pedido = self._pedido(cliente)
        producto = self._producto("Lámpara")
        self._detalle(pedido, producto)
        headers = self._headers_cliente(cliente)
        url = f"/api/v1/calificaciones/producto/{pedido.id_pedido}/{producto.id_producto}/foto"

        # Aún no existe la calificación.
        r = self._post(url, headers=headers, files={"file": ("foto.jpg", b"x", "image/jpeg")})
        self.assertEqual(r.status_code, 404, r.text)

        fila = self._calificacion_producto(cliente, pedido, producto)
        # Formato no permitido, archivo vacío y exceso de tamaño.
        r = self._post(url, headers=headers, files={"file": ("foto.gif", b"x", "image/gif")})
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIn("Formato", r.json()["detail"])
        r = self._post(url, headers=headers, files={"file": ("foto.png", b"", "image/png")})
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIn("vacío", r.json()["detail"])
        grande = b"x" * (5 * 1024 * 1024 + 1)
        r = self._post(url, headers=headers, files={"file": ("foto.png", grande, "image/png")})
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIn("5 MB", r.json()["detail"])

        # Subida correcta: MinIO se sustituye por un doble.
        with patch(
            "app.services.minio_service.subir_imagen",
            return_value="http://media/calificaciones_productos/foto.webp",
        ) as subir:
            r = self._post(url, headers=headers, files={"file": ("foto.webp", b"contenido", "image/webp")})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["foto_url"], "http://media/calificaciones_productos/foto.webp")
        self.assertEqual(subir.call_args.args[0], "calificaciones_productos")
        self.assertEqual(subir.call_args.args[2], b"contenido")
        self._resincronizar()
        actual = self.db.query(CalificacionProducto).filter(
            CalificacionProducto.id_calificacion_producto == fila.id_calificacion_producto
        ).first()
        self.assertEqual(actual.foto_url, "http://media/calificaciones_productos/foto.webp")


class EspecializacionesHttpTestCase(BaseT1TestCase):
    def setUp(self):
        super().setUp()
        self._ids_especializacion = []

    def tearDown(self):
        if self._ids_especializacion:
            for tabla in (tecnico_especializacion, producto_especializacion):
                self.db.execute(
                    tabla.delete().where(tabla.c.id_especializacion.in_(self._ids_especializacion))
                )
            self.db.query(Especializacion).filter(
                Especializacion.id_especializacion.in_(self._ids_especializacion)
            ).delete(synchronize_session=False)
        self.db.commit()
        super().tearDown()

    def _especializacion(self, nombre, activa=True, descripcion=None):
        esp = Especializacion(
            nombre=f"{nombre}-{_sufijo()}", descripcion=descripcion, activa=activa
        )
        self.db.add(esp)
        self.db.commit()
        self.db.refresh(esp)
        self._ids_especializacion.append(esp.id_especializacion)
        return esp

    def _headers_admin(self):
        admin = self._crear_admin("esp")
        r = self._login(admin.email)
        self.assertEqual(r.status_code, 200, r.text)
        return self._bearer(self._token(r))

    def test_listado_publico_filtra_activas_y_todas_incluye_inactivas(self):
        activa = self._especializacion("Activa", True)
        inactiva = self._especializacion("Inactiva", False)

        r = self._get("/api/v1/especializaciones")
        self.assertEqual(r.status_code, 200, r.text)
        nombres = {e["nombre"] for e in r.json()}
        self.assertIn(activa.nombre, nombres)
        self.assertNotIn(inactiva.nombre, nombres)
        # Los contadores existen y son enteros.
        fila = next(e for e in r.json() if e["nombre"] == activa.nombre)
        self.assertEqual(fila["tecnicos_count"], 0)
        self.assertEqual(fila["productos_count"], 0)

        r = self._get("/api/v1/especializaciones?todas=true")
        self.assertEqual(r.status_code, 200, r.text)
        nombres = {e["nombre"] for e in r.json()}
        self.assertIn(activa.nombre, nombres)
        self.assertIn(inactiva.nombre, nombres)

    def test_crear_exige_admin_y_valida_nombre_duplicado(self):
        _tu, _tecnico = self._crear_tecnico("esp")
        r = self._login(_tu.email)
        headers_tecnico = self._bearer(self._token(r))
        r = self._post(
            "/api/v1/especializaciones",
            headers=headers_tecnico,
            json={"nombre": "Prohibida"},
        )
        self.assertEqual(r.status_code, 403, r.text)

        headers = self._headers_admin()
        r = self._post("/api/v1/especializaciones", headers=headers, json={"nombre": "   "})
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIn("obligatorio", r.json()["detail"])

        nombre = f"Domótica-{_sufijo()}"
        r = self._post(
            "/api/v1/especializaciones",
            headers=headers,
            json={"nombre": f"  {nombre}  ", "descripcion": "Luces", "activa": True},
        )
        self.assertEqual(r.status_code, 200, r.text)
        datos = r.json()
        self.assertEqual(datos["nombre"], nombre)
        self.assertEqual(datos["descripcion"], "Luces")
        self.assertTrue(datos["activa"])
        self._ids_especializacion.append(datos["id_especializacion"])

        # Duplicado sin distinguir mayúsculas.
        r = self._post(
            "/api/v1/especializaciones", headers=headers, json={"nombre": nombre.upper()}
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIn("Ya existe", r.json()["detail"])

    def test_actualizar_especializacion_caminos(self):
        headers = self._headers_admin()
        esp = self._especializacion("Editar", True, "Antes")

        r = self._put(
            "/api/v1/especializaciones/99999999", headers=headers, json={"nombre": "X"}
        )
        self.assertEqual(r.status_code, 404, r.text)

        r = self._put(
            f"/api/v1/especializaciones/{esp.id_especializacion}",
            headers=headers, json={"nombre": "   "},
        )
        self.assertEqual(r.status_code, 400, r.text)

        otra = self._especializacion("Ocupada", True)
        r = self._put(
            f"/api/v1/especializaciones/{esp.id_especializacion}",
            headers=headers, json={"nombre": otra.nombre.upper()},
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIn("Ya existe", r.json()["detail"])

        nuevo = f"Renombrada-{_sufijo()}"
        r = self._put(
            f"/api/v1/especializaciones/{esp.id_especializacion}",
            headers=headers,
            json={"nombre": f" {nuevo} ", "descripcion": "Después", "activa": False},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(
            r.json(),
            {
                "id_especializacion": esp.id_especializacion,
                "nombre": nuevo,
                "descripcion": "Después",
                "activa": False,
                "tecnicos_count": 0,
                "productos_count": 0,
            },
        )

    def test_eliminar_especializacion_solo_si_no_esta_en_uso(self):
        headers = self._headers_admin()

        r = self._delete("/api/v1/especializaciones/99999999", headers=headers)
        self.assertEqual(r.status_code, 404, r.text)

        libre = self._especializacion("Libre", True)
        r = self._delete(f"/api/v1/especializaciones/{libre.id_especializacion}", headers=headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(
            r.json(),
            {"msg": "Especialización eliminada", "id": libre.id_especializacion},
        )

        en_uso = self._especializacion("EnUso", True)
        _usuario, tecnico = self._crear_tecnico("espuso")
        self.db.execute(
            tecnico_especializacion.insert().values(
                id_tecnico=tecnico.id_tecnico,
                id_especializacion=en_uso.id_especializacion,
            )
        )
        self.db.commit()
        r = self._delete(f"/api/v1/especializaciones/{en_uso.id_especializacion}", headers=headers)
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIn("1 técnico", r.json()["detail"])
        self.assertIn("Desactívala", r.json()["detail"])


if __name__ == "__main__":
    unittest.main()
