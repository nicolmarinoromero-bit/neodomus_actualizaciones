from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
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
    RequestEmailChangeRequest,
    VerifyEmailChangeRequest,
)
from app.utils.security import get_current_user

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

# Registro y verificación
@router.post("/register/client", response_model=dict)
async def register_client_endpoint(client_data: ClientCreate, db: Session = Depends(get_db)):
    return await register_client(db, client_data)

@router.post("/verify-email")
def verify_email_endpoint(code: str, db: Session = Depends(get_db)):
    verify_client_email(db, code)
    return {"msg": "Email verificado correctamente. Ya puedes iniciar sesión."}

@router.post("/resend-verification")
async def resend_verification_endpoint(req: ResendVerificationRequest, db: Session = Depends(get_db)):
    return await resend_verification_code(db, req.email)

# Login y autenticación
@router.post("/login", response_model=TokenResponse)
def login_endpoint(login_data: UserLogin, db: Session = Depends(get_db)):
    return login(db, login_data)

@router.post("/google", response_model=TokenResponse)
def google_login_endpoint(req: GoogleLoginRequest, db: Session = Depends(get_db)):
    return google_login(db, req.credential)

@router.post("/solicitar-habilitacion")
async def solicitar_habilitacion_endpoint(req: UserLogin, db: Session = Depends(get_db)):
    """Crea una solicitud de habilitación para un cliente con la cuenta inhabilitada.
    Requiere email y contraseña para comprobar la identidad. No habilita la cuenta."""
    return solicitar_habilitacion(db, req.email, req.password)

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    req: Optional[RefreshTokenRequest] = None,
    refresh_token: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Renueva el access token. El refresh token viaja en el cuerpo de la
    petición (nunca en la URL). Se conserva el parámetro por compatibilidad."""
    token = (req.refresh_token if req else None) or refresh_token
    if not token:
        raise HTTPException(status_code=400, detail="refresh_token es requerido")
    return refresh_access_token(db, token)

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

# Recuperación de contraseña
@router.post("/forgot-password")
async def forgot_password(
    req: ForgotPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    background_tasks.add_task(request_password_reset, db, req.email, request.client.host)
    return {"msg": "Si el email está registrado, recibirás un código de recuperación"}

@router.post("/verify-code")
def verify_code(req: VerifyCodeRequest, db: Session = Depends(get_db)):
    verify_password_reset_code(db, req.email, req.code)
    return {"valid": True, "message": "Código válido. Ahora puedes restablecer tu contraseña."}

@router.post("/reset-password")
def reset_password_endpoint(
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