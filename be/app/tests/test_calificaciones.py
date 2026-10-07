"""
Pruebas del router de calificaciones (be/app/routers/calificaciones.py).

Cubre los dos grupos de calificaciones que expone la API:

* Calificaciones de técnicos por parte del cliente sobre una cita
  Finalizada (creación con todas sus reglas, listado público del técnico,
  reseñas dadas por el cliente, encuesta pendiente y estado por cita).
* Calificaciones de productos de un pedido entregado, incluida la subida
  de la foto opcional (MinIO stubeado por el conftest).

Se ejecuta contra la BD de pruebas con el login real de la API.
"""

from datetime import date, datetime, timedelta

from httpx import AsyncClient

from app.models.calificacion import Calificacion
from app.models.calificacion_producto import CalificacionProducto
from app.models.cita import Cita
from app.models.notificacion import Notificacion
from app.models.pedido import DetallePedido, Pedido
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
def _otro_cliente(db, n: int = 1):
    """Segundo cliente con email/documento únicos (evita la colisión del
    email UNIQUE con el cliente del fixture `cliente_logueado`)."""
    return crear_cliente(
        db,
        first_name=f"Otro{n}",
        last_name="Cliente",
        email=f"calif.otro.cliente{n}@test.neodomus.com",
        documento_cliente=4000000000 + n,
    )


def _ficha_tecnica(db, n: int = 1):
    """Empleado + ficha técnico con email único (los fixtures `admin_logueado`
    y `tecnico_logueado` colisionan en el email UNIQUE si se usan juntos)."""
    usuario = crear_empleado(
        db, rol="tecnico", email=f"calif.tecnico{n}@test.neodomus.com"
    )
    ficha = crear_tecnico(db, usuario=usuario)
    return usuario, ficha


async def _login_tecnico(client: AsyncClient, db, n: int = 1):
    """Técnico creado + tokens reales de /auth/login."""
    usuario, ficha = _ficha_tecnica(db, n)
    tokens = await login(client, usuario.email, "Test1234!", "employee")
    return usuario, ficha, tokens


def _cita(db, cliente, **kw) -> Cita:
    """Cita directa en BD (la API no permite crear citas ya Finalizadas)."""
    datos = dict(
        id_cliente=cliente.id_cliente,
        tipo_servicio="instalacion",
        fecha=date.today() - timedelta(days=3),
        hora="08:00",
        direccion="Cra 10 #12-34",
        descripcion="Cita de prueba",
        estado="Finalizada",
    )
    datos.update(kw)
    cita = Cita(**datos)
    db.add(cita)
    db.commit()
    db.refresh(cita)
    db.commit()
    return cita


def _pedido_con_producto(db, cliente, producto, **kw) -> Pedido:
    """Pedido propio con el producto en su detalle (por defecto Entregado)."""
    datos = dict(
        id_cliente_pe=cliente.id_cliente,
        fecha_peedido=datetime.now(),
        total_pedido=producto.precio_venta_producto,
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
            cantidad_detalle=1,
            precio_unitario_detalle=producto.precio_venta_producto,
            subtotal_detalle=producto.precio_venta_producto,
        )
    )
    db.commit()
    db.refresh(pedido)
    db.commit()
    return pedido


