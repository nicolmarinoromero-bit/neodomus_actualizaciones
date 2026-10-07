"""
Pruebas transversales de seguridad del backend NEODOMUS.

Cubren: acceso sin JWT, tokens basurados, tokens firmados con una clave
incorrecta, tokens expirados, tokens con el ``type`` equivocado, mezcla de
roles (cliente ↔ empleado ↔ técnico ↔ administrador), manipulación de IDs
entre clientes (IDOR) y la ausencia de campos sensibles en las respuestas.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from httpx import AsyncClient
from jose import jwt

from app.config import settings
from app.models.pedido import Pedido
from app.tests.factories import auth_headers, crear_cliente, login

CLAVES_SENSIBLES = {"password", "password_hash", "secret", "token",
                    "access_token", "refresh_token"}


def _firmar(payload: dict, clave: str | None = None) -> str:
    """Firma un JWT con la SECRET_KEY real (o con la clave que se indique)."""
    return jwt.encode(
        payload, clave or settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )


def _payload_empleado(usuario, minutos: int = 30) -> dict:
    return {
        "sub": usuario.email,
        "uid": str(usuario.id_usuario),
        "user_type": "employee",
        "rol": "administrador",
        "type": "access",
        "exp": datetime.utcnow() + timedelta(minutes=minutos),
    }


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


# Endpoints protegidos que NO llevan cuerpo (basta la ausencia de token).
SIN_CUERPO = [
    ("GET", "/api/v1/users/", None),
    ("GET", "/api/v1/users/me", None),
    ("GET", "/api/v1/users/roles", None),
    ("POST", "/api/v1/users/me/foto",
     {"files": {"archivo": ("p.png", b"\x89PNG", "image/png")}}),
    ("DELETE", "/api/v1/users/1", None),
    ("GET", "/api/v1/clients", None),
    ("GET", "/api/v1/clients/me", None),
    ("GET", "/api/v1/clients/me/cuenta-solicitud", None),
    ("PUT", "/api/v1/clients/1/habilitar", None),
    ("PUT", "/api/v1/clients/1/inhabilitar", None),
    ("GET", "/api/v1/clients/1/pedidos", None),
    ("GET", "/api/v1/clients/1/servicios", None),
    ("GET", "/api/v1/clients/1/devoluciones", None),
    ("GET", "/api/v1/auth/session", None),
    ("GET", "/api/v1/pedidos/1", None),
]

# Endpoints protegidos CON cuerpo: se envía un cuerpo válido para que el
# 401 venga de la autenticación y no de la validación de pydantic.
CON_CUERPO = [
    ("POST", "/api/v1/users",
     {"json": {"first_name": "X", "last_name": "Y",
               "email": "seguridad@neodomus.test.com", "password": "Secreta123!",
               "id_rol": 1}}),
    ("PUT", "/api/v1/users/1", {"json": {"first_name": "X"}}),
    ("PUT", "/api/v1/clients/me", {"json": {"first_name": "X"}}),
    ("POST", "/api/v1/clients/me/cuenta-solicitud",
     {"json": {"tipo": "inhabilitar", "motivo": "Prueba"}}),
    ("POST", "/api/v1/auth/change-password",
     {"json": {"current_password": "Test1234!", "new_password": "Nueva123!"}}),
]


# ──────────────────────────────────────────────────────────────
# 1. Acceso sin JWT o con tokens inválidos → 401
# ──────────────────────────────────────────────────────────────
async def test_endpoints_sin_token_devuelven_401(client: AsyncClient):
    """Ningún endpoint clave responde sin cabecera Authorization."""
    for metodo, ruta, extra in SIN_CUERPO + CON_CUERPO:
        extra = extra or {}
        resp = await client.request(metodo, ruta, **extra)
        assert resp.status_code == 401, f"{metodo} {ruta} → {resp.status_code}"


async def test_token_basura_devuelve_401(client: AsyncClient):
    """Un token que no es un JWT válido se rechaza en todos los endpoints."""
    headers = {"Authorization": "Bearer no-es-un-token"}
    for ruta in ("/api/v1/users/me", "/api/v1/clients/me", "/api/v1/auth/session"):
        resp = await client.get(ruta, headers=headers)
        assert resp.status_code == 401, ruta
    # El detalle del error identifica el problema sin filtrar información.
    resp = await client.get("/api/v1/users/me", headers=headers)
    assert "token" in resp.json()["detail"].lower()


async def test_token_de_un_solo_segmento_devuelve_401(client: AsyncClient):
    """Cabecera con un valor que ni siquiera tiene el formato de un JWT."""
    resp = await client.get(
        "/api/v1/users/me", headers={"Authorization": "Bearer abc"}
    )
    assert resp.status_code == 401


async def test_token_firmado_con_clave_falsa_devuelve_401(
    client: AsyncClient, admin_logueado
):
    """Payload plausible pero firmado con otra SECRET_KEY → 401."""
    usuario, _ = admin_logueado
    token = _firmar(_payload_empleado(usuario), clave="clave-falsa-absoluta")
    resp = await client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 401


async def test_token_expirado_devuelve_401(client: AsyncClient, admin_logueado):
    """exp en el pasado con la SECRET_KEY real → 401."""
    usuario, _ = admin_logueado
    token = _firmar(_payload_empleado(usuario, minutos=-5))
    resp = await client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 401


async def test_token_expirado_en_endpoint_de_cliente_devuelve_401(
    client: AsyncClient, cliente_logueado
):
    cliente, _ = cliente_logueado
    token = _firmar({
        "sub": cliente.email,
        "uid": str(cliente.id_cliente),
        "user_type": "client",
        "rol": "cliente",
        "type": "access",
        "exp": datetime.utcnow() - timedelta(minutes=1),
    })
    resp = await client.get(
        "/api/v1/clients/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 401


async def test_token_sin_user_type_devuelve_401(client: AsyncClient, admin_logueado):
    """Sin el claim user_type el payload se considera inválido → 401."""
    usuario, _ = admin_logueado
    token = _firmar({
        "sub": usuario.email,
        "uid": str(usuario.id_usuario),
        "type": "access",
        "exp": datetime.utcnow() + timedelta(minutes=30),
    })
    resp = await client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 401


async def test_token_con_user_type_desconocido_devuelve_401(
    client: AsyncClient, admin_logueado
):
    usuario, _ = admin_logueado
    token = _firmar({
        "sub": usuario.email,
        "user_type": "root",
        "type": "access",
        "exp": datetime.utcnow() + timedelta(minutes=30),
    })
    resp = await client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 401


async def test_token_con_uid_no_numerico_y_sin_sub_devuelve_401(
    client: AsyncClient, admin_logueado
):
    """uid ilegible y sin sub de respaldo → 401 (no se puede identificar)."""
    usuario, _ = admin_logueado
    token = _firmar({
        "uid": "no-numerico",
        "user_type": "employee",
        "type": "access",
        "exp": datetime.utcnow() + timedelta(minutes=30),
    })
    resp = await client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 401
    assert "payload" in resp.json()["detail"].lower()


# ──────────────────────────────────────────────────────────────
# 2. Tokens con el type equivocado
# ──────────────────────────────────────────────────────────────
async def test_access_token_no_sirve_como_refresh(client: AsyncClient, admin_logueado):
    """Un access token enviado a /auth/refresh se rechaza con 401."""
    _, tokens = admin_logueado
    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["access_token"]}
    )
    assert resp.status_code == 401


async def test_refresh_token_usado_como_access_es_rechazado(
    client: AsyncClient, admin_logueado
):
    """CORREGIDO (ver hallazgos): `get_current_user` valida el claim `type`,
    así que un refresh token NO sirve como access token → 401."""
    _, tokens = admin_logueado
    resp = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {tokens['refresh_token']}"},
    )
    assert resp.status_code == 401


async def test_refresh_token_no_sirve_para_session(
    client: AsyncClient, admin_logueado
):
    """CORREGIDO: /auth/session también exige `type == "access"`."""
    _, tokens = admin_logueado
    resp = await client.get(
        "/api/v1/auth/session",
        headers={"Authorization": f"Bearer {tokens['refresh_token']}"},
    )
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────
# 3. Mezcla de roles entre tipos de cuenta
# ──────────────────────────────────────────────────────────────
async def test_cliente_con_token_de_empleado_en_endpoints_de_cliente(
    client: AsyncClient, admin_logueado
):
    """El token de un admin no sirve para los endpoints de cliente → 401."""
    _, tokens = admin_logueado
    peticiones = [
        ("GET", "/api/v1/clients/me", {}),
        ("GET", "/api/v1/clients/me/cuenta-solicitud", {}),
        ("GET", "/api/v1/pedidos/1", {}),
        ("POST", "/api/v1/clients/me/foto",
         {"files": {"archivo": ("p.png", b"\x89PNG", "image/png")}}),
    ]
    for metodo, ruta, extra in peticiones:
        resp = await client.request(metodo, ruta, headers=auth_headers(tokens), **extra)
        assert resp.status_code == 401, f"{metodo} {ruta} → {resp.status_code}"


async def test_empleado_con_token_de_cliente_en_endpoints_de_empleado(
    client: AsyncClient, cliente_logueado
):
    """El token de un cliente no sirve para los endpoints de empleado → 401."""
    _, tokens = cliente_logueado
    peticiones = [
        ("GET", "/api/v1/users/"),
        ("GET", "/api/v1/users/me"),
        ("GET", "/api/v1/users/roles"),
        ("GET", "/api/v1/clients"),
        ("DELETE", "/api/v1/users/1"),
    ]
    for metodo, ruta in peticiones:
        resp = await client.request(metodo, ruta, headers=auth_headers(tokens))
        assert resp.status_code == 401, f"{metodo} {ruta} → {resp.status_code}"


async def test_tecnico_en_endpoints_solo_admin_devuelve_403(
    client: AsyncClient, tecnico_logueado
):
    """El técnico es empleado, pero no administrador: 403 en todo lo admin."""
    _, _, tokens = tecnico_logueado
    peticiones = [
        ("GET", "/api/v1/users/", {}),
        ("GET", "/api/v1/users/roles", {}),
        ("POST", "/api/v1/users",
         {"json": {"first_name": "X", "last_name": "Y",
                   "email": "x.y@neodomus.test.com", "password": "Secreta123!",
                   "id_rol": 1}}),
        ("PUT", "/api/v1/users/1", {"json": {"first_name": "X"}}),
        ("DELETE", "/api/v1/users/1", {}),
        ("GET", "/api/v1/clients", {}),
        ("PUT", "/api/v1/clients/1/habilitar", {}),
        ("GET", "/api/v1/clients/1/pedidos", {}),
    ]
    for metodo, ruta, extra in peticiones:
        resp = await client.request(metodo, ruta, headers=auth_headers(tokens), **extra)
        assert resp.status_code == 403, f"{metodo} {ruta} → {resp.status_code}"


async def test_admin_supera_los_mismos_endpoints_solo_admin(
    client: AsyncClient, admin_logueado
):
    """Contraste del test anterior: el administrador sí pasa la puerta
    (no recibe 401/403)."""
    _, tokens = admin_logueado
    for ruta in ("/api/v1/users/", "/api/v1/users/roles", "/api/v1/clients"):
        resp = await client.get(ruta, headers=auth_headers(tokens))
        assert resp.status_code == 200, ruta


# ──────────────────────────────────────────────────────────────
# 4. Manipulación de IDs entre clientes (IDOR)
# ──────────────────────────────────────────────────────────────
async def test_cliente_a_no_puede_ver_el_pedido_de_cliente_b(
    client: AsyncClient, db, cliente_logueado
):
    """Cliente A pidiendo el pedido de cliente B → 404 (el handler filtra
    por id_cliente, no solo por id_pedido)."""
    cliente_a, tokens_a = cliente_logueado
    cliente_b = crear_cliente(db, email="cliente.b@neodomus.test.com")
    pedido_b = Pedido(
        id_cliente_pe=cliente_b.id_cliente,
        total_pedido=75000.0,
        estado_pedido="Pendiente",
    )
    db.add(pedido_b)
    db.commit()

    resp_a = await client.get(
        f"/api/v1/pedidos/{pedido_b.id_pedido}", headers=auth_headers(tokens_a)
    )
    assert resp_a.status_code == 404

    # El dueño legítimo sí puede ver su pedido (contraste).
    tokens_b = await login(client, cliente_b.email, "Test1234!", "client")
    resp_b = await client.get(
        f"/api/v1/pedidos/{pedido_b.id_pedido}", headers=auth_headers(tokens_b)
    )
    assert resp_b.status_code == 200
    assert resp_b.json()["id_pedido"] == pedido_b.id_pedido


async def test_cliente_a_no_puede_inhabilitar_a_cliente_b(
    client: AsyncClient, db, cliente_logueado
):
    """Endpoint administrador: el token de cliente A se rechaza con 401
    aunque manipule el id de B."""
    _, tokens_a = cliente_logueado
    cliente_b = crear_cliente(db, email="cliente.b2@neodomus.test.com")
    resp = await client.put(
        f"/api/v1/clients/{cliente_b.id_cliente}/inhabilitar",
        headers=auth_headers(tokens_a),
    )
    assert resp.status_code == 401
    db.refresh(cliente_b)
    assert cliente_b.is_active is True


async def test_cliente_a_no_puede_ver_el_historial_de_cliente_b(
    client: AsyncClient, db, cliente_logueado
):
    _, tokens_a = cliente_logueado
    cliente_b = crear_cliente(db, email="cliente.b3@neodomus.test.com")
    for recurso in ("pedidos", "servicios", "devoluciones"):
        resp = await client.get(
            f"/api/v1/clients/{cliente_b.id_cliente}/{recurso}",
            headers=auth_headers(tokens_a),
        )
        assert resp.status_code == 401, recurso


async def test_endpoint_me_solo_edita_el_perfil_autenticado(
    client: AsyncClient, cliente_logueado
):
    """No existe endpoint para editar el perfil de OTRO cliente: /me siempre
    opera sobre la cuenta autenticada y no se admite un id en la URL."""
    cliente_a, tokens_a = cliente_logueado
    resp = await client.put(
        "/api/v1/clients/me",
        json={"first_name": "Manipulado"},
        headers=auth_headers(tokens_a),
    )
    assert resp.status_code == 200
    assert resp.json()["id_cliente"] == cliente_a.id_cliente
    assert resp.json()["first_name"] == "Manipulado"


# ──────────────────────────────────────────────────────────────
# 5. Sesiones de cuentas inhabilitadas
# ──────────────────────────────────────────────────────────────
async def test_sesion_de_cliente_inactivado_devuelve_401(
    client: AsyncClient, db, cliente_logueado
):
    """El token sigue siendo firmado, pero la cuenta inhabilitada ya no
    puede usarlo: se invalida en cada petición."""
    cliente, tokens = cliente_logueado
    cliente.is_active = False
    db.commit()
    resp = await client.get(f"/api/v1/clients/me", headers=auth_headers(tokens))
    assert resp.status_code == 401


async def test_sesion_de_empleado_inactivado_devuelve_401(
    client: AsyncClient, db, admin_logueado
):
    usuario, tokens = admin_logueado
    usuario.is_active = False
    db.commit()
    resp = await client.get("/api/v1/users/me", headers=auth_headers(tokens))
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────
# 6. Ninguna respuesta expone campos sensibles
# ──────────────────────────────────────────────────────────────
async def test_respuestas_clave_no_expone_campos_sensibles(
    client: AsyncClient, db, admin_logueado, cliente_logueado
):
    """Ni password_hash, ni password, ni secret, ni tokens internos en los
    endpoints clave: /users, /users/me, /clients, /clients/me y
    /auth/session."""
    _, tokens_admin = admin_logueado
    _, tokens_cliente = cliente_logueado

    comprobaciones = [
        ("GET", "/api/v1/users/", auth_headers(tokens_admin)),
        ("GET", "/api/v1/users/me", auth_headers(tokens_admin)),
        ("GET", "/api/v1/clients", auth_headers(tokens_admin)),
        ("GET", "/api/v1/clients/me", auth_headers(tokens_cliente)),
        ("GET", "/api/v1/auth/session", auth_headers(tokens_cliente)),
        ("GET", "/api/v1/auth/session", auth_headers(tokens_admin)),
    ]
    for metodo, ruta, headers in comprobaciones:
        resp = await client.request(metodo, ruta, headers=headers)
        assert resp.status_code == 200, f"{ruta} → {resp.status_code}"
        texto = resp.text.lower()
        for prohibida in CLAVES_SENSIBLES:
            assert f'"{prohibida}"' not in texto, f"{ruta} expone {prohibida}"
        assert "$2b$" not in resp.text, f"{ruta} expone un hash bcrypt"
        claves = _claves(resp.json())
        for clave in claves:
            assert clave.split(".")[-1].lower() not in CLAVES_SENSIBLES, (
                f"{ruta} expone la clave {clave}"
            )


async def test_respuesta_de_error_no_expone_stacktrace(
    client: AsyncClient, admin_logueado
):
    """Un 404 de /users/{id} devuelve solo `detail`, sin trazas internas."""
    _, tokens = admin_logueado
    resp = await client.delete("/api/v1/users/999999", headers=auth_headers(tokens))
    assert resp.status_code == 404
    assert set(resp.json().keys()) == {"detail"}


async def test_el_hash_del_password_nunca_aparece_en_el_listado(
    client: AsyncClient, db, admin_logueado
):
    """Comprobación adicional con el hash REAL del empleado logueado."""
    usuario, tokens = admin_logueado
    resp = await client.get("/api/v1/users/", headers=auth_headers(tokens))
    assert resp.status_code == 200
    assert usuario.password_hash not in resp.text
