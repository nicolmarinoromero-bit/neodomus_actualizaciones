"""
Pruebas de integración de extremo a extremo: cliente -> API -> backend ->
SQLAlchemy -> MySQL real (sin mocks de lógica de negocio).

Recorrido principal (test largo):

  registro de cliente → código en `pending_registrations` → verificación de
  correo → login (JWT) → endpoint protegido → admin crea producto con
  categoría → cliente agenda cita con técnico → estado verificado en BD →
  admin finaliza la cita → cliente califica → el admin ve los recursos y los
  permisos se respetan.

Flujos secundarios: checkout de pedido con items (stock y pago en BD),
alta de producto solo por administrador, catálogo de especializaciones con
asociación N:M técnico↔especialización, seguridad del registro y aislamiento
de citas entre clientes.

Solo se usan endpoints que existen en `be/app/routers/` (ver
`grep "@router." be/app/routers/*.py`).
"""

from __future__ import annotations

import itertools
from datetime import date, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import text

from app.models.cita import Cita
from app.models.calificacion import Calificacion
from app.models.cliente import Cliente
from app.models.especializacion import Especializacion
from app.models.pago import Pago
from app.models.pedido import DetallePedido, Pedido
from app.models.pending_registration import PendingRegistration
from app.models.producto import Producto
from app.models.tarifa_servicio import TarifaServicio
from app.tests.factories import (
    auth_headers,
    crear_categoria,
    crear_cliente,
    crear_empleado,
    crear_producto,
    crear_tecnico,
    login,
)


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────
def _fecha_laboral_futura() -> date:
    """Mañana (más de 3 h de anticipación); si cae domingo, salta al lunes."""
    fecha = date.today() + timedelta(days=1)
    while fecha.weekday() == 6:  # domingo bloqueado
        fecha += timedelta(days=1)
    return fecha


def _payload_registro(email: str, documento: int = 3100000001) -> dict:
    return {
        "first_name": "Flujo",
        "last_name": "Integracion",
        "email": email,
        "password": "Secret123!",
        "id_tipo_documento_c": 1,
        "documento_cliente": documento,
        "telefono_cliente": 3001234001,
        "address": "Cra 7 #8-9",
    }


def _payload_producto(id_categoria: int, nombre: str = "Producto del flujo") -> dict:
    return {
        "nombre_producto": nombre,
        "precio_compra_producto": 10000.0,
        "precio_venta_producto": 25000.0,
        "stock_producto": 20,
        "id_cate_pr": id_categoria,
        "descripcion_producto": "Creado por el administrador",
    }


_nuevo = itertools.count(1)


def _tecnico_unico(db):
    """Técnico con usuario de email único.

    Las factories derivan el email del `hash(str(kwargs))`; con kwargs
    vacías todos los empleados comparten el mismo email y chocan con el
    UNIQUE `usuarios.email` (p. ej. contra el admin del fixture
    `admin_logueado`). Ver
    be/app/tests/hallazgos/bd_migraciones_integracion.md.
    """
    n = next(_nuevo)
    usuario = crear_empleado(
        db, rol="tecnico", email=f"tecnico.flujo{n}@test.neodomus.com"
    )
    return crear_tecnico(db, usuario=usuario)


