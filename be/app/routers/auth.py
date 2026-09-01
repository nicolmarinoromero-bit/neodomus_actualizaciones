"""
Módulo: routers/auth.py

¿Qué hace?
  Gestiona todo el ciclo de autenticación de usuarios: registro, login,
  verificación de email, recuperación de contraseña y flujo OAuth con Google.

Endpoints:
  - POST /auth/register/client   → Registro de cliente nuevo
  - POST /auth/verify-email      → Verificación de email con código
  - POST /auth/resend-verification → Reenvío de código de verificación
  - POST /auth/login             → Login con email/contraseña
  - POST /auth/google            → Login con credential de Google
  - POST /auth/google-code       → Login con authorization code (móvil)
  - GET  /auth/google-start      → Redirige al consent screen de Google
  - GET  /auth/google-callback   → Callback de Google OAuth
  - GET  /auth/google-result     → HTML intermedio para el móvil
  - POST /auth/solicitar-habilitacion → Solicitud para reactivar cuenta
  - POST /auth/refresh           → Renueva el access token
  - POST /auth/logout            → Cierra sesión (borra cookies)
  - GET  /auth/session           → Devuelve tipo/rol de la sesión actual
  - POST /auth/change-password   → Cambio de contraseña (requiere actual)
  - POST /auth/update-password   → Actualiza contraseña sin pedir la actual
  - POST /auth/forgot-password   → Envía código de recuperación por email
  - POST /auth/verify-code       → Valida código de recuperación
  - POST /auth/reset-password    → Restablece contraseña con token
  - POST /auth/request-email-change → Solicita cambio de correo
  - POST /auth/verify-email-change  → Confirma cambio de correo

Impacto: Sin este módulo no existiría autenticación; todos los endpoints
  protegidos quedarían inaccesibles y nadie podría iniciar sesión.
"""
import secrets
import json
import urllib.parse
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.roles_usuario import RolesUsuario
from app.models.user import User
from app.services.auth_service import (
    register_client,
    verify_client_email,
    resend_verification_code,
    login,
    refresh_access_token,
    change_password,
    update_password,
    request_password_reset,
    verify_password_reset_code,
    reset_password,
    solicitar_habilitacion,
    google_login,
    google_login_with_code,
    request_email_change,
    verify_email_change,
)
from app.schemas.auth import (
    ClientCreate,
    UserLogin,
    TokenResponse,
    ChangePasswordRequest,
    UpdatePasswordRequest,
    ResetPasswordRequest,
    VerifyCodeRequest,
    GoogleLoginRequest,
    GoogleCodeRequest,
    RequestEmailChangeRequest,
    VerifyEmailChangeRequest,
)
from app.utils.security import (
    get_current_user,
    set_auth_cookies,
    clear_auth_cookies,
    REFRESH_COOKIE_NAME,
    ACCESS_COOKIE_NAME,
    decode_token,
    create_access_token,
    create_refresh_token,
)
from app.config import settings
from app.middleware.rate_limit import limiter

router = APIRouter(prefix="/auth", tags=["Authentication"])

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordCodeRequest(BaseModel):
    token: str
    new_password: str

class ResendVerificationRequest(BaseModel):
    email: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# Registro y verificación — email en background para respuesta inmediata
