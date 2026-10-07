"""
Pruebas de los routers "secundarios" del backend Neodomus.

Cubre, con 1-4 pruebas por router, los siguientes módulos:

* Tarifas de servicio (listado público y edición admin).
* Notificaciones de plataforma (mías, no leídas, marcar leídas).
* Especializaciones (catálogo público + CRUD admin).
* Consultas de contacto (creación pública + gestión admin).
* Solicitudes de cuenta (cliente y empleado) del administrador.
* Devoluciones (elegibilidad, solicitudes, pipeline admin y endpoint legado).
* Reembolsos (solicitud del cliente, manual del admin, listados y reproceso).
* Novedades de técnicos (catálogos, permisos y hallazgo de columnas sin migrar).
* Reportes administrativos (permisos, rangos de fechas y periodos).

Se ejecuta contra la BD de pruebas con el login real de la API.
"""

from datetime import date, datetime, timedelta
from io import BytesIO

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy.exc import OperationalError

from app.models.contacto import Contacto
from app.models.especializacion import (
    Especializacion,
    Reembolso,
    tecnico_especializacion,
)
from app.models.notificacion import Notificacion
from app.models.pago import Pago
from app.models.pedido import DetallePedido, Pedido
from app.models.solicitud_cuenta import SolicitudCuenta
from app.models.solicitud_habilitacion_empleado import SolicitudHabilitacionEmpleado
from app.models.tarifa_servicio import TarifaServicio
from app.tests.factories import (
    auth_headers,
    crear_cliente,
    crear_empleado,
    crear_producto,
    crear_tecnico,
    login,
)


# ──────────────────────────────────────────────────────────────
# Helpers locales
# ──────────────────────────────────────────────────────────────
async def _admin_logueado(client: AsyncClient, db, n: int = 1):
    """Administrador creado con email único + tokens reales."""
    usuario = crear_empleado(
        db, rol="administrador", email=f"otros.admin{n}@test.neodomus.com"
    )
    tokens = await login(client, usuario.email, "Test1234!", "employee")
    return usuario, tokens


async def _tecnico_logueado(client: AsyncClient, db, n: int = 1):
    """Técnico (empleado + ficha) con email único + tokens reales.

    Se evita el fixture `tecnico_logueado` cuando en el mismo test también
    se usa `admin_logueado`: ambos fijan el mismo email por defecto y
    colisionan en el índice UNIQUE.
    """
    usuario = crear_empleado(
        db, rol="tecnico", email=f"otros.tecnico{n}@test.neodomus.com"
    )
    ficha = crear_tecnico(db, usuario=usuario)
    tokens = await login(client, usuario.email, "Test1234!", "employee")
    return usuario, ficha, tokens


def _otro_cliente(db, n: int = 1):
    """Segundo cliente con email/documento únicos (evita la colisión del
    email UNIQUE con el cliente del fixture `cliente_logueado`)."""
    return crear_cliente(
        db,
        first_name=f"Otro{n}",
        last_name="Cliente",
        email=f"otros.cliente{n}@test.neodomus.com",
        documento_cliente=6000000000 + n,
    )


def _tarifa(db, tipo_servicio: str = "instalacion", costo: float = 120000.0,
            descripcion: str | None = "Tarifa de prueba") -> TarifaServicio:
    tarifa = TarifaServicio(
        tipo_servicio=tipo_servicio, costo=costo, descripcion=descripcion
    )
    db.add(tarifa)
    db.commit()
    db.refresh(tarifa)
    db.commit()
    return tarifa


def _cita(db, cliente, **kw):
    from app.models.cita import Cita

    datos = dict(
        id_cliente=cliente.id_cliente,
        tipo_servicio="instalacion",
        fecha=date.today() - timedelta(days=7),
        hora="09:00",
        direccion="Cra 10 #12-34",
        estado="Cancelada",
        costo_cita=100000.0,
        metodo_pago="paypal",
        estado_pago="aprobado",
        numero_transaccion="TX-CITA-0001",
    )
    datos.update(kw)
    cita = Cita(**datos)
    db.add(cita)
    db.commit()
    db.refresh(cita)
    db.commit()
    return cita


def _pedido_con_producto(db, cliente, producto, cantidad: int = 1, **kw) -> Pedido:
    """Pedido con el producto en su detalle (por defecto Entregado)."""
    datos = dict(
        id_cliente_pe=cliente.id_cliente,
        fecha_peedido=datetime.now(),
        total_pedido=producto.precio_venta_producto * cantidad,
        estado_pedido="Pagado",
        estado_entrega="Entregado",
    )
    datos.update(kw)
    pedido = Pedido(**datos)
    db.add(pedido)
    db.flush()
    db.add(
        DetallePedido(
            id_pedido_d=pedido.id_pedido,
            id_producto_d=producto.id_producto,
            cantidad_detalle=cantidad,
            precio_unitario_detalle=producto.precio_venta_producto,
            subtotal_detalle=producto.precio_venta_producto * cantidad,
        )
    )
    db.commit()
    db.refresh(pedido)
    db.commit()
    return pedido


def _pago(db, pedido, monto: float = 50000.0, estado: str = "aprobado") -> Pago:
    pago = Pago(
        id_pedido=pedido.id_pedido,
        metodo_pago="tarjeta_credito",
        estado=estado,
        numero_transaccion="TX-PED-0001",
        monto=monto,
    )
    db.add(pago)
    db.commit()
    db.refresh(pago)
    db.commit()
    return pago


def _png_bytes(color: str = "red") -> bytes:
    """PNG válido de 8x8 píxeles (los endpoints validan con PIL.verify)."""
    buffer = BytesIO()
    Image.new("RGB", (8, 8), color).save(buffer, format="PNG")
    return buffer.getvalue()


# ──────────────────────────────────────────────────────────────
# Tarifas de servicio
# ──────────────────────────────────────────────────────────────
async def test_tarifas_listado_publico(client: AsyncClient, db, cliente_logueado):
    """GET /tarifas es público: responde sin credenciales y con cliente."""
    _cliente, tokens_cliente = cliente_logueado
    _tarifa(db, "instalacion", 120000.0, "Costo base de instalación")

    # Sin credenciales (se limpian las cookies que dejó el login del fixture).
    client.cookies.clear()
    resp = await client.get("/api/v1/tarifas")
    assert resp.status_code == 200
    filas = resp.json()
    assert isinstance(filas, list)
    fila = next(f for f in filas if f["tipo_servicio"] == "instalacion")
    assert fila["costo"] == 120000
    assert fila["descripcion"] == "Costo base de instalación"

    # El cliente autenticado también puede consultarlo.
    resp = await client.get("/api/v1/tarifas", headers=auth_headers(tokens_cliente))
    assert resp.status_code == 200


