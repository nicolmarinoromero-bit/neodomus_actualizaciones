import re
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

def _validate_password_strength(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Debe tener al menos 8 caracteres")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Debe contener una mayúscula")
    if not re.search(r"[a-z]", v):
        raise ValueError("Debe contener una minúscula")
    if not re.search(r"\d", v):
        raise ValueError("Debe contener un número")
    return v

class ClientCreate(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: EmailStr
    password: str
    id_tipo_documento_c: Optional[int] = None
    documento_cliente: Optional[int] = None
    telefono_cliente: Optional[int] = Field(None, ge=1000000000, le=9999999999)
    address: Optional[str] = None

    @field_validator("password")
    def validate_password(cls, v: str) -> str:
        return _validate_password_strength(v)

    @field_validator("first_name", "last_name")
    def validate_names(cls, v: str) -> str:
        v = v.strip().upper()
        if len(v) < 2:
            raise ValueError("Mínimo 2 caracteres")
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    user_type: Optional[Literal["employee", "client"]] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    def validate_new(cls, v: str) -> str:
        return _validate_password_strength(v)


class UpdatePasswordRequest(BaseModel):
    new_password: str

    @field_validator("new_password")
    def validate_new(cls, v: str) -> str:
        return _validate_password_strength(v)

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=6, max_length=6)
    new_password: str

    @field_validator("new_password")
    def validate_new(cls, v: str) -> str:
        return _validate_password_strength(v)

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class VerifyEmailRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)

class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)

class RequestEmailChangeRequest(BaseModel):
    nuevo_email: EmailStr

class VerifyEmailChangeRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)
    nuevo_email: EmailStr

# 🔥 TokenResponse ahora tiene "rol" en lugar de "role"
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_type: Literal["employee", "client"]
    rol: Optional[str] = None
    password_reset_required: bool = False
    perfil_incompleto: bool = False
    model_config = ConfigDict(from_attributes=True)

class MessageResponse(BaseModel):
    message: str

class GoogleLoginRequest(BaseModel):
    credential: str