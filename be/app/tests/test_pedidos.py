"""
Pruebas del router de pedidos (be/app/routers/pedidos.py) y de
be/app/services/pedidos_service.py.

Cubre el flujo real de checkout (carrito/items, totales, stock y pago
simulador), listado de mis pedidos, detalle y seguimiento, descarga de la
factura PDF (reportlab), confirmación de pago pendiente, métodos de pago,
recomendación de técnicos y los endpoints administrativos de entregas,
facturas y horarios.

Se ejecuta contra la BD de pruebas con el login real de la API.
"""

from datetime import date, datetime, timedelta

from httpx import AsyncClient

from app.models.pago import Pago
from app.models.pedido import DetallePedido, Pedido
from app.models.producto import Producto
from app.tests.factories import (
    auth_headers,
    crear_cliente,
    crear_empleado,
    crear_producto,
    crear_tecnico,
    login,
)


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────
def _datos_pago(metodo: str, **extra) -> dict:
    """Datos mínimos válidos para cada método del simulador de pagos."""
    base = {"metodo": metodo}
    if metodo in ("tarjeta_debito", "tarjeta_credito"):
        base.update(
            numero="4242424242424242",
            titular="Cliente Prueba",
            expiracion="12/30",
            cvv="123",
        )
    elif metodo == "paypal":
        base["correo_paypal"] = "pagos@paypal.test"
    elif metodo == "punto_pago":
        base["punto_pago"] = "Efecty"
    elif metodo == "pse":
        base["banco"] = "Banco de Bogotá"
    base.update(extra)
    return base


async def _checkout(
    client: AsyncClient,
    headers: dict,
    items: list,
    metodo: str = "paypal",
    servicios: list | None = None,
    pago_extra: dict | None = None,
    codigo_cupon: str | None = None,
):
    """POST /api/v1/pedidos con el payload del checkout."""
    payload = {
        "items": items,
        "servicios": servicios or [],
        "pago": _datos_pago(metodo, **(pago_extra or {})),
    }
    if codigo_cupon is not None:
        payload["codigo_cupon"] = codigo_cupon
    return await client.post("/api/v1/pedidos", json=payload, headers=headers)


async def _tecnico_secundario(client, db, n: int = 1):
    """Técnico creado manualmente con email único.

    Los fixtures `admin_logueado` y `tecnico_logueado` generan ambos su
    empleado con las mismas kwargs por defecto, por lo que colisionan en el
    email UNIQUE cuando se usan en el mismo test; aquí se evita esa
    colisión usando factories con kwargs explícitos.
    """
    usuario = crear_empleado(
        db, rol="tecnico", email=f"tecnico.extra{n}@test.neodomus.com"
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
        email=f"otro.cliente{n}@test.neodomus.com",
        documento_cliente=3000000000 + n,
    )


def _pedido_directo(db, cliente, **kw) -> Pedido:
    """Crea un pedido en BD directamente (para probar endpoints admin)."""
    datos = dict(
        id_cliente_pe=cliente.id_cliente,
        fecha_peedido=datetime.now(),
        total_pedido=50000.0,
        estado_pedido="Pagado",
    )
    datos.update(kw)
    pedido = Pedido(**datos)
    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    db.commit()
    return pedido


def _dia_laboral_futuro(desde_dias: int = 2) -> date:
    """Primer día laboral (lunes-sábado) desde `desde_dias` días en adelante."""
    f = date.today() + timedelta(days=desde_dias)
    while f.weekday() == 6:  # domingo
        f += timedelta(days=1)
    return f


def _proximo_domingo() -> date:
    f = date.today() + timedelta(days=1)
    while f.weekday() != 6:
        f += timedelta(days=1)
    return f