# ──────────────────────────────────────────────────────────────
# Flujo principal
# ──────────────────────────────────────────────────────────────
async def test_flujo_completo_registro_cita_calificacion_y_permisos(
    client: AsyncClient, db, admin_logueado
):
    """Recorrido completo de un cliente: registro → verificación de correo →
    login → agenda una cita con técnico → el admin la finaliza → el cliente
    la califica → el admin la consulta. Cada paso se verifica tanto por la
    API como directamente en MySQL con la sesión `db`."""
    admin, admin_tokens = admin_logueado
    admin_h = auth_headers(admin_tokens)
    email = "flujo.completo@test.neodomus.com"

    # ── 1) Registro de cliente: queda PENDIENTE, no activo ──
    resp = await client.post(
        "/api/v1/auth/register/client", json=_payload_registro(email)
    )
    assert resp.status_code == 200, resp.text

    pendiente = (
        db.query(PendingRegistration).filter(PendingRegistration.email == email).first()
    )
    assert pendiente is not None, "El registro debe quedar en pending_registrations"
    assert len(pendiente.code) == 6
    assert pendiente.expires_at > datetime.utcnow()
    assert db.query(Cliente).filter(Cliente.email == email).first() is None

    # ── 2) Código de verificación leído de la tabla pending_registrations ──
    codigo = pendiente.code
    resp = await client.post(f"/api/v1/auth/verify-email?code={codigo}")
    assert resp.status_code == 200, resp.text

    cliente = db.query(Cliente).filter(Cliente.email == email).first()
    assert cliente is not None, "La verificación crea el cliente real"
    assert cliente.is_active is True
    assert cliente.documento_cliente == 3100000001
    assert db.query(PendingRegistration).filter(
        PendingRegistration.email == email
    ).first() is None

    # ── 3) Login real: devuelve JWT sin filtrar hash ni contraseña ──
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Secret123!", "user_type": "client"},
    )
    assert resp.status_code == 200, resp.text
    tokens = resp.json()
    assert tokens["token_type"] == "bearer"
    assert tokens["user_type"] == "client"
    assert tokens["access_token"] and tokens["refresh_token"]
    # El cuerpo solo expone los campos de sesión; ni la contraseña ni el hash
    # deben aparecer entre las claves de la respuesta (verificado sobre el
    # JSON, no sobre el texto, porque el payload contiene claves como
    # `password_reset_required`).
    assert "password" not in tokens and "password_hash" not in tokens
    assert "access_token" in tokens and "refresh_token" in tokens
    cliente_h = auth_headers(tokens)

    # ── 4) Endpoint protegido con el JWT ──
    resp = await client.get("/api/v1/auth/session", headers=cliente_h)
    assert resp.status_code == 200
    assert resp.json()["rol"] == "cliente"
    assert str(resp.json()["uid"]) == str(cliente.id_cliente)

    # ── 5) Catálogos que la API no da de alta (tarifas/categorías) ──
    #      y ficha del técnico: se siembran en BD con las factories.
    db.add(
        TarifaServicio(
            tipo_servicio="instalacion",
            costo=120000,
            descripcion="Instalación de prueba",
        )
    )
    db.commit()
    categoria = crear_categoria(db, nombre_categoria="Categoría del flujo")
    tecnico = _tecnico_unico(db)
    tec_h = auth_headers(await login(client, tecnico.usuario.email, "Test1234!", "employee"))

    # ── 6) El administrador crea el producto con la categoría ──
    resp = await client.post(
        "/api/v1/productos",
        json=_payload_producto(categoria.id_categoria),
        headers=admin_h,
    )
    assert resp.status_code == 200, resp.text
    producto_resp = resp.json()
    assert producto_resp["id_producto"] > 0
    assert producto_resp["nombre_categoria"] == "Categoría del flujo"

    # El catálogo de categorías también se expone en la API.
    resp = await client.get("/api/v1/productos/categorias")
    assert resp.status_code == 200
    assert any(c["id_categoria"] == categoria.id_categoria for c in resp.json())

    # El producto es visible en el catálogo público (sin token).
    resp = await client.get("/api/v1/productos/?search=Producto del flujo")
    assert resp.status_code == 200
    assert any(
        p["id_producto"] == producto_resp["id_producto"] for p in resp.json()["data"]
    )

    # ── 7) El cliente agenda una cita con el técnico ──
    fecha = _fecha_laboral_futura()
    resp = await client.post(
        "/api/v1/citas",
        json={
            "id_tecnico": tecnico.id_tecnico,
            "tipo_servicio": "instalacion",
            "fecha": fecha.isoformat(),
            "hora": "11:00",
            "direccion": "Cra 7 #8-9",
            "descripcion": "Instalación de prueba",
            "metodo_pago": "paypal",
            "datos_pago": {"correo_paypal": email},
        },
        headers=cliente_h,
    )
    assert resp.status_code == 200, resp.text
    cita_resp = resp.json()
    assert cita_resp["estado"] == "Confirmada"

    # ── 8) Estado real en MySQL ──
    cita = db.query(Cita).filter(Cita.id_cita == cita_resp["id_cita"]).first()
    assert cita is not None
    assert cita.id_cliente == cliente.id_cliente
    assert cita.id_tecnico == tecnico.id_tecnico
    assert cita.estado == "Confirmada"
    assert cita.estado_pago == "aprobado"
    assert cita.metodo_pago == "paypal"
    assert cita.numero_transaccion
    assert float(cita.costo_cita) == 120000.0
    assert cita.fecha == fecha and cita.hora == "11:00"

    # ── 9) El administrador finaliza la cita ──
    resp = await client.put(
        f"/api/v1/citas/admin/{cita.id_cita}",
        json={"estado": "Finalizada"},
        headers=admin_h,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "Finalizada"
    db.expire_all()
    assert db.query(Cita).get(cita.id_cita).estado == "Finalizada"

    # ── 10) El cliente califica la cita finalizada ──
    resp = await client.post(
        "/api/v1/calificaciones",
        json={"id_cita": cita.id_cita, "calificacion": 5, "comentario": "Excelente"},
        headers=cliente_h,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["id_calificacion"] > 0

    calificacion = (
        db.query(Calificacion).filter(Calificacion.id_cita_c == cita.id_cita).first()
    )
    assert calificacion is not None
    assert calificacion.id_cliente_c == cliente.id_cliente
    assert calificacion.id_tecnico_c == tecnico.id_tecnico
    assert calificacion.calificacion == 5

    # ── 11) El admin ve el recurso (listados y promedio) ──
    resp = await client.get("/api/v1/citas/all-admin", headers=admin_h)
    assert resp.status_code == 200
    assert any(c["id_cita"] == cita.id_cita for c in resp.json())

    resp = await client.get(f"/api/v1/calificaciones/tecnico/{tecnico.id_tecnico}")
    assert resp.status_code == 200
    assert resp.json()["promedio"] == 5.0
    assert resp.json()["total"] == 1

    # ── 12) Autorización ──
    # Cliente con JWT sobre un endpoint de empleado: 401 por diseño (ver
    # be/app/tests/hallazgos/bd_migraciones_integracion.md).
    resp = await client.get("/api/v1/citas/all-admin", headers=cliente_h)
    assert resp.status_code == 401
    # Empleado sin rol administrador sobre un endpoint solo-admin: 403.
    resp = await client.put(
        f"/api/v1/citas/admin/{cita.id_cita}",
        json={"estado": "Cancelada"},
        headers=tec_h,
    )
    assert resp.status_code == 403
    # Sin token (y sin cookies de sesión): 401.
    # HALLAZGO: el login escribe cookies HttpOnly que el cliente httpx
    # reenvía; sin este `clear()` la petición "anónima" viaja con la cookie
    # del último login (el del técnico) y responde 403 en vez de 401.
    client.cookies.clear()
    resp = await client.get("/api/v1/citas/all-admin")
    assert resp.status_code == 401
    # La cita no cambió por los intentos denegados.
    db.expire_all()
    assert db.query(Cita).get(cita.id_cita).estado == "Finalizada"


# ──────────────────────────────────────────────────────────────
# Flujos secundarios
# ──────────────────────────────────────────────────────────────
async def test_flujo_checkout_pedido_con_items_y_stock(
    client: AsyncClient, db, admin_logueado, cliente_logueado
):
    """Checkout completo: el cliente paga con el simulador, el pedido, los
    detalles, el pago y la factura quedan en MySQL y el stock baja."""
    _, admin_tokens = admin_logueado
    cliente, tokens = cliente_logueado
    cliente_h = auth_headers(tokens)

    producto = crear_producto(
        db,
        nombre_producto="Producto checkout",
        referencia_producto="REF-CHECKOUT",
        stock_producto=30,
    )
    stock_inicial = producto.stock_producto

    resp = await client.post(
        "/api/v1/pedidos",
        json={
            "items": [{"id_producto": producto.id_producto, "cantidad": 2}],
            "servicios": [],
            "pago": {"metodo": "paypal", "correo_paypal": cliente.email},
        },
        headers=cliente_h,
    )
    assert resp.status_code == 200, resp.text
    cuerpo = resp.json()
    assert cuerpo["pedido"]["estado"] == "Pagado"
    assert cuerpo["pago"]["estado"] == "aprobado"
    assert cuerpo["factura"]["numero_factura"].startswith("FAC-")

    db.expire_all()
    pedido = (
        db.query(Pedido).filter(Pedido.id_cliente_pe == cliente.id_cliente).first()
    )
    assert pedido is not None
    assert pedido.estado_pedido == "Pagado"
    assert float(pedido.total_pedido) == 40000.0  # 2 x 20000

    detalles = (
        db.query(DetallePedido)
        .filter(DetallePedido.id_pedido_d == pedido.id_pedido)
        .all()
    )
    assert len(detalles) == 1
    assert detalles[0].id_producto_d == producto.id_producto
    assert detalles[0].cantidad_detalle == 2

    pago = db.query(Pago).filter(Pago.id_pedido == pedido.id_pedido).first()
    assert pago is not None
    assert pago.estado == "aprobado"
    assert float(pago.monto) == 40000.0
    assert pago.numero_transaccion

    db.expire_all()
    assert (
        db.query(Producto).get(producto.id_producto).stock_producto
        == stock_inicial - 2
    )

    # El cliente ve su pedido en mis-pedidos…
    resp = await client.get("/api/v1/pedidos/mis-pedidos", headers=cliente_h)
    assert resp.status_code == 200
    assert any(p["id_pedido"] == pedido.id_pedido for p in resp.json())

    # …y el administrador lo ve en el listado admin.
    resp = await client.get(
        "/api/v1/pedidos/all-admin", headers=auth_headers(admin_tokens)
    )
    assert resp.status_code == 200
    assert any(
        p["id_pedido"] == pedido.id_pedido and p["estado"] == "Pagado"
        for p in resp.json()
    )

    # Un cliente no puede usar el listado de administrador (401 actual).
    resp = await client.get("/api/v1/pedidos/all-admin", headers=cliente_h)
    assert resp.status_code == 401


async def test_flujo_producto_solo_lo_crea_el_admin(
    client: AsyncClient, db, admin_logueado, cliente_logueado
):
    """Alta de producto: admin 200, técnico (empleado no admin) 403,
    cliente 401 y anónimo 401."""
    admin, admin_tokens = admin_logueado
    cliente, cliente_tokens = cliente_logueado
    categoria = crear_categoria(db, nombre_categoria="Categoría admin")
    payload = _payload_producto(categoria.id_categoria, nombre="Producto protegido")

    # Sin token y con token de cliente: 401 (cuenta de cliente en un
    # endpoint de empleado — comportamiento actual documentado).
    resp = await client.post("/api/v1/productos", json=payload)
    assert resp.status_code == 401
    resp = await client.post(
        "/api/v1/productos", json=payload, headers=auth_headers(cliente_tokens)
    )
    assert resp.status_code == 401

    # Empleado con rol técnico: 403 (rol insuficiente).
    tecnico = _tecnico_unico(db)
    tec_h = auth_headers(await login(client, tecnico.usuario.email, "Test1234!", "employee"))
    resp = await client.post("/api/v1/productos", json=payload, headers=tec_h)
    assert resp.status_code == 403

    # Ninguno de los anteriores creó el producto.
    assert db.query(Producto).filter(Producto.nombre_producto == "Producto protegido").count() == 0

    # El administrador sí puede.
    resp = await client.post(
        "/api/v1/productos", json=payload, headers=auth_headers(admin_tokens)
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["id_producto"] > 0

    db.expire_all()
    creado = (
        db.query(Producto).filter(Producto.nombre_producto == "Producto protegido").first()
    )
    assert creado is not None
    assert creado.id_cate_pr == categoria.id_categoria
    assert creado.estado_producto == "activo"


async def test_flujo_especializaciones_admin_crea_y_tecnico_se_asigna(
    client: AsyncClient, db, admin_logueado
):
    """N:M técnico↔especialización vía API: el admin crea el catálogo y el
    técnico se asigna una especialización; la fila de la tabla asociativa
    se verifica directamente en MySQL.

    El técnico se crea aquí con email único: los fixtures `admin_logueado`
    y `tecnico_logueado` no pueden combinarse (colisión en el UNIQUE
    `usuarios.email`, ver hallazgos)."""
    _, admin_tokens = admin_logueado
    admin_h = auth_headers(admin_tokens)
    ficha_tecnico = _tecnico_unico(db)
    tec_h = auth_headers(
        await login(client, ficha_tecnico.usuario.email, "Test1234!", "employee")
    )

    resp = await client.post(
        "/api/v1/especializaciones",
        json={"nombre": "Iluminación LED", "descripcion": "Instalación de tiras"},
        headers=admin_h,
    )
    assert resp.status_code == 200, resp.text
    esp_id = resp.json()["id_especializacion"]

    # Un cliente no puede ampliar el catálogo. Se limpian las cookies para
    # que la petición sea realmente anónima (mismo hallazgo del login con
    # cookies HttpOnly descrito arriba).
    client.cookies.clear()
    resp = await client.post(
        "/api/v1/especializaciones", json={"nombre": "Cliente LED"}
    )
    assert resp.status_code == 401

    # El técnico se la agrega a su ficha.
    resp = await client.post(
        f"/api/v1/tecnicos/mis-especializaciones/{esp_id}", headers=tec_h
    )
    assert resp.status_code == 200, resp.text
    assert any(
        e["id_especializacion"] == esp_id for e in resp.json()["especializaciones"]
    )

    # La fila N:M existe en MySQL.
    filas = db.execute(
        text(
            "SELECT COUNT(*) FROM tecnico_especializacion "
            "WHERE id_tecnico = :t AND id_especializacion = :e"
        ),
        {"t": ficha_tecnico.id_tecnico, "e": esp_id},
    ).scalar()
    assert int(filas) == 1

    # Repetir la asignación devuelve 400 (ya la tiene).
    resp = await client.post(
        f"/api/v1/tecnicos/mis-especializaciones/{esp_id}", headers=tec_h
    )
    assert resp.status_code == 400

    # El catálogo es público y muestra al técnico asignado.
    resp = await client.get("/api/v1/especializaciones")
    assert resp.status_code == 200
    publicada = next(
        (e for e in resp.json() if e["id_especializacion"] == esp_id), None
    )
    assert publicada is not None
    assert publicada["tecnicos_count"] == 1

    # La especialización quedó vinculada en la sesión de BD.
    db.expire_all()
    recargado = db.query(Especializacion).get(esp_id)
    assert recargado.nombre == "Iluminación LED"


async def test_flujo_registro_seguro_codigo_invalido_y_email_duplicado(
    client: AsyncClient, db
):
    """Registro: código inválido no activa la cuenta, el login sin verificar
    se rechaza y el email ya verificado no se puede volver a registrar."""
    email = "flujo.seguro@test.neodomus.com"

    resp = await client.post(
        "/api/v1/auth/register/client",
        json=_payload_registro(email, documento=3100000007),
    )
    assert resp.status_code == 200, resp.text
    pendiente = (
        db.query(PendingRegistration).filter(PendingRegistration.email == email).first()
    )
    assert pendiente is not None
    codigo_original = pendiente.code

    # Login sin verificar → 403.
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Secret123!", "user_type": "client"},
    )
    assert resp.status_code == 403
    assert "verificado" in resp.json()["detail"].lower()

    # Código incorrecto → 400 y el pendiente sigue intacto.
    resp = await client.post("/api/v1/auth/verify-email?code=000000")
    assert resp.status_code == 400
    db.expire_all()
    sigue = (
        db.query(PendingRegistration).filter(PendingRegistration.email == email).first()
    )
    assert sigue is not None and sigue.code == codigo_original
    assert db.query(Cliente).filter(Cliente.email == email).count() == 0

    # Código correcto → cliente activo.
    resp = await client.post(f"/api/v1/auth/verify-email?code={codigo_original}")
    assert resp.status_code == 200, resp.text
    db.expire_all()
    assert db.query(Cliente).filter(Cliente.email == email).count() == 1

    # Re-registrar el mismo email ya verificado → 400.
    resp = await client.post(
        "/api/v1/auth/register/client",
        json=_payload_registro(email, documento=3100000008),
    )
    assert resp.status_code == 400
    assert "registrado" in resp.json()["detail"].lower()


async def test_flujo_cliente_no_ve_ni_edita_citas_ajenas(
    client: AsyncClient, db, cliente_logueado
):
    """Aislamiento por cliente: mis-citas solo lista las propias y editar la
    cita de otro cliente responde 404 sin tocar la fila."""
    cliente, tokens = cliente_logueado
    cliente_h = auth_headers(tokens)

    ajeno = crear_cliente(db, email="cita.ajena@test.neodomus.com")
    cita_ajena = Cita(
        id_cliente=ajeno.id_cliente,
        tipo_servicio="reparacion",
        fecha=date.today() + timedelta(days=2),
        hora="14:00",
        direccion="Av 1 #2-3",
        estado="Confirmada",
    )
    db.add(cita_ajena)
    db.commit()
    db.refresh(cita_ajena)
    db.commit()

    # La cita ajena NO aparece en mis-citas.
    resp = await client.get("/api/v1/citas/mis-citas", headers=cliente_h)
    assert resp.status_code == 200
    ids = [c["id_cita"] for c in resp.json()]
    assert cita_ajena.id_cita not in ids
    assert cliente.id_cliente != ajeno.id_cliente

    # Editar directamente la cita ajena → 404 y la fila queda igual.
    resp = await client.put(
        f"/api/v1/citas/{cita_ajena.id_cita}",
        json={"descripcion": "intento de edición ajena"},
        headers=cliente_h,
    )
    assert resp.status_code == 404
    db.expire_all()
    assert (
        db.query(Cita).get(cita_ajena.id_cita).descripcion != "intento de edición ajena"
    )
