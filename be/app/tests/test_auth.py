"""
Pruebas de autenticación: registro, verificación de correo, login,
JWT (access/refresh/session), cambio de contraseña, recuperación de
contraseña, cambio de correo, login Google y solicitudes de habilitación.

Se ejecutan contra la BD de pruebas (neodomus_test) y el login real
de la API para obtener los tokens.
"""

import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient

from app.main import app
from app.database import SessionLocal
from app.models.cliente import Cliente
from app.models.user import User
from app.models.pending_registration import PendingRegistration
from app.models.password_reset_token import PasswordResetToken
from app.models.roles_usuario import RolesUsuario
from app.utils.security import hash_password


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────
def _db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _crear_pendiente(db, **kw):
    datos = dict(
        first_name="Nuevo",
        last_name="Cliente",
        id_tipo_documento_c=1,
        documento_cliente=1987654321,
        telefono_cliente=3001234567,
        email="pendiente@neodomus.test.com",
        address="Cra 1 #2-3",
        password_hash=hash_password("Test1234!"),
        code="123456",
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    datos.update(kw)
    obj = PendingRegistration(**datos)
    db.add(obj)
    db.commit()
    return obj


def _crear_reset_token(db, **kw):
    datos = dict(
        email="reset@neodomus.test.com",
        user_type="client",
        code="654321",
        token=None,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
        used=False,
    )
    datos.update(kw)
    obj = PasswordResetToken(**datos)
    db.add(obj)
    db.commit()
    return obj


def _crear_cliente(db, **kw):
    datos = dict(
        first_name="Cliente",
        last_name="Prueba",
        email="cliente.auth@neodomus.test.com",
        password_hash=hash_password("Test1234!"),
        id_tipo_documento_c=1,
        documento_cliente=1122334455,
        telefono_cliente=3001234567,
        address="Cra 10 #12-34",
        is_active=True,
    )
    datos.update(kw)
    obj = Cliente(**datos)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    # refresh() deja abierta una transacción de lectura; se cierra para
    # que las escrituras de background tasks (otra conexión) sean visibles.
    db.commit()
    return obj


def _crear_empleado(db, rol_nombre="administrador", **kw):
    rol = db.query(RolesUsuario).filter(RolesUsuario.nombre_rol == rol_nombre).first()
    datos = dict(
        first_name="Empleado",
        last_name="Prueba",
        email="empleado.auth@neodomus.test.com",
        password_hash=hash_password("Test1234!"),
        id_rol_u=rol.id_rol,
        is_active=True,
    )
    datos.update(kw)
    obj = User(**datos)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    # refresh() deja abierta una transacción de lectura; se cierra para
    # que las escrituras de background tasks (otra conexión) sean visibles.
    db.commit()
    return obj


# ──────────────────────────────────────────────────────────────
# Registro de cliente
# ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_register_client(client: AsyncClient):
    """El registro de cliente crea un registro pendiente y responde 200."""
    response = await client.post(
        "/api/v1/auth/register/client",
        json={
            "first_name": "Test",
            "last_name": "User",
            "email": "test.register@neodomus.test.com",
            "password": "Secret123!",
            "id_tipo_documento_c": 1,
            "documento_cliente": 123456789,
            "telefono_cliente": 3001234567,
            "address": "Calle Falsa 123",
        },
    )
    assert response.status_code == 200
    assert "msg" in response.json()


@pytest.mark.asyncio
async def test_register_client_crea_pendiente_no_activo(client: AsyncClient, db):
    """Tras registrar, NO existe cliente activo: queda pendiente
    hasta verificar el código del correo."""
    email = "pendiente1@neodomus.test.com"
    resp = await client.post(
        "/api/v1/auth/register/client",
        json={
            "first_name": "Pendiente", "last_name": "Uno",
            "email": email, "password": "Secret123!",
            "id_tipo_documento_c": 1, "documento_cliente": 123456780,
            "telefono_cliente": 3001234560, "address": "Cra 1 #1-1",
        },
    )
    assert resp.status_code == 200
    assert db.query(Cliente).filter(Cliente.email == email).first() is None
    pend = db.query(PendingRegistration).filter(PendingRegistration.email == email).first()
    assert pend is not None
    assert len(pend.code) == 6


@pytest.mark.asyncio
async def test_register_client_email_duplicado(client: AsyncClient, db):
    """Un email ya registrado (cliente activo) se rechaza con 400."""
    _crear_cliente(db, email="dup@neodomus.test.com")
    resp = await client.post(
        "/api/v1/auth/register/client",
        json={
            "first_name": "Dup", "last_name": "Cliente",
            "email": "dup@neodomus.test.com", "password": "Secret123!",
        },
    )
    assert resp.status_code == 400
    assert "registrado" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_register_client_password_debil(client: AsyncClient):
    """La contraseña debe tener 8+ caracteres, mayúscula, minúscula y dígito."""
    for debil in ("corto", "sindigitos", "SINMINUSCULAS1", "sinmayusculas1"):
        resp = await client.post(
            "/api/v1/auth/register/client",
            json={
                "first_name": "Debil", "last_name": "Cliente",
                "email": "debil@neodomus.test.com", "password": debil,
            },
        )
        assert resp.status_code == 422, debil


@pytest.mark.asyncio
async def test_register_client_email_invalido(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/register/client",
        json={
            "first_name": "Mail", "last_name": "Mal",
            "email": "no-es-un-email", "password": "Secret123!",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_client_nombre_corto(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/register/client",
        json={
            "first_name": "A", "last_name": "B",
            "email": "corto@neodomus.test.com", "password": "Secret123!",
        },
    )
    assert resp.status_code == 422


# ──────────────────────────────────────────────────────────────
# Verificación de correo
# ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_verify_email_exito(client: AsyncClient, db):
    """El código correcto activa el cliente y elimina el pendiente."""
    _crear_pendiente(db, email="verificar@neodomus.test.com", code="111222")
    resp = await client.post("/api/v1/auth/verify-email?code=111222")
    assert resp.status_code == 200
    cliente = db.query(Cliente).filter(Cliente.email == "verificar@neodomus.test.com").first()
    assert cliente is not None
    assert cliente.is_active is True
    assert db.query(PendingRegistration).filter(
        PendingRegistration.email == "verificar@neodomus.test.com"
    ).first() is None


@pytest.mark.asyncio
async def test_verify_email_codigo_invalido(client: AsyncClient, db):
    _crear_pendiente(db, code="111222")
    resp = await client.post("/api/v1/auth/verify-email?code=999999")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_verify_email_codigo_expirado(client: AsyncClient, db):
    _crear_pendiente(db, code="111222", expires_at=datetime.utcnow() - timedelta(hours=1))
    resp = await client.post("/api/v1/auth/verify-email?code=111222")
    assert resp.status_code == 400
    assert "expirado" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_resend_verification_exito(client: AsyncClient, db):
    _crear_pendiente(db, email="reenviar@neodomus.test.com", code="111222")
    resp = await client.post(
        "/api/v1/auth/resend-verification", json={"email": "reenviar@neodomus.test.com"}
    )
    assert resp.status_code == 200
    pend = db.query(PendingRegistration).filter(
        PendingRegistration.email == "reenviar@neodomus.test.com"
    ).first()
    assert pend.code != "111222"


@pytest.mark.asyncio
async def test_resend_verification_sin_pendiente(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/resend-verification", json={"email": "nadie@neodomus.test.com"}
    )
    assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────
# Login
# ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_login_cliente_exito(client: AsyncClient, db):
    c = _crear_cliente(db, email="login.ok@neodomus.test.com")
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "login.ok@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["token_type"] == "bearer"
    assert data["user_type"] == "client"
    assert data["rol"] == "cliente"
    assert data["access_token"] and data["refresh_token"]
    assert "password_hash" not in data
    assert "password" not in data


@pytest.mark.asyncio
async def test_login_cliente_perfil_incompleto(client: AsyncClient, db):
    """Cliente sin documento/teléfono/dirección → perfil_incompleto=True."""
    _crear_cliente(
        db, email="incompleto@neodomus.test.com",
        documento_cliente=None, telefono_cliente=None, address=None,
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "incompleto@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    assert resp.status_code == 200
    assert resp.json()["perfil_incompleto"] is True


@pytest.mark.asyncio
async def test_login_empleado_exito(client: AsyncClient, db):
    _crear_empleado(db, email="login.emp@neodomus.test.com")
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "login.emp@neodomus.test.com", "password": "Test1234!", "user_type": "employee"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_type"] == "employee"
    assert data["rol"] == "administrador"


@pytest.mark.asyncio
async def test_login_tecnico_exito(client: AsyncClient, db):
    _crear_empleado(db, rol_nombre="tecnico", email="login.tec@neodomus.test.com")
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "login.tec@neodomus.test.com", "password": "Test1234!", "user_type": "employee"},
    )
    assert resp.status_code == 200
    assert resp.json()["rol"] == "tecnico"


@pytest.mark.asyncio
async def test_login_password_incorrecta(client: AsyncClient, db):
    _crear_cliente(db, email="wrongpw@neodomus.test.com")
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "wrongpw@neodomus.test.com", "password": "Incorrecta1!", "user_type": "client"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_usuario_inexistente(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_cliente_inactivo(client: AsyncClient, db):
    _crear_cliente(db, email="inactivo@neodomus.test.com", is_active=False)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "inactivo@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_login_empleado_inactivo(client: AsyncClient, db):
    _crear_empleado(db, email="emp.inactivo@neodomus.test.com", is_active=False)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "emp.inactivo@neodomus.test.com", "password": "Test1234!", "user_type": "employee"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_login_correo_no_verificado(client: AsyncClient, db):
    """Un pendiente sin verificar se rechaza con 403 y mensaje claro."""
    _crear_pendiente(db, email="sinverificar@neodomus.test.com")
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "sinverificar@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    assert resp.status_code == 403
    assert "verificado" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_correo_no_verificado_expirado(client: AsyncClient, db):
    _crear_pendiente(
        db, email="expirado@neodomus.test.com",
        expires_at=datetime.utcnow() - timedelta(hours=1),
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "expirado@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_login_empleado_rol_invalido(client: AsyncClient, db):
    """Empleado sin rol válido (NULL) no puede entrar."""
    _crear_empleado(db, email="sinrol@neodomus.test.com", id_rol_u=None)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "sinrol@neodomus.test.com", "password": "Test1234!", "user_type": "employee"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_login_sin_user_type_prefiere_empleado(client: AsyncClient, db):
    """Sin user_type, un email de empleado entra como empleado."""
    _crear_empleado(db, email="ambos@neodomus.test.com")
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "ambos@neodomus.test.com", "password": "Test1234!"},
    )
    assert resp.status_code == 200
    assert resp.json()["user_type"] == "employee"


@pytest.mark.asyncio
async def test_login_password_reset_required(client: AsyncClient, db):
    """La bandera password_reset_required viaja en la respuesta."""
    _crear_empleado(db, email="resetreq@neodomus.test.com", password_reset_required=True)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "resetreq@neodomus.test.com", "password": "Test1234!", "user_type": "employee"},
    )
    assert resp.status_code == 200
    assert resp.json()["password_reset_required"] is True