@router.post("/register/client", response_model=dict)
@limiter.limit("3/minute")
async def register_client_endpoint(request: Request, client_data: ClientCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # La creación del pendiente es síncrona (rápida); el envío de correo va en background
    # para que el formulario no quede congelado esperando SMTP.
    return await register_client(db, client_data, background_tasks)

@router.post("/verify-email")
def verify_email_endpoint(code: str, db: Session = Depends(get_db)):
    verify_client_email(db, code)
    return {"msg": "Email verificado correctamente. Ya puedes iniciar sesión."}

@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification_endpoint(request: Request, req: ResendVerificationRequest, db: Session = Depends(get_db)):
    return await resend_verification_code(db, req.email)

# Login y autenticación
@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login_endpoint(request: Request, response: Response, login_data: UserLogin, db: Session = Depends(get_db)):
    result = login(db, login_data)
    # Cookies HttpOnly para la web; los tokens también van en el cuerpo para el móvil.
    set_auth_cookies(response, result.access_token, result.refresh_token)
    return result

@router.post("/google", response_model=TokenResponse)
def google_login_endpoint(response: Response, req: GoogleLoginRequest, db: Session = Depends(get_db)):
    result = google_login(db, req.credential)
    set_auth_cookies(response, result.access_token, result.refresh_token)
    return result

@router.post("/google-code", response_model=TokenResponse)
def google_code_endpoint(response: Response, req: GoogleCodeRequest, db: Session = Depends(get_db)):
    """Intercambia un authorization code de Google por tokens de sesión.
    Usado por el móvil (Expo Go) que no puede hacer el intercambio directo."""
    result = google_login_with_code(db, req.code, req.redirect_uri)
    set_auth_cookies(response, result.access_token, result.refresh_token)
    return result

@router.get("/google-start")
async def google_start(request: Request):
    """Redirige al navegador del usuario a la pantalla de consentimiento de Google.
    El redirect_uri apunta a nuestro propio /auth/google-callback (flujo server-side).
    Usado por Expo Go que no puede manejar exp:// redirect URIs."""
    if not settings.GOOGLE_SIGNIN_CLIENT_ID:
        raise HTTPException(500, "GOOGLE_SIGNIN_CLIENT_ID no configurado")

    state = secrets.token_urlsafe(32)

    if settings.GOOGLE_OAUTH_REDIRECT_BASE:
        base_url = settings.GOOGLE_OAUTH_REDIRECT_BASE.rstrip("/")
    else:
        base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/v1/auth/google-callback"

    params = {
        "client_id": settings.GOOGLE_SIGNIN_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    google_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return RedirectResponse(url=google_url)


@router.get("/google-callback")
async def google_callback(request: Request, code: str = None, state: str = None, error: str = None):
    """Callback de Google OAuth. Intercambia el authorization code por tokens,
    crea la sesión JWT y redirige de vuelta a la app móvil con los tokens como query params."""
    if error:
        return HTMLResponse(content=_deeplink_error_html(f"Error de Google: {error}"), status_code=400)
    if not code:
        return HTMLResponse(content=_deeplink_error_html("No se recibió código de autorización"), status_code=400)

    import requests as _requests

    if not settings.GOOGLE_SIGNIN_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        return HTMLResponse(content=_deeplink_error_html("Google OAuth no configurado en el servidor"), status_code=500)

    from app.database import SessionLocal
    from app.services.auth_service import google_login_with_code

    if settings.GOOGLE_OAUTH_REDIRECT_BASE:
        base_url = settings.GOOGLE_OAUTH_REDIRECT_BASE.rstrip("/")
    else:
        base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/v1/auth/google-callback"

    db = SessionLocal()
    try:
        result = google_login_with_code(db, code, redirect_uri)
    except Exception as e:
        return HTMLResponse(content=_deeplink_error_html(str(e)), status_code=400)
    finally:
        db.close()

    access_token = result.access_token
    refresh_token = result.refresh_token
    rol = result.rol or ""

    params = urllib.parse.urlencode({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "rol": rol,
    })
    deeplink = f"movil://auth?{params}"

    return HTMLResponse(content=f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Neodomus</title></head>
<body>
<script>window.location.replace('{deeplink}');</script>
</body></html>""", status_code=200)


def _deeplink_success_html(deeplink: str) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Neodomus</title>
<style>
  body {{ font-family: -apple-system, sans-serif; display: flex; justify-content: center;
         align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }}
  .card {{ background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);
           text-align: center; max-width: 320px; }}
  .check {{ font-size: 3rem; margin-bottom: 1rem; }}
  h2 {{ margin: 0 0 0.5rem; color: #1a1a1a; }}
  p {{ color: #666; margin: 0 0 1rem; }}
  a {{ color: #007AFF; text-decoration: none; font-weight: 600; }}
</style></head>
<body>
  <div class="card">
    <div class="check">&#10004;</div>
    <h2>Sesi&oacute;n iniciada</h2>
    <p>Ya puedes volver a la app.</p>
  </div>
</body></html>"""


def _deeplink_error_html(msg: str) -> str:
    safe = msg.replace("<", "&lt;").replace(">", "&gt;")
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Neodomus — Error</title>
<style>
  body {{ font-family: -apple-system, sans-serif; display: flex; justify-content: center;
         align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }}
  .card {{ background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);
           text-align: center; max-width: 320px; }}
  .err {{ font-size: 3rem; margin-bottom: 1rem; }}
  h2 {{ margin: 0 0 0.5rem; color: #c0392b; }}
  p {{ color: #666; margin: 0 0 1rem; }}
  a {{ color: #007AFF; text-decoration: none; font-weight: 600; }}
</style></head>
<body>
  <div class="card">
    <div class="err">&#10060;</div>
    <h2>Error de autenticaci&oacute;n</h2>
    <p>{safe}</p>
    <a href="movil://auth?error=1">Volver a la app</a>
  </div>
  <script>setTimeout(function(){{ window.location.href = 'movil://auth?error=1'; }}, 2000);</script>
</body></html>"""


@router.get("/google-result")
async def google_result(
    access_token: str = None,
    refresh_token: str = None,
    rol: str = "",
    error: str = None,
):
    """Endpoint intermediario al que Google-callback redirige con los tokens
    como query params. Devuelve HTML con un JSON embebido que el móvil
    extrae del resultado de openAuthSessionAsync."""
    if error:
        return HTMLResponse(content=f"<html><body>Error: {error}</body></html>", status_code=400)
    if not access_token or not refresh_token:
        return HTMLResponse(content="<html><body>No se recibieron tokens</body></html>", status_code=400)

    data = json.dumps({"access_token": access_token, "refresh_token": refresh_token, "rol": rol or ""})
    return HTMLResponse(content=f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>AuthOK</title></head>
<body><script>window.__NEODOMUS_AUTH__={data};</script><p>Sesion iniciada. Puedes cerrar esta ventana.</p></body>
</html>""", status_code=200)


@router.post("/solicitar-habilitacion")
@limiter.limit("5/minute")
async def solicitar_habilitacion_endpoint(request: Request, req: UserLogin, db: Session = Depends(get_db)):
    """Crea una solicitud de habilitación para un cliente con la cuenta inhabilitada.
    Requiere email y contraseña para comprobar la identidad. No habilita la cuenta."""
    return solicitar_habilitacion(db, req.email, req.password)

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    request: Request,
    response: Response,
    req: Optional[RefreshTokenRequest] = None,
    refresh_token: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Renueva el access token. Acepta el token por cuerpo (móvil) o por la
    cookie HttpOnly (web). Nunca viaja en la URL."""
    token = (
        (req.refresh_token if req else None)
        or refresh_token
        or request.cookies.get(REFRESH_COOKIE_NAME)
    )
    if not token:
        raise HTTPException(status_code=400, detail="refresh_token es requerido")
    result = refresh_access_token(db, token)
    set_auth_cookies(response, result.access_token, result.refresh_token)
    return result


@router.post("/logout")
def logout(response: Response):
    """Cierra la sesión web eliminando las cookies HttpOnly."""
    clear_auth_cookies(response)
    return {"msg": "Sesión cerrada"}


@router.get("/session")
def session_actual(request: Request, db: Session = Depends(get_db)):
    """Tipo y rol de la cuenta de la sesión actual.
    Prioriza el header Authorization (cada pestaña envía su propio token
    desde localStorage). Si no hay header, cae a la cookie HttpOnly
    (compatibilidad con versiones anteriores).
    401 si no hay sesión válida; lo usa el frontend al cargar para validar
    que la sesión corresponda con la vista que quiere mostrar.
    El rol se lee de la BD (no del claim del JWT): si el rol cambió después
    de emitirse el token, el frontend lo sabe antes de llamar a endpoints
    que exigen permisos y evita errores 403 con una vista equivocada."""
    from app.utils.security import _token_desde_request
    token = _token_desde_request(request, None)
    payload = decode_token(token) if token else None
    if not payload:
        raise HTTPException(status_code=401, detail="Sin sesión válida")
    user_type = payload.get("user_type")
    uid = payload.get("uid")
    sub = payload.get("sub")
    rol_claim = payload.get("rol")

    rol = rol_claim
    if user_type == "employee":
        user = None
        if uid:
            try:
                user = db.query(User).filter(User.id_usuario == int(uid)).first()
            except (TypeError, ValueError):
                user = None
        if user is None and sub:
            user = db.query(User).filter(User.email == sub).first()
        if user:
            rol = db.execute(
                select(RolesUsuario.nombre_rol).where(RolesUsuario.id_rol == user.id_rol_u)
            ).scalar_one_or_none() or rol_claim

    return {
        "user_type": user_type,
        "rol": rol,
        "uid": uid,
    }

@router.post("/change-password")
def change_password_endpoint(
    req: ChangePasswordRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    request: Request = None
):
    ip = request.client.host if request else None
    change_password(db, current_user, req, ip)
    return {"msg": "Contraseña actualizada correctamente"}

@router.post("/update-password")
def update_password_endpoint(
    req: UpdatePasswordRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    request: Request = None
):
    """Actualiza la contraseña del empleado autenticado sin pedir la actual
    (ventana emergente del panel técnico)."""
    ip = request.client.host if request else None
    update_password(db, current_user, req.new_password, ip)
    return {"msg": "Contraseña actualizada correctamente"}

# Recuperación de contraseña — respuesta inmediata + email en background
@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    req: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
):
    # Normalización y validación rápida antes de encolar (evita trabajos basura)
    raw = (req.email or "").strip().lower()
    if not raw or "@" not in raw:
        raise HTTPException(status_code=400, detail="Correo electrónico inválido")
    # Actualiza el modelo con el valor normalizado para consistencia
    req.email = raw

    def _task(email: str, ip: str):
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            import asyncio
            # request_password_reset es async y maneja cliente/técnico/admin por igual
            asyncio.run(request_password_reset(db, email, ip))
        except Exception as e:
            print(f"[forgot-password] background error para {email}: {e}")
        finally:
            try:
                db.close()
            except:
                pass

    background_tasks.add_task(_task, raw, request.client.host if request.client else None)
    return {"msg": "Si el email está registrado, recibirás un código de recuperación"}

@router.post("/verify-code")
@limiter.limit("5/minute")
def verify_code(request: Request, req: VerifyCodeRequest, db: Session = Depends(get_db)):
    verify_password_reset_code(db, req.email, req.code)
    return {"valid": True, "message": "Código válido. Ahora puedes restablecer tu contraseña."}

@router.post("/reset-password")
@limiter.limit("5/minute")
def reset_password_endpoint(
    request: Request,
    req: ResetPasswordCodeRequest,
    db: Session = Depends(get_db)
):
    reset_req = ResetPasswordRequest(token=req.token, new_password=req.new_password)
    reset_password(db, reset_req)
    return {"msg": "Contraseña actualizada correctamente"}

# Cambio de correo electrónico (verificación con código)
@router.post("/request-email-change")
async def request_email_change_endpoint(
    req: RequestEmailChangeRequest,
    request: Request,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Solicita el cambio de correo: envía un código de 6 dígitos al correo actual."""
    ip = request.client.host if request else None
    return await request_email_change(db, current_user, req.nuevo_email, ip)

@router.post("/verify-email-change")
def verify_email_change_endpoint(
    req: VerifyEmailChangeRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Valida el código recibido por correo y aplica el cambio de correo."""
    return verify_email_change(db, current_user, req.code, req.nuevo_email)