async def test_tarifas_actualizar_admin(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """PUT /tarifas/{tipo}: solo admin edita; valida costo, existencia y 422."""
    _cliente, tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    _u, _f, tokens_tecnico = await _tecnico_logueado(client, db)
    tarifa = _tarifa(db, "mantenimiento", 80000.0)
    ruta = f"/api/v1/tarifas/{tarifa.tipo_servicio}"

    # Sin credenciales → 401.
    client.cookies.clear()
    resp = await client.put(ruta, json={"costo": 90000})
    assert resp.status_code == 401

    # Cliente → 401 (cuenta de cliente en endpoint de empleado).
    resp = await client.put(
        ruta, json={"costo": 90000}, headers=auth_headers(tokens_cliente)
    )
    assert resp.status_code == 401

    # Técnico → 403 (empleado sin rol administrador).
    resp = await client.put(
        ruta, json={"costo": 90000}, headers=auth_headers(tokens_tecnico)
    )
    assert resp.status_code == 403

    # Admin → 200 y el cambio queda en BD.
    resp = await client.put(
        ruta,
        json={"costo": 95000.5, "descripcion": "Precio de temporada"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["costo"] == 95000.5
    assert data["descripcion"] == "Precio de temporada"
    db.refresh(tarifa)
    assert float(tarifa.costo) == 95000.5

    # Costo no positivo → 400.
    resp = await client.put(
        ruta, json={"costo": 0}, headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 400

    # Servicio inexistente → 404.
    resp = await client.put(
        "/api/v1/tarifas/noexiste",
        json={"costo": 1000},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 404

    # Sin costo (campo obligatorio) → 422.
    resp = await client.put(ruta, json={}, headers=auth_headers(tokens_admin))
    assert resp.status_code == 422


# ──────────────────────────────────────────────────────────────
# Notificaciones de plataforma
# ──────────────────────────────────────────────────────────────
async def test_notificaciones_mias_cliente(
    client: AsyncClient, db, cliente_logueado
):
    """GET /notificaciones/mias solo devuelve las propias del cliente."""
    cliente, tokens = cliente_logueado
    otro = _otro_cliente(db)
    db.add_all(
        [
            Notificacion(
                id_cliente=cliente.id_cliente,
                tipo="entrega",
                titulo="Pedido en camino",
                mensaje="Tu pedido salió a distribución.",
            ),
            Notificacion(
                id_cliente=cliente.id_cliente,
                tipo="sistema",
                titulo="Bienvenida",
                mensaje="Gracias por comprar en Neodomus.",
            ),
            Notificacion(
                id_cliente=otro.id_cliente,
                tipo="sistema",
                titulo="Ajena",
                mensaje="No debería verse en esta cuenta.",
            ),
        ]
    )
    db.commit()

    # Sin credenciales → 401.
    client.cookies.clear()
    resp = await client.get("/api/v1/notificaciones/mias")
    assert resp.status_code == 401

    resp = await client.get(
        "/api/v1/notificaciones/mias", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    titulos = {n["titulo"] for n in resp.json()}
    assert titulos == {"Pedido en camino", "Bienvenida"}

    resp = await client.get(
        "/api/v1/notificaciones/no-leidas", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    assert resp.json() == {"no_leidas": 2}


async def test_notificaciones_mias_empleado(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """El empleado ve las notificaciones con id_usuario (no las de cliente)."""
    cliente, _tokens_cliente = cliente_logueado
    admin, tokens_admin = admin_logueado
    db.add_all(
        [
            Notificacion(
                id_usuario=admin.id_usuario,
                tipo="novedad",
                titulo="Nueva novedad",
                mensaje="Un técnico reportó un retraso.",
            ),
            Notificacion(
                id_cliente=cliente.id_cliente,
                tipo="entrega",
                titulo="Para el cliente",
                mensaje="No corresponde al empleado.",
            ),
        ]
    )
    db.commit()

    resp = await client.get(
        "/api/v1/notificaciones/mias", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 200
    filas = resp.json()
    assert len(filas) == 1
    assert filas[0]["titulo"] == "Nueva novedad"
    assert filas[0]["leida"] is False
    assert filas[0]["fecha_creacion"]

    resp = await client.get(
        "/api/v1/notificaciones/no-leidas", headers=auth_headers(tokens_admin)
    )
    assert resp.json() == {"no_leidas": 1}


async def test_notificaciones_marcar_leidas(client: AsyncClient, db, cliente_logueado):
    """PATCH /{id}/leida solo afecta notificaciones propias; /leer-todas masiva."""
    cliente, tokens = cliente_logueado
    otro = _otro_cliente(db)
    n1 = Notificacion(
        id_cliente=cliente.id_cliente,
        tipo="sistema",
        titulo="Primera",
        mensaje="Mensaje uno.",
    )
    n2 = Notificacion(
        id_cliente=cliente.id_cliente,
        tipo="sistema",
        titulo="Segunda",
        mensaje="Mensaje dos.",
    )
    ajena = Notificacion(
        id_cliente=otro.id_cliente,
        tipo="sistema",
        titulo="Ajena",
        mensaje="De otro cliente.",
    )
    db.add_all([n1, n2, ajena])
    db.commit()

    # Notificación de otro cliente → 404; inexistente → 404.
    resp = await client.patch(
        f"/api/v1/notificaciones/{ajena.id_notificacion}/leida",
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404

    resp = await client.patch(
        "/api/v1/notificaciones/999999/leida", headers=auth_headers(tokens)
    )
    assert resp.status_code == 404

    # Propia → 200 y queda leída.
    resp = await client.patch(
        f"/api/v1/notificaciones/{n1.id_notificacion}/leida",
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    db.refresh(n1)
    assert bool(n1.leida) is True

    resp = await client.get(
        "/api/v1/notificaciones/no-leidas", headers=auth_headers(tokens)
    )
    assert resp.json() == {"no_leidas": 1}

    # Marcar todas → solo cuenta las del usuario autenticado.
    resp = await client.patch(
        "/api/v1/notificaciones/leer-todas", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    assert resp.json()["actualizadas"] == 1

    resp = await client.get(
        "/api/v1/notificaciones/no-leidas", headers=auth_headers(tokens)
    )
    assert resp.json() == {"no_leidas": 0}


# ──────────────────────────────────────────────────────────────
# Especializaciones
# ──────────────────────────────────────────────────────────────
async def test_especializaciones_listado_publico(client: AsyncClient, db):
    """GET /especializaciones es público: solo activas; ?todas=true las incluye."""
    activa = Especializacion(nombre="Domótica básica", descripcion="Luces y sensores", activa=True)
    inactiva = Especializacion(nombre="Iluminación oculta", descripcion=None, activa=False)
    db.add_all([activa, inactiva])
    db.commit()
    db.refresh(activa)
    db.refresh(inactiva)
    db.commit()

    client.cookies.clear()
    resp = await client.get("/api/v1/especializaciones")
    assert resp.status_code == 200
    nombres = {e["nombre"] for e in resp.json()}
    assert "Domótica básica" in nombres
    assert "Iluminación oculta" not in nombres

    # HALLAZGO: el docstring dice que `todas=true` "requiere autenticación de
    # empleado", pero el endpoint no tiene ninguna dependencia de auth y
    # responde 200 también sin credenciales.
    resp = await client.get("/api/v1/especializaciones", params={"todas": "true"})
    assert resp.status_code == 200
    nombres = {e["nombre"] for e in resp.json()}
    assert "Iluminación oculta" in nombres

    # Los campos calculados de la serialización responden con ceros.
    fila = next(e for e in resp.json() if e["id_especializacion"] == activa.id_especializacion)
    assert fila["tecnicos_count"] == 0
    assert fila["productos_count"] == 0
    assert fila["activa"] is True


async def test_especializaciones_crear_admin(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """POST /especializaciones: solo admin; valida duplicados y nombre vacío."""
    _cliente, tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    _u, _f, tokens_tecnico = await _tecnico_logueado(client, db)
    cuerpo = {"nombre": "Climatización", "descripcion": "Aires y ductos"}

    client.cookies.clear()
    resp = await client.post("/api/v1/especializaciones", json=cuerpo)
    assert resp.status_code == 401

    resp = await client.post(
        "/api/v1/especializaciones", json=cuerpo, headers=auth_headers(tokens_cliente)
    )
    assert resp.status_code == 401

    resp = await client.post(
        "/api/v1/especializaciones", json=cuerpo, headers=auth_headers(tokens_tecnico)
    )
    assert resp.status_code == 403

    resp = await client.post(
        "/api/v1/especializaciones", json=cuerpo, headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["nombre"] == "Climatización"
    assert data["activa"] is True

    # Duplicada (ignorando mayúsculas) → 400.
    resp = await client.post(
        "/api/v1/especializaciones",
        json={"nombre": "climatización"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400

    # Nombre en blanco → 400.
    resp = await client.post(
        "/api/v1/especializaciones",
        json={"nombre": "   "},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400

    # Sin nombre (obligatorio) → 422.
    resp = await client.post(
        "/api/v1/especializaciones", json={}, headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 422


async def test_especializaciones_actualizar_admin(
    client: AsyncClient, db, admin_logueado
):
    """PUT /especializaciones/{id}: 200 con cambios; 404 y 400 en reglas."""
    _admin, tokens_admin = admin_logueado
    esp = Especializacion(nombre="Seguridad", descripcion="Cámaras", activa=True)
    otra = Especializacion(nombre="Riego automático", activa=True)
    db.add_all([esp, otra])
    db.commit()
    db.refresh(esp)
    db.commit()

    resp = await client.put(
        f"/api/v1/especializaciones/{esp.id_especializacion}",
        json={"nombre": "Cámaras y seguridad", "activa": False},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["nombre"] == "Cámaras y seguridad"
    assert data["activa"] is False
    assert data["descripcion"] == "Cámaras"

    # Cuerpo vacío: no modifica nada (todos los campos son opcionales).
    resp = await client.put(
        f"/api/v1/especializaciones/{esp.id_especializacion}",
        json={},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200
    assert resp.json()["nombre"] == "Cámaras y seguridad"

    # Nombre en blanco → 400.
    resp = await client.put(
        f"/api/v1/especializaciones/{esp.id_especializacion}",
        json={"nombre": " "},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400

    # Duplicada con otra especialización → 400.
    resp = await client.put(
        f"/api/v1/especializaciones/{esp.id_especializacion}",
        json={"nombre": otra.nombre},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400

    # Inexistente → 404.
    resp = await client.put(
        "/api/v1/especializaciones/999999",
        json={"nombre": "Nada"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 404


async def test_especializaciones_eliminar_admin(
    client: AsyncClient, db, admin_logueado
):
    """DELETE: elimina si no está en uso; 400 si tiene técnicos asociados."""
    _admin, tokens_admin = admin_logueado
    libre = Especializacion(nombre="Audio y video", activa=True)
    en_uso = Especializacion(nombre="Paneles solares", activa=True)
    db.add_all([libre, en_uso])
    db.commit()
    db.refresh(libre)
    db.refresh(en_uso)

    # Se asocia un técnico real para forzar el caso "en uso".
    usuario = crear_empleado(
        db, rol="tecnico", email="especializaciones.tecnico@test.neodomus.com"
    )
    ficha = crear_tecnico(db, usuario=usuario)
    db.execute(
        tecnico_especializacion.insert().values(
            id_tecnico=ficha.id_tecnico,
            id_especializacion=en_uso.id_especializacion,
        )
    )
    db.commit()

    # La que no está en uso se elimina.
    resp = await client.delete(
        f"/api/v1/especializaciones/{libre.id_especializacion}",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == libre.id_especializacion
    assert (
        db.query(Especializacion)
        .filter(Especializacion.id_especializacion == libre.id_especializacion)
        .first()
        is None
    )

    # La que tiene técnicos asociados no se elimina.
    resp = await client.delete(
        f"/api/v1/especializaciones/{en_uso.id_especializacion}",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400
    assert "No se puede eliminar" in resp.json()["detail"]

    # Inexistente → 404.
    resp = await client.delete(
        "/api/v1/especializaciones/999999", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────
# Consultas de contacto
# ──────────────────────────────────────────────────────────────
async def test_contacto_crear_publico(client: AsyncClient, db):
    """POST /contacto es público: crea la consulta como 'pendiente'."""
    client.cookies.clear()
    resp = await client.post(
        "/api/v1/contacto",
        json={
            "nombre": "Ana Pérez",
            "email": "ana@ejemplo.com",
            "asunto": "Duda con mi pedido",
            "mensaje": "¿Cuánto demora la instalación?",
            "categoria": "Pedido",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id"]
    assert "Consulta enviada" in data["msg"]

    fila = db.query(Contacto).filter(Contacto.id == data["id"]).first()
    assert fila is not None
    assert fila.estado == "pendiente"
    assert fila.categoria == "pedido"  # se normaliza a minúsculas
    assert fila.email_usuario == "ana@ejemplo.com"

    # Categoría fuera del catálogo → 400.
    resp = await client.post(
        "/api/v1/contacto",
        json={
            "nombre": "Ana Pérez",
            "email": "ana@ejemplo.com",
            "asunto": "Otra consulta",
            "mensaje": "Segundo mensaje de prueba",
            "categoria": "no-existe",
        },
    )
    assert resp.status_code == 400

    # Validaciones del esquema → 422 (email, asunto y mensaje).
    base = {
        "nombre": "Ana Pérez",
        "email": "ana@ejemplo.com",
        "asunto": "Consulta válida",
        "mensaje": "Mensaje de al menos cinco caracteres",
    }
    for cambio in ({"email": "no-es-correo"}, {"asunto": "ab"}, {"mensaje": "hola"}):
        cuerpo = dict(base)
        cuerpo.update(cambio)
        resp = await client.post("/api/v1/contacto", json=cuerpo)
        assert resp.status_code == 422, (cambio, resp.status_code)

    resp = await client.post("/api/v1/contacto", json={})
    assert resp.status_code == 422


async def test_consultas_admin_listado(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """GET /admin/consultas: solo admin; filtra por estado y categoría."""
    _cliente, tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    _u, _f, tokens_tecnico = await _tecnico_logueado(client, db)
    consulta = Contacto(
        nombre_usuario="Cliente Prueba",
        email_usuario="cliente@ejemplo.com",
        asunto="No llega mi pedido",
        mensaje="Lleva dos semanas en tránsito.",
        categoria="pedido",
        estado="pendiente",
    )
    db.add(consulta)
    db.commit()
    db.refresh(consulta)
    db.commit()

    client.cookies.clear()
    resp = await client.get("/api/v1/admin/consultas")
    assert resp.status_code == 401

    resp = await client.get(
        "/api/v1/admin/consultas", headers=auth_headers(tokens_cliente)
    )
    assert resp.status_code == 401

    resp = await client.get(
        "/api/v1/admin/consultas", headers=auth_headers(tokens_tecnico)
    )
    assert resp.status_code == 403

    resp = await client.get(
        "/api/v1/admin/consultas", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 200
    filas = resp.json()
    assert any(f["id"] == consulta.id for f in filas)
    assert filas[0]["estado"] in ("pendiente", "respondida")

    resp = await client.get(
        "/api/v1/admin/consultas",
        params={"estado": "respondida"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200
    assert resp.json() == []

    resp = await client.get(
        "/api/v1/admin/consultas",
        params={"categoria": "pedido"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200
    assert {f["id"] for f in resp.json()} == {consulta.id}


async def test_consultas_responder_admin(client: AsyncClient, db, admin_logueado):
    """PUT /admin/consultas/{id}: responde, valida estados y categorías."""
    _admin, tokens_admin = admin_logueado
    consulta = Contacto(
        nombre_usuario="María López",
        email_usuario="maria@ejemplo.com",
        asunto="Facturación",
        mensaje="Necesito la factura de enero.",
        categoria="pago",
        estado="pendiente",
    )
    db.add(consulta)
    db.commit()
    db.refresh(consulta)
    db.commit()

    resp = await client.put(
        f"/api/v1/admin/consultas/{consulta.id}",
        json={"estado": "respondida", "respuesta": "Te enviamos la factura."},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["estado"] == "respondida"
    assert data["respuesta"] == "Te enviamos la factura."
    assert data["responded_at"] is not None

    # Estado fuera del catálogo → 400.
    resp = await client.put(
        f"/api/v1/admin/consultas/{consulta.id}",
        json={"estado": "eliminada"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400

    # Categoría inválida → 400.
    resp = await client.put(
        f"/api/v1/admin/consultas/{consulta.id}",
        json={"categoria": "inexistente"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400

    # Volver a 'pendiente' limpia la marca de respuesta.
    resp = await client.put(
        f"/api/v1/admin/consultas/{consulta.id}",
        json={"estado": "pendiente"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200
    assert resp.json()["estado"] == "pendiente"
    assert resp.json()["responded_at"] is None

    # Consulta inexistente → 404.
    resp = await client.put(
        "/api/v1/admin/consultas/999999",
        json={"estado": "respondida"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────
# Solicitudes de cuenta (cliente y empleado)
# ──────────────────────────────────────────────────────────────
async def test_solicitudes_listar_admin(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """GET /admin/account-requests: solo admin y solo pendientes."""
    cliente, tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    _u, _f, tokens_tecnico = await _tecnico_logueado(client, db)
    solicitud = SolicitudCuenta(
        id_cliente=cliente.id_cliente,
        tipo="inhabilitar",
        estado="pendiente",
        motivo="No quiero seguir recibiendo correos.",
    )
    db.add(solicitud)
    db.commit()
    db.refresh(solicitud)
    db.commit()

    client.cookies.clear()
    resp = await client.get("/api/v1/admin/account-requests")
    assert resp.status_code == 401

    resp = await client.get(
        "/api/v1/admin/account-requests", headers=auth_headers(tokens_cliente)
    )
    assert resp.status_code == 401

    resp = await client.get(
        "/api/v1/admin/account-requests", headers=auth_headers(tokens_tecnico)
    )
    assert resp.status_code == 403

    resp = await client.get(
        "/api/v1/admin/account-requests", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 200
    filas = resp.json()
    assert len(filas) == 1
    assert filas[0]["id"] == solicitud.id
    assert filas[0]["tipo"] == "inhabilitar"
    assert filas[0]["cliente_email"] == cliente.email
    assert filas[0]["cliente_activo"] is True


async def test_solicitudes_aprobar_inhabilitar(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """Aprobar 'inhabilitar' desactiva la cuenta y elimina la solicitud."""
    cliente, _tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    solicitud = SolicitudCuenta(
        id_cliente=cliente.id_cliente,
        tipo="inhabilitar",
        estado="pendiente",
        motivo="Solicitud del cliente.",
    )
    db.add(solicitud)
    db.commit()
    db.refresh(solicitud)
    db.commit()
    id_solicitud = solicitud.id

    resp = await client.put(
        f"/api/v1/admin/account-requests/{id_solicitud}/aprobar",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["estado"] == "aprobada"
    assert data["cliente_activo"] is False
    assert data["resuelta_at"] is not None

    db.refresh(cliente)
    assert bool(cliente.is_active) is False

    # Al resolverse la solicitud se ELIMINA (por eso no aparece en listados).
    assert (
        db.query(SolicitudCuenta).filter(SolicitudCuenta.id == id_solicitud).first()
        is None
    )
    resp = await client.put(
        f"/api/v1/admin/account-requests/{id_solicitud}/aprobar",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 404

    # Una solicitud ya resuelta (si quedara) → 400.
    resuelta = SolicitudCuenta(
        id_cliente=cliente.id_cliente,
        tipo="habilitar",
        estado="aprobada",
        motivo="Ya resuelta.",
    )
    db.add(resuelta)
    db.commit()
    db.refresh(resuelta)
    db.commit()
    resp = await client.put(
        f"/api/v1/admin/account-requests/{resuelta.id}/aprobar",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400
    assert "ya fue resuelta" in resp.json()["detail"]


async def test_solicitudes_rechazar(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """Rechazar NO cambia el estado de la cuenta del cliente."""
    cliente, _tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    solicitud = SolicitudCuenta(
        id_cliente=cliente.id_cliente,
        tipo="inhabilitar",
        estado="pendiente",
        motivo="Motivo a rechazar.",
    )
    db.add(solicitud)
    db.commit()
    db.refresh(solicitud)
    db.commit()
    id_solicitud = solicitud.id

    resp = await client.put(
        f"/api/v1/admin/account-requests/{id_solicitud}/rechazar",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "rechazada"
    assert resp.json()["cliente_activo"] is True

    db.refresh(cliente)
    assert bool(cliente.is_active) is True
    assert (
        db.query(SolicitudCuenta).filter(SolicitudCuenta.id == id_solicitud).first()
        is None
    )

    resp = await client.put(
        "/api/v1/admin/account-requests/999999/rechazar",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 404

    resp = await client.put(
        "/api/v1/admin/account-requests/999999/aprobar",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 404


async def test_solicitudes_habilitar_cuenta(
    client: AsyncClient, db, admin_logueado
):
    """habilitar-cuenta activa cuentas inhabilitadas; 400 si ya está activa."""
    _admin, tokens_admin = admin_logueado
    inactivo = crear_cliente(
        db,
        first_name="Inactivo",
        last_name="Cliente",
        email="otros.inactivo@test.neodomus.com",
        documento_cliente=6100000001,
        is_active=False,
    )
    solicitud = SolicitudCuenta(
        id_cliente=inactivo.id_cliente,
        tipo="habilitar",
        estado="pendiente",
        motivo="Quiero volver a entrar.",
    )
    db.add(solicitud)
    db.commit()
    db.refresh(solicitud)
    db.commit()
    id_solicitud = solicitud.id

    assert bool(inactivo.is_active) is False
    resp = await client.put(
        f"/api/v1/admin/account-requests/{id_solicitud}/habilitar-cuenta",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "aprobada"
    assert resp.json()["cliente_activo"] is True

    db.refresh(inactivo)
    assert bool(inactivo.is_active) is True
    assert (
        db.query(SolicitudCuenta).filter(SolicitudCuenta.id == id_solicitud).first()
        is None
    )

    # Solicitud sobre una cuenta que YA está activa → 400.
    activo = crear_cliente(
        db,
        first_name="Activo",
        last_name="Cliente",
        email="otros.activo@test.neodomus.com",
        documento_cliente=6100000002,
    )
    otra = SolicitudCuenta(
        id_cliente=activo.id_cliente,
        tipo="habilitar",
        estado="pendiente",
        motivo="Sin cambios.",
    )
    db.add(otra)
    db.commit()
    db.refresh(otra)
    db.commit()
    resp = await client.put(
        f"/api/v1/admin/account-requests/{otra.id}/habilitar-cuenta",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400
    assert "ya está activa" in resp.json()["detail"]

    resp = await client.put(
        "/api/v1/admin/account-requests/999999/habilitar-cuenta",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 404


async def test_solicitudes_empleados(
    client: AsyncClient, db, admin_logueado
):
    """Solicitudes de habilitación de empleados: listar y aprobar (solo admin)."""
    _admin, tokens_admin = admin_logueado
    _u, _f, tokens_tecnico = await _tecnico_logueado(client, db)
    empleado = crear_empleado(
        db, rol="tecnico", is_active=False, email="solicitud.empleado@test.neodomus.com"
    )
    solicitud = SolicitudHabilitacionEmpleado(
        id_usuario=empleado.id_usuario, estado="pendiente"
    )
    db.add(solicitud)
    db.commit()
    db.refresh(solicitud)
    db.commit()
    id_solicitud = solicitud.id

    resp = await client.get(
        "/api/v1/admin/account-requests/empleados",
        headers=auth_headers(tokens_tecnico),
    )
    assert resp.status_code == 403

    resp = await client.get(
        "/api/v1/admin/account-requests/empleados",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200
    filas = resp.json()
    assert len(filas) == 1
    assert filas[0]["empleado_email"] == empleado.email
    assert filas[0]["empleado_activo"] is False
    assert filas[0]["empleado_rol"] == "tecnico"

    # Aprobar reactiva la cuenta del empleado y elimina la solicitud.
    resp = await client.put(
        f"/api/v1/admin/account-requests/empleados/{id_solicitud}/aprobar",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["empleado_activo"] is True

    db.refresh(empleado)
    assert bool(empleado.is_active) is True
    assert (
        db.query(SolicitudHabilitacionEmpleado)
        .filter(SolicitudHabilitacionEmpleado.id == id_solicitud)
        .first()
        is None
    )

    resp = await client.get(
        "/api/v1/admin/account-requests/empleados",
        headers=auth_headers(tokens_admin),
    )
    assert resp.json() == []

    resp = await client.put(
        "/api/v1/admin/account-requests/empleados/999999/aprobar",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────
# Devoluciones
# ──────────────────────────────────────────────────────────────
async def test_devoluciones_elegibilidad(
    client: AsyncClient, db, cliente_logueado
):
    """GET /devoluciones/elegibilidad/{id}: unidades disponibles y reglas."""
    cliente, tokens = cliente_logueado
    otro = _otro_cliente(db)
    producto = crear_producto(
        db, nombre_producto="Ventilador", referencia_producto="REF-OTROS-DV1"
    )
    entregado = _pedido_con_producto(db, cliente, producto, cantidad=2)
    pendiente = _pedido_con_producto(
        db, cliente, producto, cantidad=1, estado_entrega="En camino"
    )

    resp = await client.get(
        f"/api/v1/devoluciones/elegibilidad/{entregado.id_pedido}",
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["elegible"] is True
    assert data["razon"] is None
    assert data["pedido"]["estado_entrega"] == "Entregado"
    assert data["productos"][0]["cantidad_comprada"] == 2
    assert data["productos"][0]["cantidad_disponible"] == 2
    assert any(m["key"] == "defectuoso" for m in data["motivos"])

    # Pedido aún no entregado → elegible False con la razón de la regla.
    resp = await client.get(
        f"/api/v1/devoluciones/elegibilidad/{pendiente.id_pedido}",
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    assert resp.json()["elegible"] is False
    assert "entregado" in resp.json()["razon"]

    # Pedido de otro cliente → 404.
    ajeno = _pedido_con_producto(db, otro, producto, cantidad=1)
    resp = await client.get(
        f"/api/v1/devoluciones/elegibilidad/{ajeno.id_pedido}",
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404

    # Sin credenciales → 401.
    client.cookies.clear()
    resp = await client.get(
        f"/api/v1/devoluciones/elegibilidad/{entregado.id_pedido}"
    )
    assert resp.status_code == 401


async def test_devoluciones_crear_solicitud(
    client: AsyncClient, db, cliente_logueado
):
    """POST /devoluciones/solicitudes: valida motivo, cantidades y duplicados."""
    cliente, tokens = cliente_logueado
    otro = _otro_cliente(db)
    producto = crear_producto(
        db, nombre_producto="Abanico de pie", referencia_producto="REF-OTROS-DV2"
    )
    fuera = crear_producto(
        db, nombre_producto="Lámpara de mesa", referencia_producto="REF-OTROS-DV3"
    )
    pedido = _pedido_con_producto(db, cliente, producto, cantidad=1)
    pedido_ajeno = _pedido_con_producto(db, otro, producto, cantidad=1)

    def _cuerpo(items, motivo_tipo="defectuoso", **extra):
        cuerpo = {
            "id_pedido": pedido.id_pedido,
            "items": items,
            "motivo_tipo": motivo_tipo,
        }
        cuerpo.update(extra)
        return cuerpo

    # Producto que no está en el pedido → 400.
    resp = await client.post(
        "/api/v1/devoluciones/solicitudes",
        json=_cuerpo([{"id_producto": fuera.id_producto, "cantidad": 1}]),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "no pertenece" in resp.json()["detail"]

    # Motivo fuera del catálogo → 400.
    resp = await client.post(
        "/api/v1/devoluciones/solicitudes",
        json=_cuerpo(
            [{"id_producto": producto.id_producto, "cantidad": 1}],
            motivo_tipo="porque-si",
        ),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400

    # Motivo "otro" sin relatar el motivo → 400.
    resp = await client.post(
        "/api/v1/devoluciones/solicitudes",
        json=_cuerpo(
            [{"id_producto": producto.id_producto, "cantidad": 1}],
            motivo_tipo="otro",
        ),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400

    # Cantidad 0 → 422 (el esquema exige ge=1).
    resp = await client.post(
        "/api/v1/devoluciones/solicitudes",
        json=_cuerpo([{"id_producto": producto.id_producto, "cantidad": 0}]),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 422

    # HALLAZGO: un pedido ajeno lanza PermissionError que este endpoint NO
    # traduce a HTTP (solo captura ItemInvalido). El manejador genérico de
    # app/main.py lo convierte en un 500, mientras que GET /elegibilidad
    # devuelve 404 para el mismo caso. ServerErrorMiddleware relanza siempre
    # la excepción, por eso ASGITransport la devuelve a la prueba y hay que
    # esperarla con pytest.raises (en producción el cliente sí recibe 500).
    with pytest.raises(PermissionError):
        await client.post(
            "/api/v1/devoluciones/solicitudes",
            json={
                "id_pedido": pedido_ajeno.id_pedido,
                "items": [{"id_producto": producto.id_producto, "cantidad": 1}],
                "motivo_tipo": "defectuoso",
            },
            headers=auth_headers(tokens),
        )

    # Creación válida → 200 con número DEV- y estado Solicitada.
    resp = await client.post(
        "/api/v1/devoluciones/solicitudes",
        json=_cuerpo(
            [{"id_producto": producto.id_producto, "cantidad": 1}],
            comentario="Llegó dañado.",
        ),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["numero"].startswith("DEV-")
    assert data["estado"] == "Solicitada"
    assert data["tipo_devolucion"] == "total"
    assert data["motivo_label"] == "Producto defectuoso"
    assert len(data["items"]) == 1
    assert data["items"][0]["producto"] == "Abanico de pie"
    assert data["monto_total"] > 0

    # Segunda solicitud: las unidades quedaron comprometidas → 400.
    resp = await client.post(
        "/api/v1/devoluciones/solicitudes",
        json=_cuerpo([{"id_producto": producto.id_producto, "cantidad": 1}]),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "devolver" in resp.json()["detail"] or "devueltos" in resp.json()["detail"]


async def test_devoluciones_pipeline_admin(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """GET/PUT /devoluciones/admin/solicitudes: permisos y transiciones."""
    cliente, tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    _u, _f, tokens_tecnico = await _tecnico_logueado(client, db)
    producto = crear_producto(
        db, nombre_producto="Purificador", referencia_producto="REF-OTROS-DV4"
    )
    pedido = _pedido_con_producto(db, cliente, producto, cantidad=1)

    resp = await client.post(
        "/api/v1/devoluciones/solicitudes",
        json={
            "id_pedido": pedido.id_pedido,
            "items": [{"id_producto": producto.id_producto, "cantidad": 1}],
            "motivo_tipo": "danado",
        },
        headers=auth_headers(tokens_cliente),
    )
    assert resp.status_code == 200, resp.text
    id_solicitud = resp.json()["id_solicitud"]

    # Permisos: sin credenciales 401, cliente 401, técnico 403.
    client.cookies.clear()
    resp = await client.get("/api/v1/devoluciones/admin/solicitudes")
    assert resp.status_code == 401

    resp = await client.get(
        "/api/v1/devoluciones/admin/solicitudes", headers=auth_headers(tokens_cliente)
    )
    assert resp.status_code == 401

    resp = await client.get(
        "/api/v1/devoluciones/admin/solicitudes", headers=auth_headers(tokens_tecnico)
    )
    assert resp.status_code == 403

    resp = await client.get(
        "/api/v1/devoluciones/admin/solicitudes", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 200
    assert any(s["id_solicitud"] == id_solicitud for s in resp.json())

    ruta = f"/api/v1/devoluciones/admin/solicitudes/{id_solicitud}/estado"

    # Solicitada → En revisión (transición válida).
    resp = await client.put(
        ruta, json={"estado": "En revisión"}, headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "En revisión"

    # Transición no permitida (forward-only) → 400.
    resp = await client.put(
        ruta, json={"estado": "Reembolso procesado"}, headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 400
    assert "No puedes pasar" in resp.json()["detail"]

    # Rechazar exige motivo → 400 sin él.
    resp = await client.put(
        ruta, json={"estado": "Rechazada"}, headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 400
    assert "motivo" in resp.json()["detail"].lower()

    # Rechazar con motivo → 200.
    resp = await client.put(
        ruta,
        json={"estado": "Rechazada", "motivo_rechazo": "Fuera de garantía."},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "Rechazada"
    assert resp.json()["motivo_rechazo"] == "Fuera de garantía."

    # Filtro por estado del listado admin.
    resp = await client.get(
        "/api/v1/devoluciones/admin/solicitudes",
        params={"estado": "Rechazada"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200
    assert {s["id_solicitud"] for s in resp.json()} == {id_solicitud}

    # Cuerpo vacío → 400 "Nada que actualizar"; observaciones → 200.
    resp = await client.put(ruta, json={}, headers=auth_headers(tokens_admin))
    assert resp.status_code == 400

    resp = await client.put(
        ruta,
        json={"observaciones": "Revisado con el cliente."},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200
    assert resp.json()["observaciones_admin"] == "Revisado con el cliente."

    # Solicitud inexistente → 404.
    resp = await client.put(
        "/api/v1/devoluciones/admin/solicitudes/999999/estado",
        json={"estado": "En revisión"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 404


async def test_devoluciones_legado(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """Endpoint legado POST /devoluciones + listados propios y de admin."""
    cliente, tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    producto = crear_producto(
        db, nombre_producto="Termostato", referencia_producto="REF-OTROS-DV5"
    )
    pedido = _pedido_con_producto(db, cliente, producto, cantidad=1)
    cuerpo = {
        "id_pedido": pedido.id_pedido,
        "id_producto": producto.id_producto,
        "motivo": "No me sirve para mi casa.",
    }

    # Sin motivo no se puede crear (motivo_tipo="otro" lo exige) → 400.
    resp = await client.post(
        "/api/v1/devoluciones", json={**cuerpo, "motivo": "  "},
        headers=auth_headers(tokens_cliente),
    )
    assert resp.status_code == 400

    resp = await client.post(
        "/api/v1/devoluciones", json=cuerpo, headers=auth_headers(tokens_cliente)
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id_devolucion"]
    assert data["id_solicitud"]
    assert data["estado"] == "Pendiente"
    assert data["id_producto"] == producto.id_producto

    # Listados: del cliente (con token de cliente) y global (admin).
    resp = await client.get(
        "/api/v1/devoluciones/mias", headers=auth_headers(tokens_cliente)
    )
    assert resp.status_code == 200
    assert any(d["id_devolucion"] == data["id_devolucion"] for d in resp.json())

    resp = await client.get(
        "/api/v1/devoluciones/mias", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 401

    resp = await client.get(
        "/api/v1/devoluciones", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 200
    filas = resp.json()
    fila = next(d for d in filas if d["id_devolucion"] == data["id_devolucion"])
    assert fila["cliente"] == "Prueba Cliente"

    # Estado fuera de (Aprobada / Rechazada) → 400.
    resp = await client.put(
        f"/api/v1/devoluciones/{data['id_devolucion']}/estado",
        json={"estado": "Pendiente"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400

    # Al pertenecer a una solicitud, la decisión se aplica al pipeline completo.
    resp = await client.put(
        f"/api/v1/devoluciones/{data['id_devolucion']}/estado",
        json={"estado": "Rechazada"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["solicitud_estado"] == "Rechazada"

    # La línea ya quedó resuelta → 400.
    resp = await client.put(
        f"/api/v1/devoluciones/{data['id_devolucion']}/estado",
        json={"estado": "Aprobada", "resolucion": "Cambio"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400


# ──────────────────────────────────────────────────────────────
# Reembolsos
# ──────────────────────────────────────────────────────────────
async def test_reembolsos_solicitar_pedido(
    client: AsyncClient, db, cliente_logueado
):
    """POST /reembolsos/pedido/{id}: solo el dueño y mientras no esté entregado."""
    cliente, tokens = cliente_logueado
    otro = _otro_cliente(db)
    producto = crear_producto(
        db, nombre_producto="Cafetera", referencia_producto="REF-OTROS-RM1"
    )
    pedido = _pedido_con_producto(
        db, cliente, producto, cantidad=1, estado_entrega=None
    )
    _pago(db, pedido, monto=50000.0)

    pedido_ajeno = _pedido_con_producto(
        db, otro, producto, cantidad=1, estado_entrega=None
    )
    _pago(db, pedido_ajeno, monto=30000.0)

    sin_pago = _pedido_con_producto(
        db, cliente, producto, cantidad=1, estado_entrega=None
    )
    entregado = _pedido_con_producto(db, cliente, producto, cantidad=1)
    _pago(db, entregado, monto=70000.0)

    # Sin credenciales → 401.
    client.cookies.clear()
    resp = await client.post(
        f"/api/v1/reembolsos/pedido/{pedido.id_pedido}", json={"motivo": "X"}
    )
    assert resp.status_code == 401

    # Pedido de otro cliente → 404.
    resp = await client.post(
        f"/api/v1/reembolsos/pedido/{pedido_ajeno.id_pedido}",
        json={"motivo": "No corresponde"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404

    # Pedido sin pago aprobado → 400.
    resp = await client.post(
        f"/api/v1/reembolsos/pedido/{sin_pago.id_pedido}",
        json={"motivo": "Sin pago"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "pago aprobado" in resp.json()["detail"]

    # Pedido ya entregado → 400 (el camino es la devolución).
    resp = await client.post(
        f"/api/v1/reembolsos/pedido/{entregado.id_pedido}",
        json={"motivo": "Entregado"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "entregado" in resp.json()["detail"]

    # Solicitud válida → 201 Pendiente por lo pagado.
    resp = await client.post(
        f"/api/v1/reembolsos/pedido/{pedido.id_pedido}",
        json={"motivo": "Comprado por error"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["estado"] == "Pendiente"
    assert data["monto"] == 50000
    assert data["tipo"] == "pedido"
    assert data["referencia"] == f"Pedido #{pedido.id_pedido}"

    # Duplicado → 400.
    resp = await client.post(
        f"/api/v1/reembolsos/pedido/{pedido.id_pedido}",
        json={"motivo": "Otra vez"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "Ya existe un reembolso" in resp.json()["detail"]


async def test_reembolsos_admin_manual(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """POST /reembolsos (admin): valida los ids y procesa con el simulador."""
    _cliente, tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    _u, _f, tokens_tecnico = await _tecnico_logueado(client, db)
    cliente = _otro_cliente(db)
    cita_ok = _cita(db, cliente)
    cita_no_cancelada = _cita(db, cliente, estado="Confirmada")

    # Sin credenciales / cliente / técnico → 401 / 401 / 403.
    client.cookies.clear()
    resp = await client.post("/api/v1/reembolsos", json={"id_cita": cita_ok.id_cita})
    assert resp.status_code == 401

    resp = await client.post(
        "/api/v1/reembolsos",
        json={"id_cita": cita_ok.id_cita},
        headers=auth_headers(tokens_cliente),
    )
    assert resp.status_code == 401

    resp = await client.post(
        "/api/v1/reembolsos",
        json={"id_cita": cita_ok.id_cita},
        headers=auth_headers(tokens_tecnico),
    )
    assert resp.status_code == 403

    # Ninguno de los dos ids (o ambos) → 400.
    resp = await client.post(
        "/api/v1/reembolsos", json={}, headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 400
    assert "exactamente uno" in resp.json()["detail"]

    resp = await client.post(
        "/api/v1/reembolsos",
        json={"id_cita": cita_ok.id_cita, "id_pedido": 1},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400

    # Sin cuerpo → 422 (el body es obligatorio).
    resp = await client.post(
        "/api/v1/reembolsos", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 422

    # Cita inexistente → 404; cita no cancelada → 400.
    resp = await client.post(
        "/api/v1/reembolsos",
        json={"id_cita": 999999},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 404

    resp = await client.post(
        "/api/v1/reembolsos",
        json={"id_cita": cita_no_cancelada.id_cita},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400

    # Creación válida → 201 y el simulador deja el reembolso procesado.
    resp = await client.post(
        "/api/v1/reembolsos",
        json={"id_cita": cita_ok.id_cita, "motivo": "Cita cancelada"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["tipo"] == "cita"
    assert data["monto"] == 100000
    assert data["estado"] == "Reembolsado"
    assert data["numero_transaccion_reembolso"].startswith("REB-")

    # Duplicado (el reembolso está activo) → 400.
    resp = await client.post(
        "/api/v1/reembolsos",
        json={"id_cita": cita_ok.id_cita},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400
    assert "Ya existe un reembolso" in resp.json()["detail"]


async def test_reembolsos_listados(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """GET /reembolsos (admin), /mis (cliente) y /elegibles (admin)."""
    cliente, tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    _u, _f, tokens_tecnico = await _tecnico_logueado(client, db)
    otro = _otro_cliente(db)
    producto = crear_producto(
        db, nombre_producto="Licuadora", referencia_producto="REF-OTROS-RM2"
    )

    pedido_mio = _pedido_con_producto(
        db, cliente, producto, cantidad=1, estado_entrega=None
    )
    pedido_ajeno = _pedido_con_producto(
        db, otro, producto, cantidad=1, estado_entrega=None
    )
    db.add_all(
        [
            Reembolso(
                id_pedido=pedido_mio.id_pedido,
                monto=50000,
                estado="Pendiente",
                motivo="Solicitado por el cliente",
            ),
            Reembolso(
                id_pedido=pedido_ajeno.id_pedido,
                monto=30000,
                estado="Reembolsado",
                motivo="De otro cliente",
            ),
        ]
    )
    db.commit()

    # Listado global: solo admin.
    client.cookies.clear()
    resp = await client.get("/api/v1/reembolsos")
    assert resp.status_code == 401

    resp = await client.get(
        "/api/v1/reembolsos", headers=auth_headers(tokens_tecnico)
    )
    assert resp.status_code == 403

    resp = await client.get(
        "/api/v1/reembolsos", headers=auth_headers(tokens_cliente)
    )
    assert resp.status_code == 401

    resp = await client.get("/api/v1/reembolsos", headers=auth_headers(tokens_admin))
    assert resp.status_code == 200
    filas = resp.json()
    assert len(filas) == 2
    assert {f["referencia"] for f in filas} == {
        f"Pedido #{pedido_mio.id_pedido}",
        f"Pedido #{pedido_ajeno.id_pedido}",
    }
    assert all(f["cliente_nombre"] for f in filas)

    # 'mis' solo devuelve los reembolsos del cliente autenticado.
    resp = await client.get(
        "/api/v1/reembolsos/mis", headers=auth_headers(tokens_cliente)
    )
    assert resp.status_code == 200
    mis = resp.json()
    assert len(mis) == 1
    assert mis[0]["id_pedido"] == pedido_mio.id_pedido

    # Elegibles: solo admin y siempre una lista.
    resp = await client.get(
        "/api/v1/reembolsos/elegibles", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_reembolsos_procesar(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """POST /reembolsos/{id}/procesar: reprocesa pendientes (solo admin)."""
    _cliente, tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    cliente = _otro_cliente(db)
    producto = crear_producto(
        db, nombre_producto="Batidora", referencia_producto="REF-OTROS-RM3"
    )
    pedido = _pedido_con_producto(
        db, cliente, producto, cantidad=1, estado_entrega=None
    )
    reembolso = Reembolso(
        id_pedido=pedido.id_pedido,
        monto=50000,
        estado="Pendiente",
        motivo="Pendiente de reproceso",
    )
    db.add(reembolso)
    db.commit()
    db.refresh(reembolso)
    db.commit()

    # Cliente no puede procesar → 401.
    resp = await client.post(
        f"/api/v1/reembolsos/{reembolso.id_reembolso}/procesar",
        json={},
        headers=auth_headers(tokens_cliente),
    )
    assert resp.status_code == 401

    resp = await client.post(
        f"/api/v1/reembolsos/{reembolso.id_reembolso}/procesar",
        json={},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["estado"] == "Reembolsado"
    assert data["numero_transaccion_reembolso"].startswith("REB-")
    assert data["procesado_at"] is not None

    # Reprocesar uno ya reembolsado → 400.
    resp = await client.post(
        f"/api/v1/reembolsos/{reembolso.id_reembolso}/procesar",
        json={},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400
    assert "ya está" in resp.json()["detail"]

    # Inexistente → 404.
    resp = await client.post(
        "/api/v1/reembolsos/999999/procesar",
        json={},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────
# Novedades de los técnicos
# ──────────────────────────────────────────────────────────────
async def test_novedades_catalogos_publicos(client: AsyncClient):
    """Los catálogos de novedades son públicos (tipos, estados, prioridades)."""
    client.cookies.clear()
    resp = await client.get("/api/v1/novedades/tipos")
    assert resp.status_code == 200
    assert "Retraso en entrega" in resp.json()

    resp = await client.get("/api/v1/novedades/estados")
    assert resp.status_code == 200
    assert "Pendiente" in resp.json()

    resp = await client.get("/api/v1/novedades/prioridades")
    assert resp.status_code == 200
    assert resp.json() == ["baja", "normal", "alta", "urgente"]


async def test_novedades_crear_tecnico(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """POST /novedades: solo técnicos y solo sobre sus pedidos/citas."""
    cliente, tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    _usuario, ficha, tokens_tecnico = await _tecnico_logueado(client, db)
    producto = crear_producto(
        db, nombre_producto="Microondas", referencia_producto="REF-OTROS-NV1"
    )
    mio = _pedido_con_producto(
        db, cliente, producto, cantidad=1, id_tecnico_entrega=ficha.id_tecnico
    )
    ajeno = _pedido_con_producto(
        db, cliente, producto, cantidad=1, id_tecnico_entrega=999
    )
    cuerpo = {
        "tipo_novedad": "Retraso en entrega",
        "descripcion": "El cliente no estaba en la dirección.",
        "prioridad": "alta",
        "id_pedido": mio.id_pedido,
    }

    # Cliente → 401; administrador → 403 (solo técnicos); sin credenciales → 401.
    resp = await client.post(
        "/api/v1/novedades", json=cuerpo, headers=auth_headers(tokens_cliente)
    )
    assert resp.status_code == 401

    resp = await client.post(
        "/api/v1/novedades", json=cuerpo, headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 403
    assert "técnicos" in resp.json()["detail"]

    client.cookies.clear()
    resp = await client.post("/api/v1/novedades", json=cuerpo)
    assert resp.status_code == 401

    # Tipo y prioridad fuera de catálogo → 400.
    resp = await client.post(
        "/api/v1/novedades",
        json={**cuerpo, "tipo_novedad": "Algo raro"},
        headers=auth_headers(tokens_tecnico),
    )
    assert resp.status_code == 400

    resp = await client.post(
        "/api/v1/novedades",
        json={**cuerpo, "prioridad": "critica"},
        headers=auth_headers(tokens_tecnico),
    )
    assert resp.status_code == 400

    # Pedido no asignado a este técnico → 403.
    resp = await client.post(
        "/api/v1/novedades",
        json={**cuerpo, "id_pedido": ajeno.id_pedido},
        headers=auth_headers(tokens_tecnico),
    )
    assert resp.status_code == 403
    assert "autorización" in resp.json()["detail"]

    # HALLAZGO: la creación válida NO puede completarse en ningún entorno.
    # El modelo (app/models/novedad.py) declara las columnas `cliente_visible`,
    # `solucion_cliente` y `mensaje_cliente`, pero ninguna migración de
    # Alembic (ni scripts/init_db.sql) las crea: el INSERT falla con MySQL
    # 1054 "Unknown column" y el manejador genérico de app/main.py responde
    # HTTP 500. ServerErrorMiddleware relanza la excepción, así que en la
    # suite se comprueba con pytest.raises.
    # Ver be/app/tests/hallazgos/pedidos_calificaciones_otros.md.
    with pytest.raises(OperationalError) as excinfo:
        resp = await client.post(
            "/api/v1/novedades", json=cuerpo, headers=auth_headers(tokens_tecnico)
        )
    assert "Unknown column" in str(excinfo.value)
    assert "mensaje_cliente" in str(excinfo.value)


async def test_novedades_listados_y_permisos(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """Permisos de los listados de novedades + hallazgo de columnas sin migrar.

    COMPORTAMIENTO ACTUAL: los permisos (401/403) se resuelven antes de
    tocar la tabla y responden bien, pero toda consulta a `novedades`
    falla con MySQL 1054 (columnas `cliente_visible`, `solucion_cliente`
    y `mensaje_cliente` del modelo sin migrar) → HTTP 500 en producción.
    """
    _cliente, tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    _usuario, _ficha, tokens_tecnico = await _tecnico_logueado(client, db)

    # Listado general: solo administradores (el técnico recibe 403 y el
    # cliente 401, porque su token no corresponde a una cuenta empleado).
    resp = await client.get(
        "/api/v1/novedades", headers=auth_headers(tokens_tecnico)
    )
    assert resp.status_code == 403
    assert "administradores" in resp.json()["detail"]

    resp = await client.get("/api/v1/novedades", headers=auth_headers(tokens_cliente))
    assert resp.status_code == 401

    client.cookies.clear()
    resp = await client.get("/api/v1/novedades")
    assert resp.status_code == 401

    # Los filtros del admin NO leen la tabla `novedades` → responden 200.
    resp = await client.get(
        "/api/v1/novedades/admin/filtros", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "tecnicos" in data and "clientes" in data
    assert data["prioridades"] == ["baja", "normal", "alta", "urgente"]

    # HALLAZGO: desde aquí todo lo que SÍ consulta la tabla `novedades`
    # lanza OperationalError (1054 Unknown column) y termina en HTTP 500.
    # ServerErrorMiddleware relanza la excepción, así que la suite la
    # espera con pytest.raises y resetea la sesión entre llamadas.
    # Ver be/app/tests/hallazgos/pedidos_calificaciones_otros.md.
    with pytest.raises(OperationalError):
        await client.get("/api/v1/novedades", headers=auth_headers(tokens_admin))
    db.rollback()

    with pytest.raises(OperationalError):
        await client.get(
            "/api/v1/novedades/mis-novedades", headers=auth_headers(tokens_tecnico)
        )
    db.rollback()

    with pytest.raises(OperationalError):
        await client.get(
            "/api/v1/novedades/cliente/novedades", headers=auth_headers(tokens_cliente)
        )
    db.rollback()

    # Hasta el 404 es inalcanzable: la SELECT se ejecuta antes de
    # comprobar que la fila exista.
    with pytest.raises(OperationalError):
        await client.get("/api/v1/novedades/999999", headers=auth_headers(tokens_admin))
    db.rollback()


async def test_novedades_estado_y_evidencia(
    client: AsyncClient, db, admin_logueado
):
    """Permisos de evidencias/cambio de estado y bloqueo por el hallazgo.

    COMPORTAMIENTO ACTUAL: permisos (401/403) y la validación de catálogo
    del estado se resuelven sin tocar la tabla; cargar o modificar la
    novedad lanza OperationalError (1054 Unknown column, columnas del
    modelo sin migrar) → HTTP 500 en producción.
    """
    _admin, tokens_admin = admin_logueado
    _usuario_a, _ficha_a, tokens_a = await _tecnico_logueado(client, db, n=1)

    ruta_evidencia = "/api/v1/novedades/1/evidencia"

    # Sin credenciales → 401 (limpiando las cookies de sesión).
    client.cookies.clear()
    resp = await client.post(
        ruta_evidencia, files={"file": ("foto.png", _png_bytes(), "image/png")}
    )
    assert resp.status_code == 401

    # El administrador no es técnico → 403 (dependencia _tecnico, antes
    # de consultar la novedad).
    resp = await client.post(
        ruta_evidencia,
        files={"file": ("foto.png", _png_bytes(), "image/png")},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 403
    assert "técnicos" in resp.json()["detail"]

    # Listado de evidencias: el admin autentica pero la SELECT de la
    # novedad dispara el hallazgo → 500.
    # Ver be/app/tests/hallazgos/pedidos_calificaciones_otros.md.
    with pytest.raises(OperationalError):
        await client.get(
            "/api/v1/novedades/1/evidencias", headers=auth_headers(tokens_admin)
        )
    db.rollback()

    # HALLAZGO: la subida de evidencia carga la novedad ANTES de validar
    # el archivo, así que hoy no llegan ni los 400 de extensión/PIL: la
    # llamada termina en el mismo 500 por las columnas sin migrar.
    with pytest.raises(OperationalError):
        await client.post(
            ruta_evidencia,
            files={"file": ("foto.png", _png_bytes(), "image/png")},
            headers=auth_headers(tokens_a),
        )
    db.rollback()

    # Cambio de estado: un técnico no es administrador → 403.
    resp = await client.put(
        "/api/v1/novedades/1/estado",
        json={"nuevo_estado": "Resuelta"},
        headers=auth_headers(tokens_a),
    )
    assert resp.status_code == 403
    assert "administradores" in resp.json()["detail"]

    # Estado fuera de catálogo → 400 (se valida antes de consultar).
    resp = await client.put(
        "/api/v1/novedades/1/estado",
        json={"nuevo_estado": "Imposible"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400
    assert "Estado no válido" in resp.json()["detail"]

    # HALLAZGO: un estado válido sí consulta la tabla → 500.
    with pytest.raises(OperationalError):
        await client.put(
            "/api/v1/novedades/1/estado",
            json={"nuevo_estado": "Resuelta"},
            headers=auth_headers(tokens_admin),
        )
    db.rollback()


# ──────────────────────────────────────────────────────────────
# Reportes administrativos
# ──────────────────────────────────────────────────────────────
async def test_reports_permisos(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """Los reportes son exclusivos del administrador."""
    _cliente, tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    _u, _f, tokens_tecnico = await _tecnico_logueado(client, db)

    client.cookies.clear()
    resp = await client.get("/api/v1/reports/resumen")
    assert resp.status_code == 401

    resp = await client.get(
        "/api/v1/reports/resumen", headers=auth_headers(tokens_cliente)
    )
    assert resp.status_code == 401

    resp = await client.get(
        "/api/v1/reports/resumen", headers=auth_headers(tokens_tecnico)
    )
    assert resp.status_code == 403

    resp = await client.get(
        "/api/v1/reports/resumen", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    for clave in (
        "ventas_total",
        "pedidos_total",
        "clientes_total",
        "citas_total",
        "tecnicos_total",
        "productos_total",
        "solicitudes_pendientes",
        "pedidos_por_mes",
        "productos_mas_vendidos",
    ):
        assert clave in data, clave


async def test_reports_resumen_rangos(client: AsyncClient, db, admin_logueado):
    """GET /reports/resumen valida que el rango de fechas sea coherente."""
    _admin, tokens_admin = admin_logueado
    headers = auth_headers(tokens_admin)
    hoy = date.today()

    # Solo una de las dos fechas → 400.
    resp = await client.get(
        "/api/v1/reports/resumen",
        params={"fecha_inicio": hoy.isoformat()},
        headers=headers,
    )
    assert resp.status_code == 400

    resp = await client.get(
        "/api/v1/reports/resumen",
        params={"fecha_fin": hoy.isoformat()},
        headers=headers,
    )
    assert resp.status_code == 400

    # Fecha final anterior a la inicial → 400.
    resp = await client.get(
        "/api/v1/reports/resumen",
        params={
            "fecha_inicio": hoy.isoformat(),
            "fecha_fin": (hoy - timedelta(days=10)).isoformat(),
        },
        headers=headers,
    )
    assert resp.status_code == 400

    # Formato de fecha inválido → 422 (validación de tipo de FastAPI).
    resp = await client.get(
        "/api/v1/reports/resumen",
        params={"fecha_inicio": "ayer", "fecha_fin": "hoy"},
        headers=headers,
    )
    assert resp.status_code == 422

    # Rango válido → 200.
    resp = await client.get(
        "/api/v1/reports/resumen",
        params={
            "fecha_inicio": (hoy - timedelta(days=30)).isoformat(),
            "fecha_fin": hoy.isoformat(),
        },
        headers=headers,
    )
    assert resp.status_code == 200
    assert isinstance(resp.json()["pedidos_por_mes"], list)


async def test_reports_ventas_periodo(client: AsyncClient, db, admin_logueado):
    """GET /reports/ventas agrupa por periodo; el periodo se valida con regex."""
    _admin, tokens_admin = admin_logueado
    headers = auth_headers(tokens_admin)

    resp = await client.get(
        "/api/v1/reports/ventas", params={"periodo": "dia"}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["periodo"] == "dia"
    assert data["fecha_inicio"] == str(date.today())
    assert set(data["resumen"]) == {
        "total_pedidos",
        "total_ventas_pedidos",
        "total_ingresos_citas",
        "total_ingresos",
    }
    assert isinstance(data["ventas_por_periodo"], list)

    # Periodo fuera de la expresión regular → 422.
    resp = await client.get(
        "/api/v1/reports/ventas", params={"periodo": "quincena"}, headers=headers
    )
    assert resp.status_code == 422

    # Rango explícito también funciona.
    hoy = date.today()
    resp = await client.get(
        "/api/v1/reports/ventas",
        params={
            "periodo": "mes",
            "fecha_inicio": (hoy - timedelta(days=60)).isoformat(),
            "fecha_fin": hoy.isoformat(),
        },
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["periodo"] == "mes"

    # El técnico no tiene acceso.
    _u, _f, tokens_tecnico = await _tecnico_logueado(client, db)
    resp = await client.get(
        "/api/v1/reports/ventas", params={"periodo": "dia"}, headers=auth_headers(tokens_tecnico)
    )
    assert resp.status_code == 403


async def test_reports_operativo(client: AsyncClient, db, admin_logueado):
    """GET /reports/operativo alimenta el dashboard (solo admin)."""
    _admin, tokens_admin = admin_logueado

    resp = await client.get(
        "/api/v1/reports/operativo", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    for clave in (
        "citas_pendientes_asignacion",
        "citas_reprogramadas",
        "citas_canceladas",
        "tecnicos_disponibles_hoy",
        "reembolsos_pendientes_citas",
        "entregas_sin_tecnico",
        "entregas_asignadas",
    ):
        assert clave in data, clave

    # Sin credenciales → 401 (se limpian las cookies del login del fixture).
    client.cookies.clear()
    resp = await client.get("/api/v1/reports/operativo")
    assert resp.status_code == 401