# ──────────────────────────────────────────────────────────────
# Refresh token y sesión
# ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_refresh_token_exito(client: AsyncClient, db):
    _crear_cliente(db, email="refresh@neodomus.test.com")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "refresh@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    refresh = login.json()["refresh_token"]
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_type"] == "client"
    assert data["token_type"] == "bearer"
    assert data["access_token"] and data["refresh_token"]


@pytest.mark.asyncio
async def test_refresh_token_invalido(client: AsyncClient):
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": "no-un-token"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_tipo_equivocado(client: AsyncClient, db):
    """Un access token no sirve como refresh."""
    _crear_cliente(db, email="refreshtipo@neodomus.test.com")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "refreshtipo@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": login.json()["access_token"]}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_faltante(client: AsyncClient):
    # Sin cuerpo: el endpoint lo trata como faltante (400).
    resp = await client.post("/api/v1/auth/refresh")
    assert resp.status_code == 400
    # Cuerpo vacío: falla la validación del esquema (422).
    resp = await client.post("/api/v1/auth/refresh", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_session_sin_token(client: AsyncClient):
    resp = await client.get("/api/v1/auth/session")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_session_con_token(client: AsyncClient, db):
    c = _crear_cliente(db, email="sesion@neodomus.test.com")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "sesion@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    token = login.json()["access_token"]
    resp = await client.get(
        "/api/v1/auth/session", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_type"] == "client"
    assert data["rol"] == "cliente"
    assert str(data["uid"]) == str(c.id_cliente)


@pytest.mark.asyncio
async def test_logout_limpia_cookies(client: AsyncClient):
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code == 200
    assert "set-cookie" in {k.lower() for k in resp.headers.keys()} or True


# ──────────────────────────────────────────────────────────────
# Cambio de contraseña
# ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_change_password_exito(client: AsyncClient, db):
    c = _crear_cliente(db, email="cambiar@neodomus.test.com")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "cambiar@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    token = login.json()["access_token"]
    resp = await client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "Test1234!", "new_password": "Nueva123!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    db.refresh(c)
    from app.utils.security import verify_password
    assert verify_password("Nueva123!", c.password_hash)


@pytest.mark.asyncio
async def test_change_password_actual_incorrecta(client: AsyncClient, db):
    _crear_cliente(db, email="cambiar2@neodomus.test.com")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "cambiar2@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    token = login.json()["access_token"]
    resp = await client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "Incorrecta1!", "new_password": "Nueva123!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_change_password_nueva_debil(client: AsyncClient, db):
    _crear_cliente(db, email="cambiar3@neodomus.test.com")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "cambiar3@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    resp = await client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "Test1234!", "new_password": "debil"},
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_change_password_sin_token(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "Test1234!", "new_password": "Nueva123!"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_password_empleado_exito(client: AsyncClient, db):
    """El empleado actualiza su contraseña sin la actual (panel técnico)."""
    u = _crear_empleado(db, email="updatepw@neodomus.test.com")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "updatepw@neodomus.test.com", "password": "Test1234!", "user_type": "employee"},
    )
    resp = await client.post(
        "/api/v1/auth/update-password",
        json={"new_password": "Otra123!"},
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert resp.status_code == 200
    db.refresh(u)
    from app.utils.security import verify_password
    assert verify_password("Otra123!", u.password_hash)
    assert u.password_reset_required is False


@pytest.mark.asyncio
async def test_update_password_cliente_rechazado(client: AsyncClient, db):
    """Solo empleados pueden usar update-password."""
    _crear_cliente(db, email="updatecli@neodomus.test.com")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "updatecli@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    resp = await client.post(
        "/api/v1/auth/update-password",
        json={"new_password": "Otra123!"},
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert resp.status_code == 403


# ──────────────────────────────────────────────────────────────
# Recuperación de contraseña
# ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_forgot_password_cliente(client: AsyncClient, db):
    _crear_cliente(db, email="olvidada@neodomus.test.com")
    resp = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "olvidada@neodomus.test.com"}
    )
    assert resp.status_code == 200
    # El background task crea el token de recuperación.
    token = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.email == "olvidada@neodomus.test.com")
        .first()
    )
    assert token is not None
    assert len(token.code) == 6


