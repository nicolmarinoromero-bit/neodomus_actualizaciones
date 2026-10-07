"""
Pruebas del router de usuarios (`be/app/routers/users.py`, prefijo
`/api/v1/users`): listado de empleados, perfil propio, roles, alta,
edición, baja y foto de perfil.

Comportamiento real de autorización que se deja documentado:

* sin token → 401 (``get_current_employee``);
* token de **cliente** en endpoint de empleado → 401 (la sesión pertenece
  a otro tipo de cuenta);
* token de **técnico** en endpoint de administrador → 403 (``_admin``);
* ``DELETE /users/{id}`` no permite desactivarse a uno mismo → 400.
"""

from __future__ import annotations

from httpx import AsyncClient

from app.models.tecnico import Tecnico
from app.models.user import User
from app.tests.factories import auth_headers, crear_empleado
from app.utils.security import verify_password

# Claves que jamás deben aparecer en una respuesta de la API.
CLAVES_SENSIBLES = {"password", "password_hash", "secret", "token",
                    "access_token", "refresh_token"}


def _payload_empleado(**kw) -> dict:
    """Cuerpo válido por defecto para POST /users (rol administrador)."""
    datos = dict(
        first_name="Nueva",
        last_name="Persona",
        email="nueva.persona@neodomus.test.com",
        password="Secreta123!",
        id_rol=1,
    )
    datos.update(kw)
    return datos


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
# GET /users/ — listado de empleados (solo admin)
# ──────────────────────────────────────────────────────────────
async def test_listar_usuarios_sin_token_responde_401(client: AsyncClient):
    """Sin Authorization el listado de empleados responde 401."""
    resp = await client.get("/api/v1/users/")
    assert resp.status_code == 401


async def test_listar_usuarios_con_token_de_cliente_responde_401(
    client: AsyncClient, cliente_logueado
):
    """Un cliente autenticado NO ve empleados: 401 (cuenta de otro tipo)."""
    _, tokens = cliente_logueado
    resp = await client.get("/api/v1/users/", headers=auth_headers(tokens))
    assert resp.status_code == 401


async def test_listar_usuarios_con_token_de_tecnico_responde_403(
    client: AsyncClient, tecnico_logueado
):
    """El técnico es empleado pero no administrador: 403."""
    _, _, tokens = tecnico_logueado
    resp = await client.get("/api/v1/users/", headers=auth_headers(tokens))
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Permisos insuficientes"


async def test_listar_usuarios_como_admin_devuelve_empleados(
    client: AsyncClient, db, admin_logueado
):
    """El administrador lista a todos los empleados (él incluido)."""
    _, tokens = admin_logueado
    crear_empleado(db, email="extra1@neodomus.test.com")
    crear_empleado(db, email="extra2@neodomus.test.com")

    resp = await client.get("/api/v1/users/", headers=auth_headers(tokens))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    emails = {u["email"] for u in data}
    assert "extra1@neodomus.test.com" in emails
    assert "extra2@neodomus.test.com" in emails
    _sin_campos_sensibles(data)