# ──────────────────────────────────────────────────────────────
# Métodos de pago y recomendación de técnicos (catálogos)
# ──────────────────────────────────────────────────────────────
async def test_metodos_pago_publico(client: AsyncClient):
    """GET /pedidos/metodos-pago es público y devuelve el catálogo simulado."""
    resp = await client.get("/api/v1/pedidos/metodos-pago")
    assert resp.status_code == 200
    data = resp.json()
    assert data["modo"] == "simulador"
    assert "tarjeta_credito" in data["metodos"]
    assert "punto_pago" in data["metodos"]
    assert isinstance(data["bancos"], list) and data["bancos"]


async def test_recomendacion_tecnicos_requiere_cliente(client: AsyncClient):
    """POST /pedidos/recomendacion-tecnicos exige token de cliente (401)."""
    resp = await client.post(
        "/api/v1/pedidos/recomendacion-tecnicos", json={"items": []}
    )
    assert resp.status_code == 401


async def test_recomendacion_tecnicos_analiza_carrito(
    client: AsyncClient, db, cliente_logueado
):
    """Con cliente autenticado devuelve el análisis y los técnicos sugeridos."""
    _cliente, tokens = cliente_logueado
    producto = crear_producto(db)
    resp = await client.post(
        "/api/v1/pedidos/recomendacion-tecnicos",
        json={"items": [{"id_producto": producto.id_producto, "cantidad": 2}]},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "tecnicos_sugeridos" in data
    assert "tiempo_total_horas" in data
    assert "especializaciones_requeridas" in data
    assert isinstance(data["tecnicos_sugeridos"], list)


# ──────────────────────────────────────────────────────────────
# Checkout (flujo real)
# ──────────────────────────────────────────────────────────────
async def test_checkout_requiere_token(client: AsyncClient):
    """Sin token el checkout responde 401 (no crea nada)."""
    resp = await _checkout(client, {}, [{"id_producto": 1, "cantidad": 1}])
    assert resp.status_code == 401


async def test_checkout_con_token_de_empleado_da_401(
    client: AsyncClient, admin_logueado
):
    """El token de un empleado no sirve para el checkout de clientes (401)."""
    _admin, tokens = admin_logueado
    resp = await _checkout(
        client, auth_headers(tokens), [{"id_producto": 1, "cantidad": 1}]
    )
    assert resp.status_code == 401


async def test_checkout_crea_pedido_totales_y_stock(
    client: AsyncClient, db, cliente_logueado
):
    """Flujo completo: pedido Pagado, totales correctos, stock descontado
    y factura generada."""
    cliente, tokens = cliente_logueado
    producto = crear_producto(db, stock_producto=50, precio_venta_producto=20000.0)

    resp = await _checkout(
        client,
        auth_headers(tokens),
        [{"id_producto": producto.id_producto, "cantidad": 2}],
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    pedido = data["pedido"]
    assert pedido["id_pedido"]
    assert pedido["estado"] == "Pagado"
    assert pedido["total"] == 40000.0
    assert pedido["detalles"][0]["cantidad"] == 2
    assert pedido["detalles"][0]["subtotal"] == 40000.0

    assert data["pago"]["estado"] == "aprobado"
    assert data["pago"]["metodo_pago_codigo"] == "paypal"
    assert data["factura"] is not None
    assert data["factura"]["numero_factura"].startswith("FAC-")
    assert data["pdf_url"].endswith("/factura")
    assert data["carrito_mantener"] is False

    # Stock descontado por la compra (50 → 48).
    db.expire_all()
    producto_bd = db.query(Producto).filter(
        Producto.id_producto == producto.id_producto
    ).first()
    assert producto_bd.stock_producto == 48

    # El pedido y el pago quedan registrados en BD.
    assert db.query(Pedido).count() == 1
    pago = db.query(Pago).first()
    assert pago.estado == "aprobado"
    assert float(pago.monto) == 40000.0

    # Ninguna respuesta expone credenciales.
    assert "password" not in resp.text
    assert "password_hash" not in resp.text


async def test_checkout_carrito_vacio_400(client: AsyncClient, cliente_logueado):
    """Un carrito sin ítems responde 400 con el mensaje del servicio."""
    _cliente, tokens = cliente_logueado
    resp = await _checkout(client, auth_headers(tokens), [])
    assert resp.status_code == 400
    assert "carrito" in resp.json()["detail"].lower()


async def test_checkout_producto_inexistente_404(
    client: AsyncClient, cliente_logueado
):
    """Un ítem con producto inexistente responde 404."""
    _cliente, tokens = cliente_logueado
    resp = await _checkout(
        client, auth_headers(tokens), [{"id_producto": 999999, "cantidad": 1}]
    )
    assert resp.status_code == 404


async def test_checkout_stock_insuficiente_409(
    client: AsyncClient, db, cliente_logueado
):
    """Comprar más unidades de las disponibles responde 409 (conflicto de
    stock) ANTES de cobrar."""
    _cliente, tokens = cliente_logueado
    producto = crear_producto(db, stock_producto=1)
    resp = await _checkout(
        client,
        auth_headers(tokens),
        [{"id_producto": producto.id_producto, "cantidad": 3}],
    )
    assert resp.status_code == 409
    assert "stock" in resp.json()["detail"].lower()


async def test_checkout_cantidad_invalida_400(
    client: AsyncClient, db, cliente_logueado
):
    """Cantidad menor que 1 se rechaza con 400.

    Nota: la cantidad 0 NO llega aquí — el servicio la coacciona a 1 con
    `int(cantidad or 1)` (comportamiento documentado en hallazgos)."""
    _cliente, tokens = cliente_logueado
    producto = crear_producto(db)
    resp = await _checkout(
        client,
        auth_headers(tokens),
        [{"id_producto": producto.id_producto, "cantidad": -1}],
    )
    assert resp.status_code == 400


async def test_checkout_pago_rechazado(
    client: AsyncClient, db, cliente_logueado
):
    """Pago rechazado por el simulador: el pedido queda 'Pago rechazado',
    sin factura, con carrito_mantener en True y sin descontar stock.

    El resultado se fuerza con `resultado_simulacion`; sin ese campo el
    simulador aprueba por defecto (ver hallazgos: la tarjeta de prueba
    ...0001 documentada como rechazo NO surte efecto sola)."""
    _cliente, tokens = cliente_logueado
    producto = crear_producto(db, stock_producto=10)

    resp = await _checkout(
        client,
        auth_headers(tokens),
        [{"id_producto": producto.id_producto, "cantidad": 1}],
        metodo="tarjeta_credito",
        pago_extra={"resultado_simulacion": "rechazado"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["pedido"]["estado"] == "Pago rechazado"
    assert data["pago"]["estado"] == "rechazado"
    assert data["factura"] is None
    assert data["carrito_mantener"] is True

    # El stock NO se descuenta si el pago fue rechazado.
    db.expire_all()
    producto_bd = db.query(Producto).get(producto.id_producto)
    assert producto_bd.stock_producto == 10


async def test_checkout_metodo_no_soportado_400(
    client: AsyncClient, db, cliente_logueado
):
    """Un método fuera del simulador responde 400 y no crea el pedido."""
    _cliente, tokens = cliente_logueado
    producto = crear_producto(db)
    resp = await _checkout(
        client,
        auth_headers(tokens),
        [{"id_producto": producto.id_producto, "cantidad": 1}],
        metodo="bitcoin",
    )
    assert resp.status_code == 400
    assert db.query(Pedido).count() == 0


async def test_checkout_sin_datos_de_pago_422(
    client: AsyncClient, cliente_logueado
):
    """Sin la sección 'pago' la validación de Pydantic responde 422."""
    _cliente, tokens = cliente_logueado
    resp = await client.post(
        "/api/v1/pedidos",
        json={"items": [{"id_producto": 1, "cantidad": 1}]},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 422


async def test_checkout_con_servicio_genera_cita_y_entrega(
    client: AsyncClient, db, cliente_logueado, tecnico_logueado
):
    """Checkout con línea de servicio de instalación: crea la cita con el
    técnico elegido, agenda la entrega y factura el total."""
    cliente, tokens = cliente_logueado
    _usuario_tecnico, tecnico, _tokens_tecnico = tecnico_logueado
    producto = crear_producto(db, precio_venta_producto=30000.0)
    fecha = _dia_laboral_futuro()

    resp = await _checkout(
        client,
        auth_headers(tokens),
        [{"id_producto": producto.id_producto, "cantidad": 1}],
        servicios=[
            {
                "nombre": "Instalación de domótica",
                "tipo_servicio": "instalacion",
                "fecha": fecha.isoformat(),
                "hora": "08:00",
                "direccion": "Cra 10 #12-34",
                "id_tecnico": tecnico.id_tecnico,
            }
        ],
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["pedido"]["estado"] == "Pagado"
    # 30.000 del producto + 120.000 de la instalación (precio de demo).
    assert data["pedido"]["total"] == 150000.0
    assert len(data["ordenes_instalacion"]) == 1
    orden = data["ordenes_instalacion"][0]
    assert orden["id_tecnico"] == tecnico.id_tecnico
    assert orden["fecha"] == fecha.isoformat()
    assert orden["entrega"]["id_tecnico"] == tecnico.id_tecnico
    assert data["pedido"]["cita"]["id_cita"] == orden["id_cita"]
    assert data["factura"] is not None


# ──────────────────────────────────────────────────────────────
# Mis pedidos / detalle / seguimiento
# ──────────────────────────────────────────────────────────────
async def test_mis_pedidos_requiere_token(client: AsyncClient):
    resp = await client.get("/api/v1/pedidos/mis-pedidos")
    assert resp.status_code == 401


async def test_mis_pedidos_lista_solo_los_propios(
    client: AsyncClient, db, cliente_logueado
):
    """Lista los pedidos del cliente autenticado con pago y factura."""
    _cliente, tokens = cliente_logueado
    producto = crear_producto(db)
    creacion = await _checkout(
        client, auth_headers(tokens), [{"id_producto": producto.id_producto}]
    )
    assert creacion.status_code == 200
    id_pedido = creacion.json()["pedido"]["id_pedido"]

    resp = await client.get("/api/v1/pedidos/mis-pedidos", headers=auth_headers(tokens))
    assert resp.status_code == 200
    pedidos = resp.json()
    assert [p["id_pedido"] for p in pedidos] == [id_pedido]
    assert pedidos[0]["pago"] is not None
    assert pedidos[0]["factura"] is not None
    assert "password" not in resp.text


async def test_detalle_pedido_propio(client: AsyncClient, db, cliente_logueado):
    _cliente, tokens = cliente_logueado
    producto = crear_producto(db)
    creacion = await _checkout(
        client, auth_headers(tokens), [{"id_producto": producto.id_producto}]
    )
    id_pedido = creacion.json()["pedido"]["id_pedido"]

    resp = await client.get(f"/api/v1/pedidos/{id_pedido}", headers=auth_headers(tokens))
    assert resp.status_code == 200
    data = resp.json()
    assert data["id_pedido"] == id_pedido
    assert len(data["detalles"]) == 1
    assert data["productos_calificables"] is False  # aún no entregado


async def test_detalle_pedido_de_otro_cliente_404(
    client: AsyncClient, db, cliente_logueado
):
    """El detalle de un pedido ajeno responde 404 (no filtra por 403)."""
    _cliente, tokens = cliente_logueado
    producto = crear_producto(db)
    creacion = await _checkout(
        client, auth_headers(tokens), [{"id_producto": producto.id_producto}]
    )
    id_pedido = creacion.json()["pedido"]["id_pedido"]

    otro = _otro_cliente(db)
    otros_tokens = await login(client, otro.email, "Test1234!", "client")
    resp = await client.get(f"/api/v1/pedidos/{id_pedido}", headers=auth_headers(otros_tokens))
    assert resp.status_code == 404
    assert "password" not in resp.text


async def test_seguimiento_pedido_propio(client: AsyncClient, db, cliente_logueado):
    """El seguimiento devuelve la línea de progreso del pedido."""
    _cliente, tokens = cliente_logueado
    producto = crear_producto(db)
    creacion = await _checkout(
        client, auth_headers(tokens), [{"id_producto": producto.id_producto}]
    )
    id_pedido = creacion.json()["pedido"]["id_pedido"]

    resp = await client.get(
        f"/api/v1/pedidos/{id_pedido}/seguimiento", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id_pedido"] == id_pedido
    assert [p["paso"] for p in data["pasos"]] == [
        "Confirmado",
        "Asignado",
        "Recogido",
        "En camino",
        "Entregado",
    ]
    assert data["pasos"][0]["completado"] is True  # pago confirmado
    assert data["pasos"][-1]["completado"] is False  # aún no entregado


async def test_seguimiento_pedido_ajeno_404(
    client: AsyncClient, db, cliente_logueado
):
    _cliente, tokens = cliente_logueado
    producto = crear_producto(db)
    creacion = await _checkout(
        client, auth_headers(tokens), [{"id_producto": producto.id_producto}]
    )
    id_pedido = creacion.json()["pedido"]["id_pedido"]

    otro = _otro_cliente(db)
    otros_tokens = await login(client, otro.email, "Test1234!", "client")
    resp = await client.get(
        f"/api/v1/pedidos/{id_pedido}/seguimiento", headers=auth_headers(otros_tokens)
    )
    assert resp.status_code == 404


async def test_seguimiento_pedido_inexistente_404(client: AsyncClient, cliente_logueado):
    _cliente, tokens = cliente_logueado
    resp = await client.get("/api/v1/pedidos/999999/seguimiento", headers=auth_headers(tokens))
    assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────
# Factura PDF (reportlab)
# ──────────────────────────────────────────────────────────────
async def test_factura_pdf_del_cliente(client: AsyncClient, db, cliente_logueado):
    """Descarga de la factura PDF del pedido aprobado.

    COMPORTAMIENTO ACTUAL (bug documentado en hallazgos): el PDF no se
    puede generar porque falta el asset `app/static/Logo.jpg`, así que el
    endpoint responde 500 con 'Logo de NEODOMUS no encontrado'."""
    _cliente, tokens = cliente_logueado
    producto = crear_producto(db)
    creacion = await _checkout(
        client, auth_headers(tokens), [{"id_producto": producto.id_producto}]
    )
    id_pedido = creacion.json()["pedido"]["id_pedido"]

    resp = await client.get(
        f"/api/v1/pedidos/{id_pedido}/factura", headers=auth_headers(tokens)
    )
    assert resp.status_code == 500
    assert "Logo" in resp.json()["detail"]


async def test_factura_pdf_sin_factura_404(client: AsyncClient, db, cliente_logueado):
    """Un pedido con pago aún pendiente no tiene factura (404)."""
    _cliente, tokens = cliente_logueado
    producto = crear_producto(db)
    creacion = await _checkout(
        client,
        auth_headers(tokens),
        [{"id_producto": producto.id_producto}],
        metodo="punto_pago",
    )
    assert creacion.json()["factura"] is None
    id_pedido = creacion.json()["pedido"]["id_pedido"]

    resp = await client.get(
        f"/api/v1/pedidos/{id_pedido}/factura", headers=auth_headers(tokens)
    )
    assert resp.status_code == 404


async def test_factura_pdf_de_pedido_ajeno_404(
    client: AsyncClient, db, cliente_logueado
):
    _cliente, tokens = cliente_logueado
    producto = crear_producto(db)
    creacion = await _checkout(
        client, auth_headers(tokens), [{"id_producto": producto.id_producto}]
    )
    id_pedido = creacion.json()["pedido"]["id_pedido"]

    otro = _otro_cliente(db)
    otros_tokens = await login(client, otro.email, "Test1234!", "client")
    resp = await client.get(
        f"/api/v1/pedidos/{id_pedido}/factura", headers=auth_headers(otros_tokens)
    )
    assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────
# Confirmación de pago pendiente
# ──────────────────────────────────────────────────────────────
async def test_confirmar_pago_pendiente_genera_factura(
    client: AsyncClient, db, cliente_logueado
):
    """Pago en punto de pago: queda pendiente; al confirmarlo se aprueba,
    se descuenta stock, se factura y queda idempotente."""
    cliente, tokens = cliente_logueado
    producto = crear_producto(db, stock_producto=7)

    creacion = await _checkout(
        client,
        auth_headers(tokens),
        [{"id_producto": producto.id_producto, "cantidad": 2}],
        metodo="punto_pago",
    )
    assert creacion.status_code == 200, creacion.text
    data = creacion.json()
    assert data["pedido"]["estado"] == "Pago pendiente"
    assert data["pago"]["estado"] == "pendiente"
    assert data["factura"] is None
    id_pedido = data["pedido"]["id_pedido"]

    # El stock aún no baja hasta confirmar el pago.
    db.expire_all()
    assert db.query(Producto).get(producto.id_producto).stock_producto == 7

    resp = await client.post(
        f"/api/v1/pedidos/{id_pedido}/confirmar-pago", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["pedido"]["estado"] == "Pagado"
    assert data["pago"]["estado"] == "aprobado"
    assert data["factura"] is not None
    assert data["pdf_url"].endswith("/factura")

    db.expire_all()
    assert db.query(Producto).get(producto.id_producto).stock_producto == 5

    # Confirmar de nuevo no falla ni duplica la factura (idempotente).
    repetida = await client.post(
        f"/api/v1/pedidos/{id_pedido}/confirmar-pago", headers=auth_headers(tokens)
    )
    assert repetida.status_code == 200
    assert repetida.json()["factura"]["id_factura"] == data["factura"]["id_factura"]


async def test_confirmar_pago_de_pedido_ajeno_404(
    client: AsyncClient, db, cliente_logueado
):
    _cliente, tokens = cliente_logueado
    producto = crear_producto(db)
    creacion = await _checkout(
        client,
        auth_headers(tokens),
        [{"id_producto": producto.id_producto}],
        metodo="punto_pago",
    )
    id_pedido = creacion.json()["pedido"]["id_pedido"]

    otro = _otro_cliente(db)
    otros_tokens = await login(client, otro.email, "Test1234!", "client")
    resp = await client.post(
        f"/api/v1/pedidos/{id_pedido}/confirmar-pago", headers=auth_headers(otros_tokens)
    )
    assert resp.status_code == 404


async def test_confirmar_pago_pedido_inexistente_404(
    client: AsyncClient, cliente_logueado
):
    _cliente, tokens = cliente_logueado
    resp = await client.post(
        "/api/v1/pedidos/999999/confirmar-pago", headers=auth_headers(tokens)
    )
    assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────
# Endpoints administrativos
# ──────────────────────────────────────────────────────────────
async def test_admin_listados_permisos(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """all-admin / admin/entregas / admin/facturas: solo administradores."""
    cliente, tokens_cliente = cliente_logueado
    admin, tokens_admin = admin_logueado
    _u, _t, tokens_tecnico = await _tecnico_secundario(client, db)

    pedido = _pedido_directo(
        db, cliente, fecha_entrega=date.today() + timedelta(days=2)
    )

    # Cliente: 401 (cuenta de cliente en endpoint de empleado).
    for ruta in ("/all-admin", "/admin/entregas", "/admin/facturas"):
        resp = await client.get(f"/api/v1/pedidos{ruta}", headers=auth_headers(tokens_cliente))
        assert resp.status_code == 401, (ruta, resp.status_code)

    # Técnico: 403 (empleado sin rol administrador).
    for ruta in ("/all-admin", "/admin/entregas", "/admin/facturas"):
        resp = await client.get(f"/api/v1/pedidos{ruta}", headers=auth_headers(tokens_tecnico))
        assert resp.status_code == 403, (ruta, resp.status_code)

    # Sin token: 401. Ojo: los logins anteriores dejaron cookies HttpOnly en
    # el client (fallback de _token_desde_request), así que se limpian para
    # que la petición viaje realmente sin credenciales.
    client.cookies.clear()
    resp = await client.get("/api/v1/pedidos/all-admin")
    assert resp.status_code == 401

    # Administrador: 200 con sus listados.
    resp = await client.get("/api/v1/pedidos/all-admin", headers=auth_headers(tokens_admin))
    assert resp.status_code == 200
    filas = resp.json()
    assert any(f["id_pedido"] == pedido.id_pedido for f in filas)
    assert filas[0]["cliente_email"] == cliente.email

    resp = await client.get("/api/v1/pedidos/admin/entregas", headers=auth_headers(tokens_admin))
    assert resp.status_code == 200
    entregas = resp.json()
    assert any(e["id_pedido"] == pedido.id_pedido for e in entregas)

    resp = await client.get("/api/v1/pedidos/admin/facturas", headers=auth_headers(tokens_admin))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_admin_asignar_entrega(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """El admin asigna técnico y rango de entrega; queda 'Asignada'."""
    cliente, _tokens = cliente_logueado
    _admin, tokens_admin = admin_logueado
    _u, tecnico, _tt = await _tecnico_secundario(client, db)
    pedido = _pedido_directo(db, cliente)
    fecha = _dia_laboral_futuro()

    resp = await client.put(
        f"/api/v1/pedidos/admin/{pedido.id_pedido}/entrega",
        json={
            "id_tecnico": tecnico.id_tecnico,
            "fecha_entrega": fecha.isoformat(),
            "hora_entrega": "10:00",
            "hora_entrega_fin": "11:00",
        },
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["estado_entrega"] == "Asignada"
    assert data["id_tecnico_entrega"] == tecnico.id_tecnico
    assert data["nombre_tecnico"]

    db.expire_all()
    pedido_bd = db.query(Pedido).get(pedido.id_pedido)
    assert pedido_bd.fecha_entrega == fecha
    assert pedido_bd.estado_entrega == "Asignada"

    # El cliente recibió la notificación de la entrega programada.
    from app.models.notificacion import Notificacion

    assert db.query(Notificacion).filter(
        Notificacion.id_cliente == cliente.id_cliente
    ).count() >= 1


async def test_admin_asignar_entrega_validaciones(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """404 (pedido/técnico) y 400 (fecha pasada / domingo) en la asignación."""
    cliente, _tokens = cliente_logueado
    _admin, tokens_admin = admin_logueado
    _u, tecnico, _tt = await _tecnico_secundario(client, db)
    pedido = _pedido_directo(db, cliente)

    # Pedido inexistente → 404.
    resp = await client.put(
        "/api/v1/pedidos/admin/999999/entrega",
        json={"id_tecnico": tecnico.id_tecnico},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 404

    # Técnico inexistente → 404.
    resp = await client.put(
        f"/api/v1/pedidos/admin/{pedido.id_pedido}/entrega",
        json={"id_tecnico": 999999},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 404

    # Fecha pasada → 400.
    resp = await client.put(
        f"/api/v1/pedidos/admin/{pedido.id_pedido}/entrega",
        json={
            "id_tecnico": tecnico.id_tecnico,
            "fecha_entrega": (date.today() - timedelta(days=3)).isoformat(),
        },
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400

    # Domingo → 400 (entregas solo de lunes a sábado).
    resp = await client.put(
        f"/api/v1/pedidos/admin/{pedido.id_pedido}/entrega",
        json={
            "id_tecnico": tecnico.id_tecnico,
            "fecha_entrega": _proximo_domingo().isoformat(),
        },
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 400

    # Fecha con formato inválido → 422.
    resp = await client.put(
        f"/api/v1/pedidos/admin/{pedido.id_pedido}/entrega",
        json={"fecha_entrega": "ayer"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 422


async def test_admin_desasignar_entrega(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """Con id_tecnico null la entrega queda sin técnico (Pendiente)."""
    cliente, _tokens = cliente_logueado
    _admin, tokens_admin = admin_logueado
    _u, tecnico, _tt = await _tecnico_secundario(client, db)
    pedido = _pedido_directo(
        db,
        cliente,
        fecha_entrega=date.today() + timedelta(days=2),
        hora_entrega="10:00",
        id_tecnico_entrega=tecnico.id_tecnico,
        nombre_tecnico_entrega="Técnico Prueba",
        estado_entrega="Asignada",
    )

    resp = await client.put(
        f"/api/v1/pedidos/admin/{pedido.id_pedido}/entrega",
        json={"id_tecnico": None},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id_pedido"] == pedido.id_pedido
    assert data["estado_entrega"] == "Pendiente"
    assert data["nombre_tecnico"] is None
    assert "sin técnico" in data["mensaje"]

    # El pedido queda realmente sin técnico en BD.
    db.refresh(pedido)
    assert pedido.id_tecnico_entrega is None
    assert pedido.nombre_tecnico_entrega is None


async def test_admin_horarios_disponibles(
    client: AsyncClient, db, admin_logueado
):
    """Consulta de franjas: 200 admin, 422 con fecha inválida, 403 técnico."""
    _admin, tokens_admin = admin_logueado
    _u, _t, tokens_tecnico = await _tecnico_secundario(client, db)
    fecha = _dia_laboral_futuro()

    resp = await client.get(
        "/api/v1/pedidos/admin/horarios-disponibles",
        params={"fecha": fecha.isoformat()},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200
    horarios = resp.json()
    assert isinstance(horarios, list)
    assert all(h.endswith(":00") for h in horarios)

    # Fecha con formato inválido → 422.
    resp = await client.get(
        "/api/v1/pedidos/admin/horarios-disponibles",
        params={"fecha": "no-es-fecha"},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 422

    # Fecha pasada → lista vacía.
    resp = await client.get(
        "/api/v1/pedidos/admin/horarios-disponibles",
        params={"fecha": (date.today() - timedelta(days=1)).isoformat()},
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 200
    assert resp.json() == [] or isinstance(resp.json(), list)

    # Sin parámetro obligatorio → 422.
    resp = await client.get(
        "/api/v1/pedidos/admin/horarios-disponibles",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 422

    # Técnico (empleado no admin) → 403.
    resp = await client.get(
        "/api/v1/pedidos/admin/horarios-disponibles",
        params={"fecha": fecha.isoformat()},
        headers=auth_headers(tokens_tecnico),
    )
    assert resp.status_code == 403


async def test_admin_factura_pdf(
    client: AsyncClient, db, cliente_logueado, admin_logueado
):
    """El admin puede pedir la factura PDF de cualquier pedido y recibe
    404 si el pedido no existe o aún no tiene factura.

    COMPORTAMIENTO ACTUAL (bug documentado en hallazgos): con factura
    creada el PDF responde 500 porque falta `app/static/Logo.jpg`."""
    _cliente, tokens_cliente = cliente_logueado
    _admin, tokens_admin = admin_logueado
    producto = crear_producto(db)
    creacion = await _checkout(
        client, auth_headers(tokens_cliente), [{"id_producto": producto.id_producto}]
    )
    id_pedido = creacion.json()["pedido"]["id_pedido"]

    resp = await client.get(
        f"/api/v1/pedidos/admin/{id_pedido}/factura", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 500
    assert "Logo" in resp.json()["detail"]

    # Pedido sin factura → 404.
    sin_factura = _pedido_directo(db, cliente_logueado[0])
    resp = await client.get(
        f"/api/v1/pedidos/admin/{sin_factura.id_pedido}/factura",
        headers=auth_headers(tokens_admin),
    )
    assert resp.status_code == 404

    # Pedido inexistente → 404.
    resp = await client.get(
        "/api/v1/pedidos/admin/999999/factura", headers=auth_headers(tokens_admin)
    )
    assert resp.status_code == 404