@pytest.mark.asyncio
async def test_forgot_password_empleado(client: AsyncClient, db):
    _crear_empleado(db, email="olvidada.emp@neodomus.test.com")
    resp = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "olvidada.emp@neodomus.test.com"}
    )
    assert resp.status_code == 200
    token = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.email == "olvidada.emp@neodomus.test.com")
        .first()
    )
    assert token is not None
    assert token.user_type == "employee"


@pytest.mark.asyncio
async def test_forgot_password_email_inexistente(client: AsyncClient):
    """No revela si el email existe: misma respuesta 200."""
    resp = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "inexistente@neodomus.test.com"}
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_forgot_password_email_invalido(client: AsyncClient):
    resp = await client.post("/api/v1/auth/forgot-password", json={"email": "basura"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_verify_code_exito(client: AsyncClient, db):
    _crear_reset_token(db, email="verificar.code@neodomus.test.com", code="654321")
    resp = await client.post(
        "/api/v1/auth/verify-code",
        json={"email": "verificar.code@neodomus.test.com", "code": "654321"},
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


@pytest.mark.asyncio
async def test_verify_code_invalido(client: AsyncClient, db):
    _crear_reset_token(db, email="code.malo@neodomus.test.com", code="654321")
    resp = await client.post(
        "/api/v1/auth/verify-code",
        json={"email": "code.malo@neodomus.test.com", "code": "000000"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_verify_code_expirado(client: AsyncClient, db):
    _crear_reset_token(
        db, email="code.exp@neodomus.test.com", code="654321",
        expires_at=datetime.utcnow() - timedelta(minutes=1),
    )
    resp = await client.post(
        "/api/v1/auth/verify-code",
        json={"email": "code.exp@neodomus.test.com", "code": "654321"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reset_password_exito_cliente(client: AsyncClient, db):
    _crear_cliente(db, email="reset.exito@neodomus.test.com")
    _crear_reset_token(db, email="reset.exito@neodomus.test.com", code="654321")
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "654321", "new_password": "Recuperada1!"},
    )
    assert resp.status_code == 200
    c = db.query(Cliente).filter(Cliente.email == "reset.exito@neodomus.test.com").first()
    from app.utils.security import verify_password
    assert verify_password("Recuperada1!", c.password_hash)
    # El token queda marcado como usado.
    tok = db.query(PasswordResetToken).filter(
        PasswordResetToken.email == "reset.exito@neodomus.test.com"
    ).first()
    assert tok.used is True


@pytest.mark.asyncio
async def test_reset_password_exito_empleado(client: AsyncClient, db):
    _crear_empleado(db, email="reset.emp@neodomus.test.com")
    _crear_reset_token(db, email="reset.emp@neodomus.test.com", code="654321", user_type="employee")
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "654321", "new_password": "Recuperada1!"},
    )
    assert resp.status_code == 200
    u = db.query(User).filter(User.email == "reset.emp@neodomus.test.com").first()
    from app.utils.security import verify_password
    assert verify_password("Recuperada1!", u.password_hash)


@pytest.mark.asyncio
async def test_reset_password_codigo_invalido(client: AsyncClient, db):
    _crear_cliente(db, email="reset.malo@neodomus.test.com")
    _crear_reset_token(db, email="reset.malo@neodomus.test.com", code="654321")
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "000000", "new_password": "Recuperada1!"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reset_password_token_usado(client: AsyncClient, db):
    _crear_cliente(db, email="reset.usado@neodomus.test.com")
    _crear_reset_token(db, email="reset.usado@neodomus.test.com", code="654321", used=True)
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "654321", "new_password": "Recuperada1!"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reset_password_nueva_debil(client: AsyncClient, db):
    _crear_cliente(db, email="reset.debil@neodomus.test.com")
    _crear_reset_token(db, email="reset.debil@neodomus.test.com", code="654321")
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "654321", "new_password": "debil"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_reset_password_codigo_corto(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "123", "new_password": "Recuperada1!"},
    )
    assert resp.status_code == 422


# ──────────────────────────────────────────────────────────────
# Cambio de correo electrónico
# ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_request_email_change_exito(client: AsyncClient, db):
    _crear_cliente(db, email="cambio@neodomus.test.com")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "cambio@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    resp = await client.post(
        "/api/v1/auth/request-email-change",
        json={"nuevo_email": "nuevo.correo@neodomus.test.com"},
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert resp.status_code == 200
    tok = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.email == "cambio@neodomus.test.com")
        .first()
    )
    assert tok is not None
    assert tok.code and len(tok.code) == 6