async def test_listar_usuarios_respeta_skip_y_limit(
    client: AsyncClient, db, admin_logueado
):
    """El paginado funciona con los query params skip/limit."""
    _, tokens = admin_logueado
    for i in range(3):
        crear_empleado(db, email=f"pagina{i}@neodomus.test.com")

    resp = await client.get(
        "/api/v1/users/", params={"skip": 1, "limit": 2}, headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_listar_usuarios_sin_barra_final_devuelve_405(
    client: AsyncClient, admin_logueado
):
    """Comportamiento ACTUAL: la ruta registrada es GET `/users/`; un GET
    a `/users` (sin barra) sólo coincide con la ruta de POST `/users` y
    responde 405 en vez de redirigir."""
    _, tokens = admin_logueado
    resp = await client.get("/api/v1/users", headers=auth_headers(tokens))
    assert resp.status_code == 405
    # La ruta canónica (con la barra final) sí funciona.
    resp = await client.get("/api/v1/users/", headers=auth_headers(tokens))
    assert resp.status_code == 200


# ──────────────────────────────────────────────────────────────
# GET /users/me — perfil del empleado
# ──────────────────────────────────────────────────────────────
async def test_users_me_devuelve_perfil_sin_ficha_tecnica(
    client: AsyncClient, admin_logueado
):
    """Un administrador sin ficha técnica recibe certificacion_t=None y
    una lista vacía de especializaciones."""
    usuario, tokens = admin_logueado
    resp = await client.get("/api/v1/users/me", headers=auth_headers(tokens))
    assert resp.status_code == 200
    data = resp.json()
    assert data["id_usuario"] == usuario.id_usuario
    assert data["email"] == usuario.email
    assert data["certificacion_t"] is None
    assert data["especializaciones"] == []
    _sin_campos_sensibles(data)


async def test_users_me_incluye_ficha_tecnica_si_existe(
    client: AsyncClient, tecnico_logueado
):
    """El perfil del técnico incluye su ficha (certificación)."""
    usuario, ficha, tokens = tecnico_logueado
    resp = await client.get("/api/v1/users/me", headers=auth_headers(tokens))
    assert resp.status_code == 200
    data = resp.json()
    assert data["id_usuario"] == usuario.id_usuario
    assert data["certificacion_t"] == ficha.certificacion_t
    assert isinstance(data["especializaciones"], list)
    _sin_campos_sensibles(data)


async def test_users_me_sin_token_responde_401(client: AsyncClient):
    resp = await client.get("/api/v1/users/me")
    assert resp.status_code == 401


async def test_users_me_con_token_de_cliente_responde_401(
    client: AsyncClient, cliente_logueado
):
    _, tokens = cliente_logueado
    resp = await client.get("/api/v1/users/me", headers=auth_headers(tokens))
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────
# PUT /users/me — perfil propio
# ──────────────────────────────────────────────────────────────
async def test_users_me_actualiza_nombre_y_crea_ficha(
    client: AsyncClient, db, admin_logueado
):
    """El empleado actualiza su nombre y su certificación; si no tenía
    ficha técnica se crea."""
    usuario, tokens = admin_logueado
    resp = await client.put(
        "/api/v1/users/me",
        json={"first_name": "Actualizado", "certificacion_t": "ISO 9001"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["first_name"] == "Actualizado"
    assert data["certificacion_t"] == "ISO 9001"
    ficha = db.query(Tecnico).filter(Tecnico.id_usuario_t == usuario.id_usuario).first()
    assert ficha is not None
    assert ficha.certificacion_t == "ISO 9001"


async def test_users_me_cambio_de_email_rechazado(client: AsyncClient, admin_logueado):
    """Cambiar el correo desde /me exige verificar un código → 400."""
    _, tokens = admin_logueado
    resp = await client.put(
        "/api/v1/users/me",
        json={"email": "otro.correo@neodomus.test.com"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "verificar" in resp.json()["detail"].lower()


async def test_users_me_nombre_vacio_rechazado(client: AsyncClient, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.put(
        "/api/v1/users/me", json={"first_name": "   "}, headers=auth_headers(tokens)
    )
    assert resp.status_code == 400


async def test_users_me_put_sin_token_responde_401(client: AsyncClient):
    resp = await client.put("/api/v1/users/me", json={"first_name": "X"})
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────
# GET /users/roles
# ──────────────────────────────────────────────────────────────
async def test_roles_como_admin_devuelve_catalogo(client: AsyncClient, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.get("/api/v1/users/roles", headers=auth_headers(tokens))
    assert resp.status_code == 200
    nombres = {r["nombre"] for r in resp.json()}
    assert {"administrador", "tecnico"} <= nombres


async def test_roles_sin_token_responde_401(client: AsyncClient):
    resp = await client.get("/api/v1/users/roles")
    assert resp.status_code == 401


async def test_roles_con_token_de_tecnico_responde_403(
    client: AsyncClient, tecnico_logueado
):
    _, _, tokens = tecnico_logueado
    resp = await client.get("/api/v1/users/roles", headers=auth_headers(tokens))
    assert resp.status_code == 403


async def test_roles_con_token_de_cliente_responde_401(
    client: AsyncClient, cliente_logueado
):
    _, tokens = cliente_logueado
    resp = await client.get("/api/v1/users/roles", headers=auth_headers(tokens))
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────
# POST /users — alta de empleados
# ──────────────────────────────────────────────────────────────
async def test_crear_empleado_como_admin_devuelve_200(
    client: AsyncClient, db, admin_logueado
):
    """El admin crea un empleado: 200, contraseña hasheada y bandera de
    reset de contraseña activa."""
    _, tokens = admin_logueado
    payload = _payload_empleado()
    resp = await client.post("/api/v1/users", json=payload, headers=auth_headers(tokens))
    assert resp.status_code == 200
    data = resp.json()
    assert data["msg"] == "Usuario registrado correctamente"
    assert data["email"] == payload["email"]
    assert data["id"]

    usuario = db.query(User).filter(User.email == payload["email"]).first()
    assert usuario is not None
    assert usuario.is_active is True
    assert usuario.password_reset_required is True
    assert verify_password(payload["password"], usuario.password_hash)
    _sin_campos_sensibles(data)


async def test_crear_tecnico_crea_ficha_tecnica(
    client: AsyncClient, db, admin_logueado
):
    """Con rol técnico (id_rol=2) el alta crea además la ficha técnica."""
    _, tokens = admin_logueado
    payload = _payload_empleado(id_rol=2, certificacion="Cert ISO")
    resp = await client.post("/api/v1/users", json=payload, headers=auth_headers(tokens))
    assert resp.status_code == 200

    usuario = db.query(User).filter(User.email == payload["email"]).first()
    ficha = db.query(Tecnico).filter(Tecnico.id_usuario_t == usuario.id_usuario).first()
    assert ficha is not None
    assert ficha.certificacion_t == "Cert ISO"


async def test_crear_empleado_email_duplicado_devuelve_400(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    crear_empleado(db, email="dup@neodomus.test.com")
    resp = await client.post(
        "/api/v1/users",
        json=_payload_empleado(email="DUP@neodomus.test.com"),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "correo" in resp.json()["detail"].lower()


async def test_crear_empleado_documento_duplicado_devuelve_400(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    crear_empleado(db, email="con.doc@neodomus.test.com", documento_usuario=777888999)
    resp = await client.post(
        "/api/v1/users",
        json=_payload_empleado(email="otro.doc@neodomus.test.com",
                               documento_usuario=777888999),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "documento" in resp.json()["detail"].lower()


async def test_crear_empleado_password_corta_devuelve_400(
    client: AsyncClient, admin_logueado
):
    """Comportamiento ACTUAL: la contraseña corta se rechaza con 400
    (validación manual en el handler, no 422 de pydantic)."""
    _, tokens = admin_logueado
    resp = await client.post(
        "/api/v1/users",
        json=_payload_empleado(password="abc12"),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "6 caracteres" in resp.json()["detail"]


async def test_crear_empleado_rol_inexistente_devuelve_400(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.post(
        "/api/v1/users",
        json=_payload_empleado(id_rol=999),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "rol" in resp.json()["detail"].lower()


async def test_crear_empleado_campos_faltantes_devuelve_422(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.post(
        "/api/v1/users",
        json={"last_name": "SinNombre", "email": "sin.nombre@neodomus.test.com",
              "password": "Secreta123!"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 422


async def test_crear_empleado_email_invalido_devuelve_422(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.post(
        "/api/v1/users",
        json=_payload_empleado(email="no-es-un-correo"),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 422


async def test_crear_empleado_telefono_fuera_de_rango_devuelve_422(
    client: AsyncClient, admin_logueado
):
    """Límite: telefono_usuario debe tener 10 dígitos (ge=1000000000)."""
    _, tokens = admin_logueado
    resp = await client.post(
        "/api/v1/users",
        json=_payload_empleado(telefono_usuario=12345),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 422


async def test_crear_empleado_sin_token_devuelve_401(client: AsyncClient):
    resp = await client.post("/api/v1/users", json=_payload_empleado())
    assert resp.status_code == 401


async def test_crear_empleado_con_token_de_tecnico_devuelve_403(
    client: AsyncClient, tecnico_logueado
):
    _, _, tokens = tecnico_logueado
    resp = await client.post(
        "/api/v1/users", json=_payload_empleado(), headers=auth_headers(tokens)
    )
    assert resp.status_code == 403


async def test_crear_empleado_con_token_de_cliente_devuelve_401(
    client: AsyncClient, cliente_logueado
):
    _, tokens = cliente_logueado
    resp = await client.post(
        "/api/v1/users", json=_payload_empleado(), headers=auth_headers(tokens)
    )
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────
# PUT /users/{id} — edición de empleados
# ──────────────────────────────────────────────────────────────
async def test_editar_empleado_como_admin_devuelve_200(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    otro = crear_empleado(db, email="editar@neodomus.test.com")
    resp = await client.put(
        f"/api/v1/users/{otro.id_usuario}",
        json={"first_name": "Editado", "last_name": "Apellido"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == otro.id_usuario
    db.refresh(otro)
    assert otro.first_name == "Editado"


async def test_editar_empleado_inexistente_devuelve_404(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.put(
        "/api/v1/users/999999", json={"first_name": "Nadie"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Usuario no encontrado"


async def test_editar_empleado_email_duplicado_devuelve_400(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    crear_empleado(db, email="ocupado@neodomus.test.com")
    objetivo = crear_empleado(db, email="libre@neodomus.test.com")
    resp = await client.put(
        f"/api/v1/users/{objetivo.id_usuario}",
        json={"email": "ocupado@neodomus.test.com"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "correo" in resp.json()["detail"].lower()


async def test_editar_empleado_documento_duplicado_devuelve_400(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    crear_empleado(db, email="doc1@neodomus.test.com", documento_usuario=111222333)
    objetivo = crear_empleado(db, email="doc2@neodomus.test.com")
    resp = await client.put(
        f"/api/v1/users/{objetivo.id_usuario}",
        json={"documento_usuario": 111222333},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "documento" in resp.json()["detail"].lower()


async def test_editar_empleado_password_corta_devuelve_400(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    objetivo = crear_empleado(db, email="pass.corta@neodomus.test.com")
    resp = await client.put(
        f"/api/v1/users/{objetivo.id_usuario}",
        json={"password": "abc"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400


async def test_editar_empleado_password_larga_se_hashea(
    client: AsyncClient, db, admin_logueado
):
    _, tokens = admin_logueado
    objetivo = crear_empleado(db, email="pass.larga@neodomus.test.com")
    resp = await client.put(
        f"/api/v1/users/{objetivo.id_usuario}",
        json={"password": "NuevaClave123"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    db.refresh(objetivo)
    assert verify_password("NuevaClave123", objetivo.password_hash)
    assert objetivo.password_reset_required is True


async def test_editar_empleado_inhabilita_cuenta(
    client: AsyncClient, db, admin_logueado
):
    """Cambiar is_active a False inhabilita al empleado (correo stubeado)."""
    _, tokens = admin_logueado
    objetivo = crear_empleado(db, email="inhabilitar@neodomus.test.com")
    resp = await client.put(
        f"/api/v1/users/{objetivo.id_usuario}",
        json={"is_active": False, "motivo": "Prueba de inhabilitación"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    db.refresh(objetivo)
    assert objetivo.is_active is False


async def test_editar_empleado_sin_token_devuelve_401(client: AsyncClient):
    resp = await client.put("/api/v1/users/1", json={"first_name": "X"})
    assert resp.status_code == 401


async def test_editar_empleado_con_token_de_tecnico_devuelve_403(
    client: AsyncClient, tecnico_logueado
):
    _, _, tokens = tecnico_logueado
    resp = await client.put(
        "/api/v1/users/1", json={"first_name": "X"}, headers=auth_headers(tokens)
    )
    assert resp.status_code == 403


# ──────────────────────────────────────────────────────────────
# DELETE /users/{id} — baja de empleados
# ──────────────────────────────────────────────────────────────
async def test_delete_empleado_desactiva_la_cuenta(
    client: AsyncClient, db, admin_logueado
):
    """DELETE no borra la fila: desactiva la cuenta (is_active=False)."""
    _, tokens = admin_logueado
    objetivo = crear_empleado(db, email="baja@neodomus.test.com")
    resp = await client.delete(
        f"/api/v1/users/{objetivo.id_usuario}", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    assert resp.json()["msg"] == "Usuario desactivado"
    db.refresh(objetivo)
    assert objetivo.is_active is False
    assert db.query(User).filter(User.id_usuario == objetivo.id_usuario).first() is not None


async def test_delete_a_uno_mismo_devuelve_400(
    client: AsyncClient, admin_logueado
):
    """El admin no puede desactivarse a sí mismo (400, no 403)."""
    usuario, tokens = admin_logueado
    resp = await client.delete(
        f"/api/v1/users/{usuario.id_usuario}", headers=auth_headers(tokens)
    )
    assert resp.status_code == 400
    assert "propia cuenta" in resp.json()["detail"]


async def test_delete_empleado_inexistente_devuelve_404(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.delete("/api/v1/users/999999", headers=auth_headers(tokens))
    assert resp.status_code == 404


async def test_delete_sin_token_devuelve_401(client: AsyncClient):
    resp = await client.delete("/api/v1/users/1")
    assert resp.status_code == 401


async def test_delete_con_token_de_tecnico_devuelve_403(
    client: AsyncClient, tecnico_logueado
):
    _, _, tokens = tecnico_logueado
    resp = await client.delete("/api/v1/users/1", headers=auth_headers(tokens))
    assert resp.status_code == 403


# ──────────────────────────────────────────────────────────────
# POST /users/me/foto — foto de perfil (MinIO stubeado)
# ──────────────────────────────────────────────────────────────
async def test_foto_perfil_archivo_que_no_es_imagen_devuelve_400(
    client: AsyncClient, admin_logueado
):
    """Un ejecutable (extensiones/contenido no-imagen) se rechaza con 400."""
    _, tokens = admin_logueado
    resp = await client.post(
        "/api/v1/users/me/foto",
        files={"archivo": ("malware.exe", b"MZ\x90\x00", "application/x-msdownload")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "imagen" in resp.json()["detail"].lower()


async def test_foto_perfil_archivo_sin_content_type_devuelve_400(
    client: AsyncClient, admin_logueado
):
    _, tokens = admin_logueado
    resp = await client.post(
        "/api/v1/users/me/foto",
        files={"archivo": ("sin.tipo", b"algo", None)},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400


async def test_foto_perfil_mas_de_5mb_devuelve_400(
    client: AsyncClient, admin_logueado
):
    """Límite de 5 MB exacto: 5 MB + 1 byte se rechaza."""
    _, tokens = admin_logueado
    grande = b"x" * (5 * 1024 * 1024 + 1)
    resp = await client.post(
        "/api/v1/users/me/foto",
        files={"archivo": ("grande.png", grande, "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "5 MB" in resp.json()["detail"]


async def test_foto_perfil_imagen_valida_devuelve_200(
    client: AsyncClient, db, admin_logueado
):
    """Subida válida: MinIO está stubeado y devuelve una URL falsa que
    queda guardada en el empleado."""
    usuario, tokens = admin_logueado
    resp = await client.post(
        "/api/v1/users/me/foto",
        files={"archivo": ("perfil.png", b"\x89PNG\r\n\x1a\n", "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["foto_url"].startswith("http://test-minio")
    db.refresh(usuario)
    assert usuario.foto_url == data["foto_url"]


async def test_foto_perfil_extension_no_validada_solo_content_type(
    client: AsyncClient, admin_logueado
):
    """Comportamiento ACTUAL: solo se valida el content-type, no la
    extensión real del archivo (ver hallazgos)."""
    _, tokens = admin_logueado
    resp = await client.post(
        "/api/v1/users/me/foto",
        files={"archivo": ("payload.exe", b"MZ\x90\x00", "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    assert resp.json()["foto_url"].endswith(".exe")


async def test_foto_perfil_sin_token_devuelve_401(client: AsyncClient):
    resp = await client.post(
        "/api/v1/users/me/foto",
        files={"archivo": ("p.png", b"\x89PNG", "image/png")},
    )
    assert resp.status_code == 401


async def test_foto_perfil_con_token_de_cliente_devuelve_401(
    client: AsyncClient, cliente_logueado
):
    _, tokens = cliente_logueado
    resp = await client.post(
        "/api/v1/users/me/foto",
        files={"archivo": ("p.png", b"\x89PNG", "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 401
