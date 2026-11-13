"""
Módulo: services/auth_service.py
Lógica de negocio para autenticación en Neodomus.
"""

import json
import secrets
import unicodedata
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.cliente import Cliente
from app.models.email_verification_token import EmailVerificationToken
from app.models.password_reset_token import PasswordResetToken
from app.models.pending_registration import PendingRegistration
from app.models.refresh_token import RefreshToken
from app.models.roles_usuario import RolesUsuario
from app.models.solicitud_cuenta import SolicitudCuenta
from app.models.solicitud_habilitacion_empleado import SolicitudHabilitacionEmpleado
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ClientCreate,
    ResetPasswordRequest,
    TokenResponse,
    UserLogin,
)
from app.utils.audit_log import (
    log_email_verified,
    log_login_failed,
    log_login_success,
    log_password_changed,
    log_password_reset_requested,
)
from app.utils.email import (
    send_email_change_code,
    send_password_reset_code,
    send_verification_email,
)
from app.utils.fechas import ahora_utc_naiva
from app.utils.respaldo_usuarios import respaldar_usuarios
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

# Roles válidos para empleados (provenientes de roles_usuario)
ROLES_EMPLEADOS_VALIDOS = {"admin", "administrador", "tecnico"}


def normalizar_rol_empleado(role_name: str | None) -> str | None:
    """Devuelve el rol de empleado en forma canónica, tolerando tildes y mayúsculas."""
    if not role_name:
        return None
    normalized = unicodedata.normalize("NFKD", role_name.strip().lower())
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    return normalized if normalized in ROLES_EMPLEADOS_VALIDOS else None

# ──────────────────────────────────────────────────────────────────
# 🔍 Funciones auxiliares
# ──────────────────────────────────────────────────────────────────

def _get_user_by_email(db: Session, email: str) -> User | None:
    normalized_email = (email or "").strip().lower()
    return db.execute(
        select(User)
        .where(func.lower(func.trim(User.email)) == normalized_email)
        .limit(1)
    ).scalars().first()

def _get_client_by_email(db: Session, email: str) -> Cliente | None:
    normalized_email = (email or "").strip().lower()
    return db.execute(
        select(Cliente)
        .where(func.lower(func.trim(Cliente.email)) == normalized_email)
        .limit(1)
    ).scalars().first()


def _cliente_perfil_incompleto(cliente: Cliente | None) -> bool:
    """True si al cliente le faltan datos obligatorios (documento, teléfono o dirección).

    Las cuentas creadas con Google nacen sin estos datos; el cliente debe
    completarlos antes de poder usar la plataforma.
    """
    if cliente is None:
        return False
    return not (
        cliente.id_tipo_documento_c
        and cliente.documento_cliente
        and cliente.telefono_cliente
        and bool((cliente.address or "").strip())
    )