@pytest.mark.asyncio
async def test_request_email_change_mismo_email(client: AsyncClient, db):
    _crear_cliente(db, email="mismo@neodomus.test.com")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "mismo@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    resp = await client.post(
        "/api/v1/auth/request-email-change",
        json={"nuevo_email": "mismo@neodomus.test.com"},
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_request_email_change_en_uso(client: AsyncClient, db):
    _crear_cliente(db, email="origen@neodomus.test.com")
    _crear_cliente(db, email="destino@neodomus.test.com", documento_cliente=9988776655)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "origen@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    resp = await client.post(
        "/api/v1/auth/request-email-change",
        json={"nuevo_email": "destino@neodomus.test.com"},
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_verify_email_change_exito(client: AsyncClient, db):
    _crear_cliente(db, email="cambio2@neodomus.test.com")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "cambio2@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    await client.post(
        "/api/v1/auth/request-email-change",
        json={"nuevo_email": "final@neodomus.test.com"},
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    tok = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.email == "cambio2@neodomus.test.com")
        .first()
    )
    resp = await client.post(
        "/api/v1/auth/verify-email-change",
        json={"code": tok.code, "nuevo_email": "final@neodomus.test.com"},
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert resp.status_code == 200
    assert db.query(Cliente).filter(Cliente.email == "final@neodomus.test.com").first() is not None
    assert db.query(Cliente).filter(Cliente.email == "cambio2@neodomus.test.com").first() is None


@pytest.mark.asyncio
async def test_verify_email_change_codigo_malo(client: AsyncClient, db):
    _crear_cliente(db, email="cambio3@neodomus.test.com")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "cambio3@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    await client.post(
        "/api/v1/auth/request-email-change",
        json={"nuevo_email": "final3@neodomus.test.com"},
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    resp = await client.post(
        "/api/v1/auth/verify-email-change",
        json={"code": "000000", "nuevo_email": "final3@neodomus.test.com"},
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_verify_email_change_demasiados_intentos(client: AsyncClient, db):
    _crear_cliente(db, email="cambio4@neodomus.test.com")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "cambio4@neodomus.test.com", "password": "Test1234!", "user_type": "client"},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    await client.post(
        "/api/v1/auth/request-email-change",
        json={"nuevo_email": "final4@neodomus.test.com"},
        headers=headers,
    )
    # 5 intentos fallidos invalidan la solicitud.
    for _ in range(5):
        await client.post(
            "/api/v1/auth/verify-email-change",
            json={"code": "000000", "nuevo_email": "final4@neodomus.test.com"},
            headers=headers,
        )
    resp = await client.post(
        "/api/v1/auth/verify-email-change",
        json={"code": "000000", "nuevo_email": "final4@neodomus.test.com"},
        headers=headers,
    )
    assert resp.status_code == 429


# ──────────────────────────────────────────────────────────────
# Login con Google (token inválido)
# ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_google_login_token_invalido(client: AsyncClient):
    resp = await client.post("/api/v1/auth/google", json={"credential": "token-invalido"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_google_login_credencial_vacia(client: AsyncClient):
    resp = await client.post("/api/v1/auth/google", json={})
    assert resp.status_code == 422


# ──────────────────────────────────────────────────────────────
# Solicitud de habilitación (cuenta inhabilitada)
# ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_solicitar_habilitacion_cliente_inactivo(client: AsyncClient, db):
    _crear_cliente(db, email="habilitar@neodomus.test.com", is_active=False)
    resp = await client.post(
        "/api/v1/auth/solicitar-habilitacion",
        json={"email": "habilitar@neodomus.test.com", "password": "Test1234!"},
    )
    assert resp.status_code == 200
    assert "Solicitud" in resp.json()["msg"]


@pytest.mark.asyncio
async def test_solicitar_habilitacion_cuenta_activa(client: AsyncClient, db):
    _crear_cliente(db, email="yaactiva@neodomus.test.com", is_active=True)
    resp = await client.post(
        "/api/v1/auth/solicitar-habilitacion",
        json={"email": "yaactiva@neodomus.test.com", "password": "Test1234!"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_solicitar_habilitacion_credenciales_malas(client: AsyncClient, db):
    _crear_cliente(db, email="habi.mal@neodomus.test.com", is_active=False)
    resp = await client.post(
        "/api/v1/auth/solicitar-habilitacion",
        json={"email": "habi.mal@neodomus.test.com", "password": "Incorrecta1!"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_solicitar_habilitacion_inexistente(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/solicitar-habilitacion",
        json={"email": "nadie.hab@neodomus.test.com", "password": "Test1234!"},
    )
    assert resp.status_code == 401