# ──────────────────────────────────────────────────────────────
# POST /calificaciones — crear calificación de técnico
# ──────────────────────────────────────────────────────────────
async def test_crear_calificacion_exitosa(client: AsyncClient, db, cliente_logueado):
    """Cita Finalizada propia con técnico: 200, guarda la fila y notifica."""
    cliente, tokens = cliente_logueado
    usuario_tecnico, ficha = _ficha_tecnica(db)
    cita = _cita(db, cliente, id_tecnico=ficha.id_tecnico)

    resp = await client.post(
        "/api/v1/calificaciones",
        json={"id_cita": cita.id_cita, "calificacion": 5, "comentario": "Excelente"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id_calificacion"]
    assert data["calificacion"] == 5
    assert data["comentario"] == "Excelente"

    fila = (
        db.query(Calificacion)
        .filter(Calificacion.id_cita_c == cita.id_cita)
        .first()
    )
    assert fila is not None
    assert fila.id_cliente_c == cliente.id_cliente
    assert fila.id_tecnico_c == ficha.id_tecnico

    # El técnico recibe la notificación de plataforma.
    noti = (
        db.query(Notificacion)
        .filter(
            Notificacion.id_usuario == usuario_tecnico.id_usuario,
            Notificacion.tipo == "calificacion_recibida",
        )
        .first()
    )
    assert noti is not None
    assert "te calificó con 5 estrellas" in noti.mensaje


async def test_crear_calificacion_comentario_vacio(client: AsyncClient, db, cliente_logueado):
    """Un comentario en blanco se guarda como NULL (no como cadena vacía)."""
    cliente, tokens = cliente_logueado
    _usuario, ficha = _ficha_tecnica(db, n=2)
    cita = _cita(db, cliente, id_tecnico=ficha.id_tecnico)

    resp = await client.post(
        "/api/v1/calificaciones",
        json={"id_cita": cita.id_cita, "calificacion": 3, "comentario": "   "},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["comentario"] is None


async def test_crear_calificacion_sin_credenciales(client: AsyncClient, db, cliente_logueado):
    """Sin Authorization (y sin cookies de sesión) → 401 en endpoints privados."""
    cliente, _tokens = cliente_logueado
    _usuario, ficha = _ficha_tecnica(db)
    cita = _cita(db, cliente, id_tecnico=ficha.id_tecnico)
    # El login del fixture dejó cookies HttpOnly en el client (fallback de
    # _token_desde_request): se limpian para viajar realmente sin sesión.
    client.cookies.clear()

    rutas = [
        ("POST", "/api/v1/calificaciones", {"id_cita": cita.id_cita, "calificacion": 5}),
        ("GET", "/api/v1/calificaciones/mis-dadas", None),
        ("GET", "/api/v1/calificaciones/mis", None),
        ("GET", "/api/v1/calificaciones/pendiente", None),
        ("GET", f"/api/v1/calificaciones/cita/{cita.id_cita}", None),
        ("POST", "/api/v1/calificaciones/producto", {"id_pedido": 1, "id_producto": 1, "calificacion": 5}),
        ("GET", "/api/v1/calificaciones/producto/pedido/1", None),
    ]
    for metodo, ruta, cuerpo in rutas:
        resp = await (
            client.post(ruta, json=cuerpo) if metodo == "POST" else client.get(ruta)
        )
        assert resp.status_code == 401, (ruta, resp.status_code, resp.text)


async def test_crear_calificacion_token_de_empleado(client: AsyncClient, db, cliente_logueado):
    """Un token de empleado en endpoints de cliente → 401 (tipo de cuenta)."""
    cliente, _tokens = cliente_logueado
    _usuario_t, ficha, tokens_tecnico = await _login_tecnico(client, db)
    cita = _cita(db, cliente, id_tecnico=ficha.id_tecnico)

    resp = await client.post(
        "/api/v1/calificaciones",
        json={"id_cita": cita.id_cita, "calificacion": 5},
        headers=auth_headers(tokens_tecnico),
    )
    assert resp.status_code == 401
    assert "cliente" in resp.json()["detail"].lower()

    resp = await client.get(
        "/api/v1/calificaciones/mis-dadas", headers=auth_headers(tokens_tecnico)
    )
    assert resp.status_code == 401


async def test_crear_calificacion_token_de_cliente_en_mis(client: AsyncClient, db, cliente_logueado):
    """GET /calificaciones/mis exige empleado: token de cliente → 401."""
    _cliente, tokens = cliente_logueado
    resp = await client.get(
        "/api/v1/calificaciones/mis", headers=auth_headers(tokens)
    )
    assert resp.status_code == 401


async def test_crear_calificacion_cita_ajena(client: AsyncClient, db, cliente_logueado):
    """Cita de otro cliente → 404 (no filtra por estado, primero es dueño)."""
    _cliente, tokens = cliente_logueado
    otro = _otro_cliente(db)
    _usuario, ficha = _ficha_tecnica(db)
    cita_ajena = _cita(db, otro, id_tecnico=ficha.id_tecnico)

    resp = await client.post(
        "/api/v1/calificaciones",
        json={"id_cita": cita_ajena.id_cita, "calificacion": 1},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404

    resp = await client.post(
        "/api/v1/calificaciones",
        json={"id_cita": 999999, "calificacion": 1},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404


async def test_crear_calificacion_cita_no_finalizada(client: AsyncClient, db, cliente_logueado):
    """Solo se califican citas Finalizadas → 400 en cualquier otro estado."""
    cliente, tokens = cliente_logueado
    _usuario, ficha = _ficha_tecnica(db)

    for estado in ("Pendiente", "Confirmada", "Cancelada"):
        cita = _cita(db, cliente, id_tecnico=ficha.id_tecnico, estado=estado)
        resp = await client.post(
            "/api/v1/calificaciones",
            json={"id_cita": cita.id_cita, "calificacion": 5},
            headers=auth_headers(tokens),
        )
        assert resp.status_code == 400, (estado, resp.status_code, resp.text)


async def test_crear_calificacion_cita_sin_tecnico(client: AsyncClient, db, cliente_logueado):
    """Cita finalizada sin técnico asignado → 400 (no hay a quién calificar)."""
    cliente, tokens = cliente_logueado
    cita = _cita(db, cliente, id_tecnico=None, nombre_tecnico=None)

    resp = await client.post(
        "/api/v1/calificaciones",
        json={"id_cita": cita.id_cita, "calificacion": 5},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "sin técnico" in resp.json()["detail"] or "no tiene técnico" in resp.json()["detail"]


async def test_crear_calificacion_duplicada(client: AsyncClient, db, cliente_logueado):
    """Una cita solo se califica una vez por cliente → 400 la segunda."""
    cliente, tokens = cliente_logueado
    _usuario, ficha = _ficha_tecnica(db)
    cita = _cita(db, cliente, id_tecnico=ficha.id_tecnico)

    cuerpo = {"id_cita": cita.id_cita, "calificacion": 4}
    resp = await client.post(
        "/api/v1/calificaciones", json=cuerpo, headers=auth_headers(tokens)
    )
    assert resp.status_code == 200, resp.text

    resp = await client.post(
        "/api/v1/calificaciones", json=cuerpo, headers=auth_headers(tokens)
    )
    assert resp.status_code == 400
    assert "Ya calificaste" in resp.json()["detail"]

    # Solo existe una fila.
    total = (
        db.query(Calificacion)
        .filter(Calificacion.id_cita_c == cita.id_cita)
        .count()
    )
    assert total == 1


async def test_crear_calificacion_estrellas_invalidas(client: AsyncClient, db, cliente_logueado):
    """El esquema exige 1-5 estrellas y un id_cita → 422 del validador."""
    cliente, tokens = cliente_logueado
    _usuario, ficha = _ficha_tecnica(db)
    cita = _cita(db, cliente, id_tecnico=ficha.id_tecnico)

    cuerpos = [
        {"id_cita": cita.id_cita, "calificacion": 6},
        {"id_cita": cita.id_cita, "calificacion": 0},
        {"id_cita": cita.id_cita, "calificacion": -1},
        {"calificacion": 5},
        {"id_cita": cita.id_cita},
    ]
    for cuerpo in cuerpos:
        resp = await client.post(
            "/api/v1/calificaciones", json=cuerpo, headers=auth_headers(tokens)
        )
        assert resp.status_code == 422, (cuerpo, resp.status_code)


# ──────────────────────────────────────────────────────────────
# Listados y consulta
# ──────────────────────────────────────────────────────────────
async def test_calificaciones_tecnico_publico(client: AsyncClient, db, cliente_logueado):
    """GET /tecnico/{id} es público: promedio, total y detalle con el cliente."""
    cliente, _tokens = cliente_logueado
    _usuario, ficha = _ficha_tecnica(db)

    # Dos calificaciones directas sobre dos citas distintas (la tabla tiene
    # UNIQUE (id_cliente_c, id_cita_c): una sola calificación por cita).
    for estrella, comentario, dias in ((5, "Muy bueno", 3), (3, "Regular", 5)):
        cita = _cita(
            db, cliente, id_tecnico=ficha.id_tecnico, fecha=date.today() - timedelta(days=dias)
        )
        db.add(
            Calificacion(
                id_cliente_c=cliente.id_cliente,
                id_tecnico_c=ficha.id_tecnico,
                id_cita_c=cita.id_cita,
                calificacion=estrella,
                comentario=comentario,
            )
        )
    db.commit()

    resp = await client.get(f"/api/v1/calificaciones/tecnico/{ficha.id_tecnico}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id_tecnico"] == ficha.id_tecnico
    assert data["total"] == 2
    assert data["promedio"] == 4.0
    nombres = {f["cliente"] for f in data["calificaciones"]}
    assert nombres == {"Prueba Cliente"}
    assert all(f["created_at"] for f in data["calificaciones"])

    # Técnico sin calificaciones: promedio nulo, lista vacía.
    _u2, ficha2 = _ficha_tecnica(db, n=2)
    resp = await client.get(f"/api/v1/calificaciones/tecnico/{ficha2.id_tecnico}")
    assert resp.status_code == 200
    assert resp.json()["promedio"] is None
    assert resp.json()["total"] == 0

    # Técnico inexistente → 404.
    resp = await client.get("/api/v1/calificaciones/tecnico/999999")
    assert resp.status_code == 404


async def test_mis_dadas_cliente(client: AsyncClient, db, cliente_logueado):
    """GET /mis-dadas: reseñas que el cliente dejó, con técnico y cita."""
    cliente, tokens = cliente_logueado
    _usuario, ficha = _ficha_tecnica(db)
    cita = _cita(db, cliente, id_tecnico=ficha.id_tecnico)

    resp = await client.get(
        "/api/v1/calificaciones/mis-dadas", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    assert resp.json() == []

    resp = await client.post(
        "/api/v1/calificaciones",
        json={"id_cita": cita.id_cita, "calificacion": 4, "comentario": "Bien"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text

    resp = await client.get(
        "/api/v1/calificaciones/mis-dadas", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    filas = resp.json()
    assert len(filas) == 1
    fila = filas[0]
    assert fila["calificacion"] == 4
    assert fila["id_cita"] == cita.id_cita
    assert fila["id_tecnico"] == ficha.id_tecnico
    assert fila["nombre_tecnico"] == "Prueba Empleado"
    assert fila["tipo_servicio"] == "instalacion"
    assert fila["fecha_cita"] == cita.fecha.isoformat()


async def test_mis_del_tecnico(client: AsyncClient, db):
    """GET /mis: técnico autenticado ve su promedio; admin sin ficha → 404."""
    usuario_tecnico, ficha, tokens_tecnico = await _login_tecnico(client, db)
    # Calificación directa del único cliente de la BD de este test.
    cliente = crear_cliente(
        db,
        first_name="Valorador",
        last_name="Único",
        email="calif.valorador@test.neodomus.com",
        documento_cliente=5000000001,
    )
    cita = _cita(db, cliente, id_tecnico=ficha.id_tecnico)
    db.add(
        Calificacion(
            id_cliente_c=cliente.id_cliente,
            id_tecnico_c=ficha.id_tecnico,
            id_cita_c=cita.id_cita,
            calificacion=2,
            comentario="Tarde",
        )
    )
    db.commit()

    resp = await client.get(
        "/api/v1/calificaciones/mis", headers=auth_headers(tokens_tecnico)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["promedio"] == 2.0
    assert data["total"] == 1

    # Administrador sin ficha de técnico → 404.
    admin = crear_empleado(
        db, rol="administrador", email="calif.admin@test.neodomus.com"
    )
    tokens_admin = await login(client, admin.email, "Test1234!", "employee")
    resp = await client.get(
        "/api/v1/calificaciones/mis", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 404
    assert "ficha de técnico" in resp.json()["detail"]


async def test_calificacion_pendiente(client: AsyncClient, db, cliente_logueado):
    """GET /pendiente: cita Finalizada sin calificar y su estado tras calificar."""
    cliente, tokens = cliente_logueado
    _usuario, ficha = _ficha_tecnica(db)

    # Sin citas finalizadas → pendiente False.
    resp = await client.get(
        "/api/v1/calificaciones/pendiente", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    assert resp.json() == {"pendiente": False}

    cita = _cita(db, cliente, id_tecnico=ficha.id_tecnico)
    resp = await client.get(
        "/api/v1/calificaciones/pendiente", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["pendiente"] is True
    assert data["id_cita"] == cita.id_cita
    assert data["id_tecnico"] == ficha.id_tecnico
    assert data["tecnico_nombre"] == "Prueba Empleado"
    assert data["fecha"] == cita.fecha.isoformat()

    # Tras calificar ya no queda nada pendiente.
    resp = await client.post(
        "/api/v1/calificaciones",
        json={"id_cita": cita.id_cita, "calificacion": 5},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text

    resp = await client.get(
        "/api/v1/calificaciones/pendiente", headers=auth_headers(tokens)
    )
    assert resp.json()["pendiente"] is False


async def test_estado_calificacion_por_cita(client: AsyncClient, db, cliente_logueado):
    """GET /cita/{id}: estado propio antes/después de calificar; ajena → 404."""
    cliente, tokens = cliente_logueado
    _usuario, ficha = _ficha_tecnica(db)
    cita = _cita(db, cliente, id_tecnico=ficha.id_tecnico)

    resp = await client.get(
        f"/api/v1/calificaciones/cita/{cita.id_cita}", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    assert resp.json() == {"calificada": False, "calificacion": None, "comentario": None}

    resp = await client.post(
        "/api/v1/calificaciones",
        json={"id_cita": cita.id_cita, "calificacion": 3, "comentario": "Regular"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text

    resp = await client.get(
        f"/api/v1/calificaciones/cita/{cita.id_cita}", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["calificada"] is True
    assert data["calificacion"] == 3
    assert data["comentario"] == "Regular"

    # Cita de otro cliente → 404.
    otro = _otro_cliente(db)
    cita_ajena = _cita(db, otro, id_tecnico=ficha.id_tecnico)
    resp = await client.get(
        f"/api/v1/calificaciones/cita/{cita_ajena.id_cita}",
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404

    resp = await client.get(
        "/api/v1/calificaciones/cita/999999", headers=auth_headers(tokens)
    )
    assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────
# POST /calificaciones/producto — productos de pedidos entregados
# ──────────────────────────────────────────────────────────────
async def test_calificar_producto_entregado(client: AsyncClient, db, cliente_logueado):
    """Pedido Entregado propio: 200, fila en BD y nombre del producto."""
    cliente, tokens = cliente_logueado
    producto = crear_producto(
        db, nombre_producto="Lámpara LED", referencia_producto="REF-CALIF-1"
    )
    pedido = _pedido_con_producto(db, cliente, producto)

    resp = await client.post(
        "/api/v1/calificaciones/producto",
        json={
            "id_pedido": pedido.id_pedido,
            "id_producto": producto.id_producto,
            "calificacion": 5,
            "comentario": "Llegó perfecto",
        },
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id_pedido"] == pedido.id_pedido
    assert data["id_producto"] == producto.id_producto
    assert data["nombre_producto"] == "Lámpara LED"
    assert data["calificacion"] == 5
    assert data["created_at"]

    fila = (
        db.query(CalificacionProducto)
        .filter(
            CalificacionProducto.id_pedido_cp == pedido.id_pedido,
            CalificacionProducto.id_producto_cp == producto.id_producto,
        )
        .first()
    )
    assert fila is not None
    assert fila.id_cliente_cp == cliente.id_cliente


async def test_calificar_producto_pedido_no_entregado(client: AsyncClient, db, cliente_logueado):
    """Pedido aún no completado → 400 con el mensaje de regla de negocio."""
    cliente, tokens = cliente_logueado
    producto = crear_producto(
        db, nombre_producto="Silla", referencia_producto="REF-CALIF-2"
    )
    pedido = _pedido_con_producto(
        db, cliente, producto, estado_entrega="En camino"
    )

    resp = await client.post(
        "/api/v1/calificaciones/producto",
        json={
            "id_pedido": pedido.id_pedido,
            "id_producto": producto.id_producto,
            "calificacion": 5,
        },
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "entregados" in resp.json()["detail"]


async def test_calificar_producto_pedido_ajeno(client: AsyncClient, db, cliente_logueado):
    """Pedido de otro cliente → 404; pedido inexistente → 404."""
    _cliente, tokens = cliente_logueado
    otro = _otro_cliente(db)
    producto = crear_producto(
        db, nombre_producto="Mesa", referencia_producto="REF-CALIF-3"
    )
    pedido_ajeno = _pedido_con_producto(db, otro, producto)

    for id_pedido in (pedido_ajeno.id_pedido, 999999):
        resp = await client.post(
            "/api/v1/calificaciones/producto",
            json={
                "id_pedido": id_pedido,
                "id_producto": producto.id_producto,
                "calificacion": 5,
            },
            headers=auth_headers(tokens),
        )
        assert resp.status_code == 404, (id_pedido, resp.status_code)


async def test_calificar_producto_fuera_del_pedido(client: AsyncClient, db, cliente_logueado):
    """Producto válido pero que no está en el detalle del pedido → 400."""
    cliente, tokens = cliente_logueado
    producto = crear_producto(
        db, nombre_producto="Escritorio", referencia_producto="REF-CALIF-4"
    )
    otro_producto = crear_producto(
        db, nombre_producto="Estantería", referencia_producto="REF-CALIF-5"
    )
    pedido = _pedido_con_producto(db, cliente, producto)

    resp = await client.post(
        "/api/v1/calificaciones/producto",
        json={
            "id_pedido": pedido.id_pedido,
            "id_producto": otro_producto.id_producto,
            "calificacion": 5,
        },
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "no pertenece" in resp.json()["detail"]


async def test_calificar_producto_duplicado(client: AsyncClient, db, cliente_logueado):
    """Cada producto se califica una sola vez por pedido → 400 la segunda."""
    cliente, tokens = cliente_logueado
    producto = crear_producto(
        db, nombre_producto="Camara", referencia_producto="REF-CALIF-6"
    )
    pedido = _pedido_con_producto(db, cliente, producto)
    cuerpo = {
        "id_pedido": pedido.id_pedido,
        "id_producto": producto.id_producto,
        "calificacion": 4,
    }

    resp = await client.post(
        "/api/v1/calificaciones/producto", json=cuerpo, headers=auth_headers(tokens)
    )
    assert resp.status_code == 200, resp.text

    resp = await client.post(
        "/api/v1/calificaciones/producto", json=cuerpo, headers=auth_headers(tokens)
    )
    assert resp.status_code == 400
    assert "Ya calificaste" in resp.json()["detail"]

    total = (
        db.query(CalificacionProducto)
        .filter(CalificacionProducto.id_pedido_cp == pedido.id_pedido)
        .count()
    )
    assert total == 1


async def test_calificar_producto_estrellas_invalidas(client: AsyncClient, db, cliente_logueado):
    """Estrellas fuera de 1-5 o campos faltantes → 422 del validador."""
    cliente, tokens = cliente_logueado
    producto = crear_producto(
        db, nombre_producto="Rug", referencia_producto="REF-CALIF-7"
    )
    pedido = _pedido_con_producto(db, cliente, producto)

    cuerpos = [
        {"id_pedido": pedido.id_pedido, "id_producto": producto.id_producto, "calificacion": 6},
        {"id_pedido": pedido.id_pedido, "id_producto": producto.id_producto, "calificacion": 0},
        {"id_pedido": pedido.id_pedido, "calificacion": 5},
        {"id_producto": producto.id_producto, "calificacion": 5},
    ]
    for cuerpo in cuerpos:
        resp = await client.post(
            "/api/v1/calificaciones/producto", json=cuerpo, headers=auth_headers(tokens)
        )
        assert resp.status_code == 422, (cuerpo, resp.status_code)


async def test_consultar_calificaciones_de_mi_pedido(client: AsyncClient, db, cliente_logueado):
    """GET /producto/pedido/{id}: calificaciones propias; ajeno → 404."""
    cliente, tokens = cliente_logueado
    producto = crear_producto(
        db, nombre_producto="Abanico", referencia_producto="REF-CALIF-8"
    )
    pedido = _pedido_con_producto(db, cliente, producto)

    resp = await client.get(
        f"/api/v1/calificaciones/producto/pedido/{pedido.id_pedido}",
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id_pedido"] == pedido.id_pedido
    assert data["estado_entrega"] == "Entregado"
    assert data["calificaciones"] == []

    resp = await client.post(
        "/api/v1/calificaciones/producto",
        json={
            "id_pedido": pedido.id_pedido,
            "id_producto": producto.id_producto,
            "calificacion": 3,
        },
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text

    resp = await client.get(
        f"/api/v1/calificaciones/producto/pedido/{pedido.id_pedido}",
        headers=auth_headers(tokens),
    )
    filas = resp.json()["calificaciones"]
    assert len(filas) == 1
    assert filas[0]["id_producto"] == producto.id_producto
    assert filas[0]["calificacion"] == 3

    # Pedido de otro cliente → 404.
    otro = _otro_cliente(db)
    pedido_ajeno = _pedido_con_producto(db, otro, producto)
    resp = await client.get(
        f"/api/v1/calificaciones/producto/pedido/{pedido_ajeno.id_pedido}",
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404


async def test_subir_foto_calificacion_producto(client: AsyncClient, db, cliente_logueado):
    """Foto del producto: 404 sin calificar, 400 por formato/vacío, 200 con PNG."""
    cliente, tokens = cliente_logueado
    producto = crear_producto(
        db, nombre_producto="Espejo", referencia_producto="REF-CALIF-9"
    )
    pedido = _pedido_con_producto(db, cliente, producto)
    ruta = (
        f"/api/v1/calificaciones/producto/{pedido.id_pedido}/"
        f"{producto.id_producto}/foto"
    )

    # Todavía no calificó → 404 (la foto acompaña a la calificación).
    resp = await client.post(
        ruta,
        files={"file": ("foto.png", b"contenido", "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404
    assert "Califica primero" in resp.json()["detail"]

    resp = await client.post(
        "/api/v1/calificaciones/producto",
        json={
            "id_pedido": pedido.id_pedido,
            "id_producto": producto.id_producto,
            "calificacion": 5,
        },
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text

    # Extensión no permitida → 400.
    resp = await client.post(
        ruta,
        files={"file": ("foto.gif", b"GIF89a", "image/gif")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "Formato no permitido" in resp.json()["detail"]

    # Archivo vacío → 400.
    resp = await client.post(
        ruta,
        files={"file": ("foto.png", b"", "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "vacío" in resp.json()["detail"]

    # PNG válido → 200 con la URL de MinIO (stubeado por el conftest).
    resp = await client.post(
        ruta,
        files={"file": ("foto.png", b"contenido-de-imagen", "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["msg"] == "Foto guardada"
    assert data["foto_url"].startswith("http://test-minio:9000/neodomus-media/")

    fila = (
        db.query(CalificacionProducto)
        .filter(
            CalificacionProducto.id_pedido_cp == pedido.id_pedido,
            CalificacionProducto.id_producto_cp == producto.id_producto,
        )
        .first()
    )
    assert fila.foto_url == data["foto_url"]
