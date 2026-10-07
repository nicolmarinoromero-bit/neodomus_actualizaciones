"""
Pruebas del router de clientes (`be/app/routers/clientes.py`, prefijo
real `/api/v1/clients`): listado (solo admin), perfil propio, edición,
foto, habilitar/inhabilitar, historiales de pedidos/servicios/devoluciones
y solicitudes de cuenta.

Comportamiento real que se deja documentado:

* el prefijo del router es `/clients` (no `/clientes`);
* token de cliente en endpoint de admin → 401 (no 403);
* token de técnico en endpoint de admin → 403;
* una cuenta inhabilitada no puede autenticarse, por lo que la rama
  "habilitar" de `POST /clients/me/cuenta-solicitud` no es alcanzable
  desde este endpoint (ver hallazgos).
"""

from __future__ import annotations

from httpx import AsyncClient

from app.models.pedido import Pedido
from app.models.solicitud_cuenta import SolicitudCuenta
from app.tests.factories import auth_headers, crear_cliente, crear_empleado

CLAVES_SENSIBLES = {"password", "password_hash", "secret", "token",
                    "access_token", "refresh_token"}

RUTA = "/api/v1/clients"


def _claves(obj, camino=""):
    """Devuelve todas las claves (con su ruta) de un JSON anidado."""
    encontradas = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            encontradas.append(f"{camino}.{k}" if camino else k)
            encontradas.extend(_claves(v, f"{camino}.{k}" if camino else k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            encontradas.extend(_claves(v, f"{camino}[{i}]"))
    return encontradas


def _sin_campos_sensibles(json) -> None:
    """Falla si el JSON contiene claves sensibles o un hash bcrypt."""
    prohibidas = [c for c in _claves(json) if c.split(".")[-1].lower() in CLAVES_SENSIBLES]
    assert not prohibidas, f"La respuesta expone claves sensibles: {prohibidas}"
    assert "$2b$" not in str(json), "La respuesta expone un hash de contraseña"


# ──────────────────────────────────────────────────────────────
# GET /clients — listado (solo admin)
# ──────────────────────────────────────────────────────────────
async def test_listar_clientes_sin_token_devuelve_401(client: AsyncClient):
    resp = await client.get(RUTA)
    assert resp.status_code == 401


async def test_listar_clientes_con_token_de_cliente_devuelve_401(
    client: AsyncClient, cliente_logueado
):
    """Un cliente no puede listar a los clientes: 401 (cuenta de otro tipo)."""
    _, tokens = cliente_logueado
    resp = await client.get(RUTA, headers=auth_headers(tokens))
    assert resp.status_code == 401


async def test_listar_clientes_con_token_de_tecnico_devuelve_403(
    client: AsyncClient, tecnico_logueado
):
    _, _, tokens = tecnico_logueado
    resp = await client.get(RUTA, headers=auth_headers(tokens))
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Permisos insuficientes"


async def test_listar_clientes_como_admin_devuelve_conteos(
    client: AsyncClient, db, admin_logueado
):
    """El admin lista clientes con pedidos_count, citas_count y created_at."""
    _, tokens = admin_logueado
    crear_cliente(db, email="uno@neodomus.test.com")
    crear_cliente(db, email="dos@neodomus.test.com")

    resp = await client.get(RUTA, headers=auth_headers(tokens))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    for fila in data:
        assert fila["pedidos_count"] == 0
        assert fila["citas_count"] == 0
        assert fila["created_at"] is not None
    _sin_campos_sensibles(data)


async def test_listar_clientes_sin_registros_devuelve_lista_vacia(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.get(RUTA, headers=auth_headers(tokens))
    assert resp.status_code == 200
    assert resp.json() == []


# ──────────────────────────────────────────────────────────────
# GET /clients/me — perfil propio
# ──────────────────────────────────────────────────────────────
async def test_clients_me_devuelve_el_perfil(client: AsyncClient, cliente_logueado):
    cliente, tokens = cliente_logueado
    resp = await client.get(f"{RUTA}/me", headers=auth_headers(tokens))
    assert resp.status_code == 200
    data = resp.json()
    assert data["id_cliente"] == cliente.id_cliente
    assert data["email"] == cliente.email
    _sin_campos_sensibles(data)


async def test_clients_me_sin_token_devuelve_401(client: AsyncClient):
    resp = await client.get(f"{RUTA}/me")
    assert resp.status_code == 401


async def test_clients_me_con_token_de_empleado_devuelve_401(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.get(f"{RUTA}/me", headers=auth_headers(tokens))
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────
# PUT /clients/me — edición del perfil propio
# ──────────────────────────────────────────────────────────────
async def test_actualizar_perfil_propio_devuelve_200(
    client: AsyncClient, db, cliente_logueado
):
    cliente, tokens = cliente_logueado
    resp = await client.put(
        f"{RUTA}/me",
        json={"first_name": "Editado", "address": "Carrera 20 #5-10"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["first_name"] == "Editado"
    assert data["address"] == "Carrera 20 #5-10"
    db.refresh(cliente)
    assert cliente.first_name == "Editado"
    _sin_campos_sensibles(data)


async def test_actualizar_perfil_cambio_de_email_devuelve_400(
    client: AsyncClient, cliente_logueado
):
    """Cambiar el correo exige verificar un código → 400."""
    _, tokens = cliente_logueado
    resp = await client.put(
        f"{RUTA}/me",
        json={"email": "otro@neodomus.test.com"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "verificar" in resp.json()["detail"].lower()


async def test_actualizar_perfil_email_mismo_valor_devuelve_200(
    client: AsyncClient, cliente_logueado
):
    """Reenviar el MISMO correo sí está permitido (normalización a minúsculas)."""
    cliente, tokens = cliente_logueado
    resp = await client.put(
        f"{RUTA}/me",
        json={"email": cliente.email.upper()},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200


async def test_actualizar_perfil_telefono_fuera_de_rango_devuelve_422(
    client: AsyncClient, cliente_logueado
):
    _, tokens = cliente_logueado
    resp = await client.put(
        f"{RUTA}/me", json={"telefono_cliente": 999}, headers=auth_headers(tokens)
    )
    assert resp.status_code == 422


async def test_actualizar_perfil_sin_token_devuelve_401(client: AsyncClient):
    resp = await client.put(f"{RUTA}/me", json={"first_name": "X"})
    assert resp.status_code == 401


async def test_actualizar_perfil_con_token_de_empleado_devuelve_401(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.put(
        f"{RUTA}/me", json={"first_name": "X"}, headers=auth_headers(tokens)
    )
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────
# POST /clients/me/foto — foto de perfil
# ──────────────────────────────────────────────────────────────
async def test_foto_perfil_archivo_que_no_es_imagen_devuelve_400(
    client: AsyncClient, cliente_logueado
):
    _, tokens = cliente_logueado
    resp = await client.post(
        f"{RUTA}/me/foto",
        files={"archivo": ("notas.pdf", b"%PDF-1.4", "application/pdf")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "imagen" in resp.json()["detail"].lower()


async def test_foto_perfil_mas_de_5mb_devuelve_400(
    client: AsyncClient, cliente_logueado
):
    _, tokens = cliente_logueado
    grande = b"x" * (5 * 1024 * 1024 + 1)
    resp = await client.post(
        f"{RUTA}/me/foto",
        files={"archivo": ("grande.png", grande, "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "5 MB" in resp.json()["detail"]


async def test_foto_perfil_imagen_valida_devuelve_200(
    client: AsyncClient, db, cliente_logueado
):
    """MinIO está stubeado: la subida devuelve una URL falsa persistida
    en el cliente."""
    cliente, tokens = cliente_logueado
    resp = await client.post(
        f"{RUTA}/me/foto",
        files={"archivo": ("perfil.jpg", b"\xff\xd8\xff", "image/jpeg")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["foto_url"].startswith("http://test-minio")
    db.refresh(cliente)
    assert cliente.foto_url == data["foto_url"]


async def test_foto_perfil_sin_token_devuelve_401(client: AsyncClient):
    resp = await client.post(
        f"{RUTA}/me/foto", files={"archivo": ("p.png", b"\x89PNG", "image/png")}
    )
    assert resp.status_code == 401


async def test_foto_perfil_con_token_de_empleado_devuelve_401(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.post(
        f"{RUTA}/me/foto",
        files={"archivo": ("p.png", b"\x89PNG", "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────
# PUT /clients/{id}/habilitar | /inhabilitar (solo admin)
# ──────────────────────────────────────────────────────────────
async def test_inhabilitar_cliente_como_admin_devuelve_200(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    cliente = crear_cliente(db, email="a.inhabilitar@neodomus.test.com")
    resp = await client.put(
        f"{RUTA}/{cliente.id_cliente}/inhabilitar", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False
    db.refresh(cliente)
    assert cliente.is_active is False


async def test_inhabilitar_cliente_ya_inactivo_devuelve_400(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    cliente = crear_cliente(db, email="ya.inactivo@neodomus.test.com", is_active=False)
    resp = await client.put(
        f"{RUTA}/{cliente.id_cliente}/inhabilitar", headers=auth_headers(tokens)
    )
    assert resp.status_code == 400


async def test_inhabilitar_cliente_inexistente_devuelve_404(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.put(f"{RUTA}/999999/inhabilitar", headers=auth_headers(tokens))
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Cliente no encontrado"


async def test_habilitar_cliente_como_admin_devuelve_200(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    cliente = crear_cliente(db, email="a.habilitar@neodomus.test.com", is_active=False)
    resp = await client.put(
        f"{RUTA}/{cliente.id_cliente}/habilitar", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True
    db.refresh(cliente)
    assert cliente.is_active is True


async def test_habilitar_cliente_ya_activo_devuelve_400(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    cliente = crear_cliente(db, email="ya.activo@neodomus.test.com")
    resp = await client.put(
        f"{RUTA}/{cliente.id_cliente}/habilitar", headers=auth_headers(tokens)
    )
    assert resp.status_code == 400


async def test_habilitar_cliente_inexistente_devuelve_404(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.put(f"{RUTA}/999999/habilitar", headers=auth_headers(tokens))
    assert resp.status_code == 404


async def test_habilitar_cliente_sin_token_devuelve_401(client: AsyncClient):
    resp = await client.put(f"{RUTA}/1/habilitar")
    assert resp.status_code == 401


async def test_habilitar_cliente_con_token_de_tecnico_devuelve_403(
    client: AsyncClient, tecnico_logueado
):
    _, _, tokens = tecnico_logueado
    resp = await client.put(f"{RUTA}/1/habilitar", headers=auth_headers(tokens))
    assert resp.status_code == 403


async def test_habilitar_cliente_con_token_de_cliente_devuelve_401(
    client: AsyncClient, cliente_logueado
):
    """Cliente A intentando inhabilitar/habilitar a otro cliente → 401."""
    _, tokens = cliente_logueado
    resp = await client.put(
        f"{RUTA}/2/inhabilitar", headers=auth_headers(tokens)
    )
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────
# Historiales: pedidos, servicios y devoluciones de un cliente
# ──────────────────────────────────────────────────────────────
async def test_pedidos_de_cliente_como_admin_devuelve_200(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    cliente = crear_cliente(db, email="con.pedidos@neodomus.test.com")
    pedido = Pedido(
        id_cliente_pe=cliente.id_cliente,
        total_pedido=50000.0,
        estado_pedido="Pendiente",
    )
    db.add(pedido)
    db.commit()

    resp = await client.get(
        f"{RUTA}/{cliente.id_cliente}/pedidos", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id_pedido"] == pedido.id_pedido
    assert data[0]["pago"] is None
    assert data[0]["factura"] is None


async def test_pedidos_de_cliente_sin_pedidos_devuelve_lista_vacia(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    cliente = crear_cliente(db, email="sin.pedidos@neodomus.test.com")
    resp = await client.get(
        f"{RUTA}/{cliente.id_cliente}/pedidos", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_pedidos_de_cliente_inexistente_devuelve_404(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.get(f"{RUTA}/999999/pedidos", headers=auth_headers(tokens))
    assert resp.status_code == 404


async def test_servicios_de_cliente_como_admin_devuelve_200(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    cliente = crear_cliente(db, email="con.servicios@neodomus.test.com")
    resp = await client.get(
        f"{RUTA}/{cliente.id_cliente}/servicios", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_servicios_de_cliente_inexistente_devuelve_404(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.get(f"{RUTA}/999999/servicios", headers=auth_headers(tokens))
    assert resp.status_code == 404


async def test_devoluciones_de_cliente_como_admin_devuelve_200(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    cliente = crear_cliente(db, email="con.devoluciones@neodomus.test.com")
    resp = await client.get(
        f"{RUTA}/{cliente.id_cliente}/devoluciones", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_devoluciones_de_cliente_inexistente_devuelve_404(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.get(f"{RUTA}/999999/devoluciones", headers=auth_headers(tokens))
    assert resp.status_code == 404


async def test_historiales_sin_token_devuelven_401(client: AsyncClient):
    for recurso in ("pedidos", "servicios", "devoluciones"):
        resp = await client.get(f"{RUTA}/1/{recurso}")
        assert resp.status_code == 401, recurso


async def test_historiales_con_token_de_tecnico_devuelven_403(
    client: AsyncClient, tecnico_logueado
):
    _, _, tokens = tecnico_logueado
    for recurso in ("pedidos", "servicios", "devoluciones"):
        resp = await client.get(f"{RUTA}/1/{recurso}", headers=auth_headers(tokens))
        assert resp.status_code == 403, recurso


# ──────────────────────────────────────────────────────────────
# GET/POST /clients/me/cuenta-solicitud
# ──────────────────────────────────────────────────────────────
async def test_cuenta_solicitud_sin_solicitudes_devuelve_404(
    client: AsyncClient, cliente_logueado
):
    _, tokens = cliente_logueado
    resp = await client.get(f"{RUTA}/me/cuenta-solicitud", headers=auth_headers(tokens))
    assert resp.status_code == 404
    assert resp.json()["detail"] == "No hay solicitudes"


async def test_cuenta_solicitud_inhabilitar_crea_solicitud_pendiente(
    client: AsyncClient, db, cliente_logueado
):
    cliente, tokens = cliente_logueado
    resp = await client.post(
        f"{RUTA}/me/cuenta-solicitud",
        json={"tipo": "inhabilitar", "motivo": "No usaré la cuenta por un tiempo"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["tipo"] == "inhabilitar"
    assert data["estado"] == "pendiente"
    assert data["id_cliente"] == cliente.id_cliente
    # La cuenta NO se deshabilita automáticamente.
    db.refresh(cliente)
    assert cliente.is_active is True
    _sin_campos_sensibles(data)


async def test_cuenta_solicitud_get_devuelve_la_mas_reciente(
    client: AsyncClient, cliente_logueado
):
    _, tokens = cliente_logueado
    creada = await client.post(
        f"{RUTA}/me/cuenta-solicitud",
        json={"tipo": "inhabilitar", "motivo": "Motivo de prueba"},
        headers=auth_headers(tokens),
    )
    assert creada.status_code == 200

    resp = await client.get(f"{RUTA}/me/cuenta-solicitud", headers=auth_headers(tokens))
    assert resp.status_code == 200
    assert resp.json()["id"] == creada.json()["id"]


async def test_cuenta_solicitud_duplicada_devuelve_400(
    client: AsyncClient, cliente_logueado
):
    _, tokens = cliente_logueado
    payload = {"tipo": "inhabilitar", "motivo": "Motivo"}
    assert (await client.post(f"{RUTA}/me/cuenta-solicitud", json=payload,
                              headers=auth_headers(tokens))).status_code == 200
    resp = await client.post(
        f"{RUTA}/me/cuenta-solicitud", json=payload, headers=auth_headers(tokens)
    )
    assert resp.status_code == 400
    assert "pendiente" in resp.json()["detail"].lower()


async def test_cuenta_solicitud_inhabilitar_sin_motivo_devuelve_422(
    client: AsyncClient, cliente_logueado
):
    _, tokens = cliente_logueado
    resp = await client.post(
        f"{RUTA}/me/cuenta-solicitud",
        json={"tipo": "inhabilitar"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 422


async def test_cuenta_solicitud_tipo_invalido_devuelve_422(
    client: AsyncClient, cliente_logueado
):
    _, tokens = cliente_logueado
    resp = await client.post(
        f"{RUTA}/me/cuenta-solicitud",
        json={"tipo": "borrar", "motivo": "x"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 422


async def test_cuenta_solicitud_habilitar_con_cuenta_activa_devuelve_400(
    client: AsyncClient, cliente_logueado
):
    """Una cuenta ya activa no puede pedir habilitación → 400."""
    _, tokens = cliente_logueado
    resp = await client.post(
        f"{RUTA}/me/cuenta-solicitud",
        json={"tipo": "habilitar"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "activa" in resp.json()["detail"].lower()


async def test_cuenta_solicitud_habilitar_con_cuenta_inactiva_devuelve_401(
    client: AsyncClient, db, cliente_logueado
):
    """Comportamiento ACTUAL (ver hallazgos): una cuenta inhabilitada no
    puede autenticarse, así que nunca llega a crear la solicitud de
    habilitación desde este endpoint."""
    cliente, tokens = cliente_logueado
    cliente.is_active = False
    db.commit()

    resp = await client.post(
        f"{RUTA}/me/cuenta-solicitud",
        json={"tipo": "habilitar"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 401


async def test_cuenta_solicitud_sin_token_devuelve_401(client: AsyncClient):
    resp = await client.get(f"{RUTA}/me/cuenta-solicitud")
    assert resp.status_code == 401
    resp = await client.post(
        f"{RUTA}/me/cuenta-solicitud", json={"tipo": "inhabilitar", "motivo": "x"}
    )
    assert resp.status_code == 401


async def test_cuenta_solicitud_con_token_de_empleado_devuelve_401(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.get(f"{RUTA}/me/cuenta-solicitud", headers=auth_headers(tokens))
    assert resp.status_code == 401


async def test_cuenta_solicitud_de_un_cliente_no_expone_datos_ajenos(
    client: AsyncClient, db, cliente_logueado
):
    """Los endpoints /me siempre operan sobre el cliente autenticado:
    no hay forma de apuntar al id de otro cliente."""
    cliente, tokens = cliente_logueado
    otro = crear_cliente(db, email="otro.cliente@neodomus.test.com")
    resp = await client.post(
        f"{RUTA}/me/cuenta-solicitud",
        json={"tipo": "inhabilitar", "motivo": "Prueba"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    assert resp.json()["id_cliente"] == cliente.id_cliente
    assert resp.json()["id_cliente"] != otro.id_cliente


# ──────────────────────────────────────────────────────────────
# Catálogo de empleados (comprobación cruzada de permisos)
# ──────────────────────────────────────────────────────────────
async def test_empleado_sin_rol_admin_no_lista_clientes(
    client: AsyncClient, db, admin_logueado
):
    """Un empleado con un rol distinto a administrador recibe 403."""
    _, tokens = admin_logueado
    tecnico = crear_empleado(db, rol="tecnico", email="rol.tecnico@neodomus.test.com")
    from app.tests.factories import login

    tokens_tecnico = await login(
        client, tecnico.email, "Test1234!", "employee"
    )
    resp = await client.get(RUTA, headers=auth_headers(tokens_tecnico))
    assert resp.status_code == 403
    # El admin sigue pudiendo listar.
    resp = await client.get(RUTA, headers=auth_headers(tokens))
    assert resp.status_code == 200