def _build_token_pair(
    user_id: int,
    email: str,
    user_type: str,
    rol: str = None,
    family_id: str = None,
) -> tuple[TokenResponse, RefreshToken]:
    """Construye un par access/refresh y el registro que lo respalda."""
    jti = uuid4().hex
    family_id = family_id or uuid4().hex
    access = create_access_token(
        {"sub": email}, user_type=user_type, rol=rol, user_id=user_id
    )
    refresh = create_refresh_token(
        {"sub": email},
        user_type=user_type,
        rol=rol,
        user_id=user_id,
        jti=jti,
        family_id=family_id,
    )
    respuesta = TokenResponse(
        access_token=access,
        refresh_token=refresh,
        token_type="bearer",
        user_type=user_type,
        rol=rol,
    )
    registro = RefreshToken(
        jti=jti,
        family_id=family_id,
        user_id=user_id,
        user_type=user_type,
        expires_at=ahora_utc_naiva() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    return respuesta, registro


def _create_tokens(
    db: Session,
    user_id: int,
    email: str,
    user_type: str,
    rol: str = None,
    password_reset_required: bool = False,
    family_id: str = None,
) -> TokenResponse:
    respuesta, registro = _build_token_pair(
        user_id, email, user_type, rol=rol, family_id=family_id
    )
    respuesta.password_reset_required = password_reset_required
    db.add(registro)
    db.commit()
    return respuesta

# ──────────────────────────────────────────────────────────────────
# 📝 Registro y verificación de clientes (con pendientes)
# ──────────────────────────────────────────────────────────────────

# Consulta PendingRegistration; confirma los cambios con la sesión de base de datos.
async def register_client(db: Session, client_data: ClientCreate, background_tasks=None) -> dict:
    """Registra a un cliente nuevo y envía el código de verificación por correo.

    Los datos y la contraseña cifrada NO se guardan aún en ``clientes``: se
    guardan en ``pending_registrations`` junto con un código de 6 dígitos
    vigente durante ``VERIFICATION_TOKEN_EXPIRE_HOURS``. La cuenta solo se
    crea al verificar el correo con ``verify_client_email``. Si existía un
    registro pendiente previo para el mismo correo, se reemplaza.

    Args:
        db: Sesión de base de datos; la función hace commit.
        client_data: Datos del formulario de registro validados por el schema
            ``ClientCreate``.
        background_tasks: ``BackgroundTasks`` de FastAPI para enviar el
            correo de forma asíncrona y responder de inmediato. Si es None,
            el envío se hace de forma síncrona y un fallo revierte el
            registro pendiente.

    Returns:
        dict: ``{"msg": "Registro pendiente..."}`` con el mensaje que se
        muestra al usuario.

    Raises:
        HTTPException: 400 si el email ya está registrado como cliente.

    Comportamiento a conocer: la unicidad del correo se comprueba solo
    contra la tabla de clientes; un correo usado por un empleado puede
    registrarse aquí como cliente (el login sin ``user_type`` dará
    prioridad a la cuenta de empleado).
    """
    if _get_client_by_email(db, client_data.email):
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    pending = db.query(PendingRegistration).filter(PendingRegistration.email == client_data.email).first()
    if pending:
        db.delete(pending)
        db.commit()
    hashed = hash_password(client_data.password)
    code = str(100000 + secrets.randbelow(900000))
    expires = ahora_utc_naiva() + timedelta(hours=settings.VERIFICATION_TOKEN_EXPIRE_HOURS)
    new_pending = PendingRegistration(
        first_name=client_data.first_name.upper(),
        last_name=client_data.last_name.upper(),
        id_tipo_documento_c=client_data.id_tipo_documento_c,
        documento_cliente=client_data.documento_cliente,
        telefono_cliente=client_data.telefono_cliente,
        email=client_data.email,
        address=client_data.address,
        password_hash=hashed,
        code=code,
        expires_at=expires,
    )
    db.add(new_pending)
    db.commit()
    # Envío en background para respuesta inmediata (evita UI congelada)
    # El envío se loguea dentro de utils/email.py (éxito/fallo con timeout)
    if background_tasks is not None:
        background_tasks.add_task(send_verification_email, client_data.email, code)
    else:
        try:
            await send_verification_email(client_data.email, code)
        except Exception:
            db.delete(new_pending)
            db.commit()
            raise
    return {"msg": "Registro pendiente. Revisa tu correo para el código de verificación."}

# Consulta PendingRegistration; confirma los cambios con la sesión de base de datos.
def verify_client_email(db: Session, code: str) -> None:
    """Crea la cuenta del cliente a partir del registro pendiente verificado.

    Localiza el registro pendiente por su código de 6 dígitos, valida su
    vigencia, crea el cliente activo con los datos guardados, elimina el
    registro pendiente, deja traza en la auditoría (``log_email_verified``)
    y dispara el respaldo de usuarios.

    Args:
        db: Sesión de base de datos; la función hace commit.
        code: Código de verificación recibido por correo.

    Raises:
        HTTPException: 400 si el código no existe o ya expiró. El registro
            pendiente NO se elimina en ese caso; el usuario puede pedir
            uno nuevo con ``resend_verification_code``.
    """
    pending = db.query(PendingRegistration).filter(PendingRegistration.code == code).first()
    if not pending or pending.expires_at < ahora_utc_naiva():
        raise HTTPException(400, "Código inválido o expirado")
    new_client = Cliente(
        first_name=pending.first_name,
        last_name=pending.last_name,
        id_tipo_documento_c=pending.id_tipo_documento_c,
        documento_cliente=pending.documento_cliente,
        telefono_cliente=pending.telefono_cliente,
        email=pending.email,
        address=pending.address,
        password_hash=pending.password_hash,
        is_active=True,
    )
    db.add(new_client)
    db.delete(pending)
    db.commit()
    log_email_verified(pending.email)
    respaldar_usuarios()

# Consulta PendingRegistration; confirma los cambios con la sesión de base de datos.
async def resend_verification_code(db: Session, email: str) -> dict:
    pending = db.query(PendingRegistration).filter(PendingRegistration.email == email).first()
    if not pending:
        raise HTTPException(404, "No hay registro pendiente para este email")
    new_code = str(100000 + secrets.randbelow(900000))
    pending.code = new_code
    pending.expires_at = ahora_utc_naiva() + timedelta(hours=settings.VERIFICATION_TOKEN_EXPIRE_HOURS)
    db.commit()
    await send_verification_email(email, new_code)
    return {"msg": "Nuevo código enviado"}

# ──────────────────────────────────────────────────────────────────
# 📨 Solicitud de habilitación de cuenta (cuenta inhabilitada)
# ──────────────────────────────────────────────────────────────────

def solicitar_habilitacion(db: Session, email: str, password: str) -> dict:
    """Verifica las credenciales del cliente o del empleado (técnico) y crea
    una solicitud de habilitación para que el administrador la apruebe. La
    cuenta NO se habilita automáticamente."""
    client = _get_client_by_email(db, email)
    if client:
        return _solicitar_habilitacion_cliente(db, client, password)

    user = _get_user_by_email(db, email)
    if user:
        return _solicitar_habilitacion_empleado(db, user, password)

    raise HTTPException(401, "Credenciales inválidas")


# Consulta SolicitudCuenta; confirma los cambios con la sesión de base de datos.
def _solicitar_habilitacion_cliente(db: Session, client: Cliente, password: str) -> dict:
    if not verify_password(password, client.password_hash):
        raise HTTPException(401, "Credenciales inválidas")
    if client.is_active:
        raise HTTPException(400, "Tu cuenta ya está activa")
    pendiente = (
        db.query(SolicitudCuenta)
        .filter(
            SolicitudCuenta.id_cliente == client.id_cliente,
            SolicitudCuenta.estado == "pendiente",
        )
        .first()
    )
    if pendiente:
        raise HTTPException(400, "Ya tienes una solicitud pendiente de revisión")
    solicitud = SolicitudCuenta(id_cliente=client.id_cliente, tipo="habilitar", estado="pendiente")
    db.add(solicitud)
    db.commit()
    from app.routers.solicitudes import _alertar_admin_nueva_solicitud

    _alertar_admin_nueva_solicitud(db, client, "habilitar", None)
    return {"msg": "Solicitud de habilitación enviada al administrador"}


# Consulta SolicitudHabilitacionEmpleado; confirma los cambios con la sesión de base de datos.
def _solicitar_habilitacion_empleado(db: Session, user: User, password: str) -> dict:
    if not verify_password(password, user.password_hash):
        raise HTTPException(401, "Credenciales inválidas")
    if user.is_active:
        raise HTTPException(400, "Tu cuenta ya está activa")
    pendiente = (
        db.query(SolicitudHabilitacionEmpleado)
        .filter(
            SolicitudHabilitacionEmpleado.id_usuario == user.id_usuario,
            SolicitudHabilitacionEmpleado.estado == "pendiente",
        )
        .first()
    )
    if pendiente:
        raise HTTPException(400, "Ya tienes una solicitud pendiente de revisión")
    solicitud = SolicitudHabilitacionEmpleado(id_usuario=user.id_usuario, estado="pendiente")
    db.add(solicitud)
    db.commit()
    from app.routers.solicitudes import _alertar_admin_nueva_solicitud

    _alertar_admin_nueva_solicitud(db, user, "habilitar", None)
    return {"msg": "Solicitud de habilitación enviada al administrador"}

# ──────────────────────────────────────────────────────────────────
# 🔐 Login unificado (con rol)
# ──────────────────────────────────────────────────────────────────

# Consulta PendingRegistration.
def login(db: Session, login_data: UserLogin) -> TokenResponse:
    """Autentica a un cliente o empleado y emite el par de tokens JWT.

    El correo se busca en ambas tablas (usuarios y clientes). Con
    ``user_type`` explícito solo se intenta esa rama; sin ``user_type`` se
    intenta primero como empleado y, si falla con 401, como cliente: así
    un administrador con el mismo correo en ambas tablas entra a su panel.

    Validaciones en orden para empleados: contraseña, cuenta activa y rol
    válido (``normalizar_rol_empleado``). Para clientes: correo verificado
    (si existe registro pendiente se rechaza con mensaje específico),
    contraseña y cuenta activa. Cada intento fallido se registra en la
    auditoría con su motivo.

    Args:
        db: Sesión de base de datos; registra el refresh token emitido.
        login_data: Credenciales con ``email``, ``password`` y
            ``user_type`` (``"employee"`` | ``"client"`` | ``None``).

    Returns:
        TokenResponse: tokens de acceso y refresco, tipo de usuario, rol
        canónico, ``password_reset_required`` (empleados) y
        ``perfil_incompleto`` (clientes a los que les faltan documento,
        teléfono o dirección).

    Raises:
        HTTPException: 401 credenciales inválidas; 403 cuenta inhabilitada,
            rol inválido o correo sin verificar; 400 correo sin verificar
            cuyo código de registro ya expiró.
    """
    email = login_data.email
    password = login_data.password
    user_type = login_data.user_type

    def _login_employee(user: User | None) -> TokenResponse:
        """Valida y emite tokens para una cuenta de empleado (administrador/técnico)."""
        if not user or not verify_password(password, user.password_hash):
            log_login_failed(email, "invalid_credentials", "employee")
            raise HTTPException(401, "Credenciales inválidas")
        if not user.is_active:
            log_login_failed(email, "account_inactive", "employee")
            raise HTTPException(403, "Tu cuenta está inhabilitada")
        role_name = None
        if user.id_rol_u:
            rol = db.execute(select(RolesUsuario.nombre_rol).where(RolesUsuario.id_rol == user.id_rol_u)).scalar_one_or_none()
            role_name = rol
        role_name = normalizar_rol_empleado(role_name)
        if not role_name:
            log_login_failed(email, "invalid_role", "employee")
            raise HTTPException(403, "Tu cuenta no tiene un rol válido asignado. Contacta al administrador.")
        log_login_success(email, "employee")
        return _create_tokens(
            db,
            user.id_usuario,
            email,
            "employee",
            rol=role_name,
            password_reset_required=bool(user.password_reset_required),
        )

    def _login_cliente(client: Cliente | None) -> TokenResponse:
        """Valida y emite tokens para una cuenta de cliente."""
        # Verificación de correo: si hay un registro pendiente (registro sin
        # verificar), se rechaza con un mensaje claro en lugar de credenciales inválidas.
        pending = db.query(PendingRegistration).filter(PendingRegistration.email == email).first()
        if pending:
            log_login_failed(email, "email_not_verified", "client")
            if pending.expires_at < ahora_utc_naiva():
                raise HTTPException(
                    400,
                    "Tu correo no ha sido verificado y el código expiró. Solicita uno nuevo.",
                )
            raise HTTPException(
                403,
                "Tu correo no ha sido verificado. Revisa tu correo para ingresar el código de verificación.",
            )
        if not client or not verify_password(password, client.password_hash):
            log_login_failed(email, "invalid_credentials", "client")
            raise HTTPException(401, "Credenciales inválidas")
        if not client.is_active:
            log_login_failed(email, "account_inactive", "client")
            raise HTTPException(403, "Tu cuenta está inhabilitada")
        log_login_success(email, "client")
        respuesta = _create_tokens(db, client.id_cliente, email, "client", rol="cliente")
        respuesta.perfil_incompleto = _cliente_perfil_incompleto(client)
        return respuesta

    user = _get_user_by_email(db, email)
    client = _get_client_by_email(db, email)

    if user_type == "employee":
        return _login_employee(user)
    if user_type == "client":
        return _login_cliente(client)

    # Login sin especificar user_type: si el correo pertenece a un empleado
    # (administrador/técnico) y también a un cliente, se prefiere la cuenta de
    # empleado para que el administrador entre a su panel.
    if user:
        try:
            return _login_employee(user)
        except HTTPException as exc:
            if exc.status_code != 401:
                raise
    return _login_cliente(client)

# ──────────────────────────────────────────────────────────────────
# 🔄 Refresco de token
# ──────────────────────────────────────────────────────────────────

def _mark_refresh_tokens_revoked(records: list[RefreshToken], reason: str) -> None:
    ahora = ahora_utc_naiva()
    for record in records:
        record.revoked_at = ahora
        record.revoked_reason = reason


def _revoke_refresh_family(db: Session, family_id: str, reason: str) -> None:
    """Revoca todos los tokens vigentes de una misma sesión/dispositivo."""
    records = db.execute(
        select(RefreshToken).where(
            RefreshToken.family_id == family_id,
            RefreshToken.revoked_at.is_(None),
        )
    ).scalars().all()
    _mark_refresh_tokens_revoked(records, reason)


def _get_active_refresh_record(
    db: Session,
    jti: str,
    user_type: str,
    user_id: int,
) -> RefreshToken:
    """Devuelve el registro vigente del token o falla si fue revocado/expirado.

    Si el token ya fue rotado/revocado se asume reuso y se revoca toda la
    familia, invalidando cualquier acceso derivado de esa sesión.
    """
    record = db.execute(
        select(RefreshToken).where(RefreshToken.jti == jti).with_for_update()
    ).scalar_one_or_none()
    if record is None or record.user_type != user_type or record.user_id != user_id:
        raise HTTPException(401, "Refresh token inválido")
    if record.revoked_at is not None:
        _revoke_refresh_family(db, record.family_id, "reuse")
        db.commit()
        raise HTTPException(401, "Refresh token revocado")
    if record.expires_at <= ahora_utc_naiva():
        record.revoked_at = ahora_utc_naiva()
        record.revoked_reason = "expired"
        db.commit()
        raise HTTPException(401, "Refresh token expirado")
    return record


def _rotate_refresh_token(db: Session, actual: RefreshToken, nuevo: RefreshToken) -> None:
    """Registra el token nuevo y marca el anterior como rotado."""
    db.add(nuevo)
    actual.revoked_at = ahora_utc_naiva()
    actual.revoked_reason = "rotated"
    actual.replaced_by_jti = nuevo.jti
    db.commit()


def revoke_refresh_token(db: Session, refresh_token: str, reason: str = "logout") -> None:
    """Revoca la sesión asociada a un refresh token (operación idempotente)."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return
    family_id = payload.get("sid")
    jti = payload.get("jti")
    if jti:
        record = db.execute(
            select(RefreshToken).where(RefreshToken.jti == jti)
        ).scalar_one_or_none()
        if record:
            family_id = record.family_id
    if not family_id:
        return
    _revoke_refresh_family(db, family_id, reason)
    db.commit()


def revoke_user_refresh_tokens(
    db: Session,
    user_id: int,
    user_type: str,
    reason: str = "password_changed",
) -> None:
    """Revoca todas las sesiones vigentes de una cuenta."""
    records = db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.user_type == user_type,
            RefreshToken.revoked_at.is_(None),
        )
    ).scalars().all()
    _mark_refresh_tokens_revoked(records, reason)


# Consulta User, Cliente.
def refresh_access_token(db: Session, refresh_token: str) -> TokenResponse:
    """Rota un refresh token vigente y emite un par nuevo.

    Valida firma y tipo del JWT, exige ``jti``/``sid`` registrados en la base,
    comprueba identidad y cuenta activa, marca el token usado como rotado y
    crea uno nuevo dentro de la misma familia. Reutilizar un token ya rotado
    revoca toda la familia.

    Args:
        db: Sesión de base de datos; confirma la rotación.
        refresh_token: JWT de refresco emitido por el login.

    Returns:
        TokenResponse: nuevo par access/refresh con la misma identidad,
        rol y marcas de estado del usuario.

    Raises:
        HTTPException: 401 si el token es inválido, no es de refresco, fue
            revocado/reutilizado, expiró, o la cuenta ya no está activa.
    """
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(401, "Refresh token inválido")
    email = payload.get("sub")
    user_type = payload.get("user_type")
    jti = payload.get("jti")
    family_id = payload.get("sid")
    uid = payload.get("uid")
    if not email or user_type not in ("employee", "client") or not jti or not family_id or uid is None:
        raise HTTPException(401, "Token malformado")
    try:
        user_id = int(uid)
    except (TypeError, ValueError):
        raise HTTPException(401, "Token malformado")

    if user_type == "employee":
        user = db.query(User).filter(User.id_usuario == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(401, "Usuario no válido")
        record = _get_active_refresh_record(db, jti, user_type, user_id)
        respuesta, nuevo = _build_token_pair(
            user.id_usuario,
            email,
            "employee",
            rol=payload.get("rol"),
            family_id=record.family_id,
        )
        respuesta.password_reset_required = bool(user.password_reset_required)
    else:
        client = db.query(Cliente).filter(Cliente.id_cliente == user_id).first()
        if not client or not client.is_active:
            raise HTTPException(401, "Cliente no válido")
        record = _get_active_refresh_record(db, jti, user_type, user_id)
        respuesta, nuevo = _build_token_pair(
            client.id_cliente,
            email,
            "client",
            rol="cliente",
            family_id=record.family_id,
        )
        respuesta.perfil_incompleto = _cliente_perfil_incompleto(client)

    _rotate_refresh_token(db, record, nuevo)
    return respuesta

# ──────────────────────────────────────────────────────────────────
# 🔒 Cambio de contraseña
# ──────────────────────────────────────────────────────────────────

# confirma los cambios con la sesión de base de datos.
def change_password(db: Session, current_user: User | Cliente, req: ChangePasswordRequest, ip: str = None) -> None:
    if isinstance(current_user, User):
        stored_hash = current_user.password_hash
        email = current_user.email
        user_type = "employee"
        user_id = current_user.id_usuario
    else:
        stored_hash = current_user.password_hash
        email = current_user.email
        user_type = "client"
        user_id = current_user.id_cliente
    if not verify_password(req.current_password, stored_hash):
        raise HTTPException(400, "Contraseña actual incorrecta")
    new_hash = hash_password(req.new_password)
    if isinstance(current_user, User):
        current_user.password_hash = new_hash
        current_user.password_reset_required = False
    else:
        current_user.password_hash = new_hash
    revoke_user_refresh_tokens(db, user_id, user_type, reason="password_changed")
    db.commit()
    log_password_changed(str(user_id), user_type, ip)


def update_password(db: Session, current_user: User, new_password: str, ip: str = None) -> None:
    """Actualiza la contraseña de un empleado (técnico/admin) sin pedir la
    contraseña actual. Usado desde el panel del técnico (ventana emergente
    con solo nueva contraseña y confirmación)."""
    if not isinstance(current_user, User):
        raise HTTPException(403, "Solo usuarios del equipo pueden usar esta opción")
    current_user.password_hash = hash_password(new_password)
    current_user.password_reset_required = False
    revoke_user_refresh_tokens(db, current_user.id_usuario, "employee", reason="password_changed")
    db.commit()
    log_password_changed(str(current_user.id_usuario), "employee", ip)

# ──────────────────────────────────────────────────────────────────
# 📧 Recuperación de contraseña (código de 6 dígitos)
# ──────────────────────────────────────────────────────────────────

def _find_password_reset_token(
    db: Session,
    code: str,
    email: str | None = None,
) -> PasswordResetToken | None:
    """Busca un código de recuperación vigente.

    Solo considera tokens de recuperación (``token`` nulo); los tokens de
    cambio de correo también viven en esta tabla y no deben servir aquí.
    Ante posibles colisiones devuelve el más reciente.
    """
    stmt = select(PasswordResetToken).where(
        PasswordResetToken.code == code,
        PasswordResetToken.token.is_(None),
        PasswordResetToken.used == False,  # noqa: E712
        PasswordResetToken.expires_at > ahora_utc_naiva(),
    )
    if email is not None:
        stmt = stmt.where(PasswordResetToken.email == email)
    return db.execute(stmt.order_by(PasswordResetToken.id.desc())).scalars().first()


def _invalidate_active_password_reset_tokens(db: Session, email: str) -> None:
    """Marca como usados los códigos de recuperación vigentes de un correo."""
    tokens = db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.email == email,
            PasswordResetToken.token.is_(None),
            PasswordResetToken.used == False,  # noqa: E712
        )
    ).scalars().all()
    for token in tokens:
        token.used = True


# confirma los cambios con la sesión de base de datos.
async def request_password_reset(db: Session, email: str, ip: str = None) -> None:
    client = _get_client_by_email(db, email)
    user_type = None
    if client:
        user_type = "client"
    else:
        user = _get_user_by_email(db, email)
        if user:
            user_type = "employee"
    if not user_type:
        log_password_reset_requested(ip=ip)
        return
    _invalidate_active_password_reset_tokens(db, email)
    code = str(100000 + secrets.randbelow(900000))
    expires = ahora_utc_naiva() + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
    token_record = PasswordResetToken(
        email=email,
        user_type=user_type,
        code=code,
        token=None,
        expires_at=expires,
    )
    db.add(token_record)
    db.commit()
    log_password_reset_requested(email=email, user_type=user_type, ip=ip)
    try:
        await send_password_reset_code(email, code, user_type)
    except Exception as e:
        print(f"Error enviando código de recuperación a {email}: {e}")

# Valida las condiciones de esta operación y devuelve un error HTTP si no se cumplen.
def verify_password_reset_code(db: Session, email: str, code: str) -> None:
    if not _find_password_reset_token(db, code, email):
        raise HTTPException(400, "Código inválido o expirado")

# confirma los cambios con la sesión de base de datos.
def reset_password(db: Session, req: ResetPasswordRequest) -> None:
    token_rec = _find_password_reset_token(db, req.token)
    if not token_rec:
        raise HTTPException(400, "Código inválido o expirado")
    email = token_rec.email
    user_type = token_rec.user_type
    if user_type == "client":
        entity = _get_client_by_email(db, email)
        if not entity:
            raise HTTPException(400, "Cliente no encontrado")
        entity.password_hash = hash_password(req.new_password)
    else:
        entity = _get_user_by_email(db, email)
        if not entity:
            raise HTTPException(400, "Usuario no encontrado")
        entity.password_hash = hash_password(req.new_password)
    _invalidate_active_password_reset_tokens(db, email)
    entity_id = entity.id_cliente if user_type == "client" else entity.id_usuario
    revoke_user_refresh_tokens(db, entity_id, user_type, reason="password_reset")
    token_rec.used = True
    db.commit()

# ──────────────────────────────────────────────────────────────────
# ✉️ Cambio de correo electrónico (verificación con código)
# ──────────────────────────────────────────────────────────────────

def _es_correo_en_uso(db: Session, email: str) -> bool:
    """Devuelve True si el correo ya pertenece a un cliente o empleado."""
    return bool(_get_client_by_email(db, email) or _get_user_by_email(db, email))


async def request_email_change(
    db: Session,
    current_user: User | Cliente,
    nuevo_email: str,
    ip: str = None,
) -> dict:
    """Genera y envía un código de verificación al correo actual para
    autorizar el cambio de correo. El código vence en N minutos y solo
    puede usarse una vez."""
    nuevo = nuevo_email.lower().strip()
    email_actual = (current_user.email or "").lower().strip()
    if not email_actual or nuevo == email_actual:
        raise HTTPException(400, "El nuevo correo debe ser diferente al correo actual")
    if _es_correo_en_uso(db, nuevo):
        raise HTTPException(400, "El correo ya está registrado")
    user_type = "employee" if isinstance(current_user, User) else "client"

    # Invalida solicitudes de cambio previas pendientes para este correo
    previas = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.email == email_actual,
            PasswordResetToken.token.isnot(None),
            PasswordResetToken.used == False,  # noqa: E712
            PasswordResetToken.expires_at > ahora_utc_naiva(),
        )
        .all()
    )
    for p in previas:
        p.used = True

    code = str(100000 + secrets.randbelow(900000))
    expires = ahora_utc_naiva() + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
    token_record = PasswordResetToken(
        email=email_actual,
        user_type=user_type,
        code=code,
        token=json.dumps({"nuevo_email": nuevo, "intentos": 0}),
        expires_at=expires,
        ip_used=ip,
    )
    db.add(token_record)
    db.commit()
    try:
        await send_email_change_code(email_actual, code)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error enviando código de cambio de correo a {email_actual}: {e}")
    return {"msg": "Código de verificación enviado a tu correo actual"}


def verify_email_change(
    db: Session,
    current_user: User | Cliente,
    code: str,
    nuevo_email: str,
) -> dict:
    """Valida el código enviado al correo actual y aplica el cambio de correo.
    Máximo 5 intentos fallidos; al superarlos, la solicitud queda invalidada."""
    nuevo = nuevo_email.lower().strip()
    email_actual = (current_user.email or "").lower().strip()
    user_type = "employee" if isinstance(current_user, User) else "client"

    rec = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.email == email_actual,
            PasswordResetToken.user_type == user_type,
            PasswordResetToken.used == False,  # noqa: E712
            PasswordResetToken.expires_at > ahora_utc_naiva(),
        )
        .order_by(PasswordResetToken.id.desc())
        .first()
    )
    if not rec:
        raise HTTPException(400, "El código ha expirado o la solicitud ya no es válida. Solicita un nuevo código")

    datos: dict = {}
    if rec.token:
        try:
            datos = json.loads(rec.token)
        except (TypeError, ValueError):
            datos = {}
    if datos.get("nuevo_email") != nuevo:
        raise HTTPException(400, "El correo no coincide con la solicitud de cambio")

    intentos = int(datos.get("intentos", 0))
    if intentos >= 5:
        rec.used = True
        db.commit()
        raise HTTPException(429, "Demasiados intentos. Solicita un nuevo código")

    if rec.code != code:
        datos["intentos"] = intentos + 1
        rec.token = json.dumps(datos)
        db.commit()
        raise HTTPException(400, "El código de verificación es incorrecto")

    if _es_correo_en_uso(db, nuevo):
        raise HTTPException(400, "El correo ya está registrado")

    current_user.email = nuevo
    rec.used = True
    db.commit()
    return {"msg": "Correo actualizado correctamente"}

# ──────────────────────────────────────────────────────────────────
# 🌐 Login con Google (OAuth 2.0)
# ──────────────────────────────────────────────────────────────────

def google_login(db: Session, credential: str, create_client: bool = True) -> TokenResponse:
    """Verifica un ID token de Google y crea/inicia sesión como cliente."""
    import google.auth.transport.requests
    import google.oauth2.id_token

    try:
        idinfo = google.oauth2.id_token.verify_oauth2_token(
            credential,
            google.auth.transport.requests.Request(),
            settings.GOOGLE_SIGNIN_CLIENT_ID,
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Token de Google inválido o expirado")

    google_uid = idinfo.get("sub")
    email = (idinfo.get("email") or "").strip().lower()
    given_name = idinfo.get("given_name", "")
    family_name = idinfo.get("family_name", "")

    if not email or not google_uid:
        raise HTTPException(status_code=401, detail="Token de Google incompleto")

    # Una identidad Google ya vinculada prevalece sobre el correo actual.
    linked_user = db.execute(select(User).where(User.google_id == google_uid)).scalar_one_or_none()
    if linked_user:
        if not linked_user.is_active:
            raise HTTPException(status_code=403, detail="Tu cuenta está inhabilitada")
        role_name = None
        if linked_user.id_rol_u:
            role_name = db.execute(select(RolesUsuario.nombre_rol).where(RolesUsuario.id_rol == linked_user.id_rol_u)).scalar_one_or_none()
        role_name = normalizar_rol_empleado(role_name)
        if not role_name:
            raise HTTPException(status_code=403, detail="Tu cuenta no tiene un rol válido asignado. Contacta al administrador.")
        log_login_success(email, "employee")
        return _create_tokens(db, linked_user.id_usuario, linked_user.email, "employee", rol=role_name,
                              password_reset_required=bool(linked_user.password_reset_required))

    # Si el correo pertenece a un empleado (administrador/técnico), se autentica
    # como empleado en lugar de crear/usar una cuenta de cliente.
    user = _get_user_by_email(db, email)
    if user:
        if not user.is_active:
            log_login_failed(email, "account_inactive", "employee")
            raise HTTPException(403, "Tu cuenta está inhabilitada")
        role_name = None
        if user.id_rol_u:
            role_name = db.execute(select(RolesUsuario.nombre_rol).where(RolesUsuario.id_rol == user.id_rol_u)).scalar_one_or_none()
        role_name = normalizar_rol_empleado(role_name)
        if not role_name:
            log_login_failed(email, "invalid_role", "employee")
            raise HTTPException(403, "Tu cuenta no tiene un rol válido asignado. Contacta al administrador.")
        log_login_success(email, "employee")
        return _create_tokens(
            db,
            user.id_usuario,
            email,
            "employee",
            rol=role_name,
            password_reset_required=bool(user.password_reset_required),
        )

    # Buscar si ya existe un cliente con este email o google_id
    client = _get_client_by_email(db, email)
    if client is None and google_uid:
        client = db.execute(
            select(Cliente).where(Cliente.google_id == google_uid)
        ).scalar_one_or_none()

    if client:
        # Cliente existente — actualizar google_id si faltaba
        if not client.google_id:
            client.google_id = google_uid
        if client.auth_provider == "local" and client.password_hash is None:
            client.auth_provider = "google"
        db.commit()
        if not client.is_active:
            log_login_failed(email, "account_inactive", "client")
            raise HTTPException(403, "Tu cuenta está inhabilitada")
        log_login_success(email, "client")
        respuesta = _create_tokens(db, client.id_cliente, email, "client", rol="cliente")
        respuesta.perfil_incompleto = _cliente_perfil_incompleto(client)
        return respuesta

    if not create_client:
        raise HTTPException(
            status_code=409,
            detail="La cuenta Google no está vinculada. Vincula tu cuenta de empleado o continúa como cliente.",
        )

    # Cliente nuevo — crear directamente (email ya verificado por Google)
    new_client = Cliente(
        first_name=given_name.upper() if given_name else "USUARIO",
        last_name=family_name.upper() if family_name else "GOOGLE",
        email=email,
        password_hash=None,
        auth_provider="google",
        google_id=google_uid,
        is_active=True,
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    log_login_success(email, "client")
    respuesta = _create_tokens(db, new_client.id_cliente, email, "client", rol="cliente")
    respuesta.perfil_incompleto = True
    return respuesta


def link_google_employee(db: Session, credential: str, email: str, password: str) -> TokenResponse:
    """Vincula Google a una cuenta de empleado tras verificar sus credenciales actuales."""
    import google.auth.transport.requests
    import google.oauth2.id_token

    try:
        idinfo = google.oauth2.id_token.verify_oauth2_token(
            credential, google.auth.transport.requests.Request(), settings.GOOGLE_SIGNIN_CLIENT_ID
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Token de Google inválido o expirado")

    if not idinfo.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google debe confirmar el correo de la cuenta")
    google_uid = idinfo.get("sub")
    google_email = (idinfo.get("email") or "").strip().lower()
    user_email = (email or "").strip().lower()
    if not google_uid or not google_email:
        raise HTTPException(status_code=401, detail="Token de Google incompleto")

    user = _get_user_by_email(db, user_email)
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Correo o contraseña de empleado incorrectos")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tu cuenta está inhabilitada")
    role_name = None
    if user.id_rol_u:
        role_name = db.execute(select(RolesUsuario.nombre_rol).where(RolesUsuario.id_rol == user.id_rol_u)).scalar_one_or_none()
    role_name = normalizar_rol_empleado(role_name)
    if not role_name:
        raise HTTPException(status_code=403, detail="La cuenta no tiene un rol de administrador o técnico válido")

    linked_to_other = db.execute(select(User).where(User.google_id == google_uid, User.id_usuario != user.id_usuario)).scalars().first()
    if linked_to_other:
        raise HTTPException(status_code=409, detail="Esta cuenta de Google ya está vinculada a otro empleado")
    user.google_id = google_uid
    db.commit()
    log_login_success(user.email, "employee")
    return _create_tokens(db, user.id_usuario, user.email, "employee", rol=role_name,
                          password_reset_required=bool(user.password_reset_required))
