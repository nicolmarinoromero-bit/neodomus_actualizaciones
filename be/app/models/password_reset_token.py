"""
Módulo: models/password_reset_token.py

Tabla: password_reset_tokens
Descripción: Token de restablecimiento de contraseña para empleados y clientes, con código de verificación y expiración.

Campos clave:
  - id: int (PK)
  - email: String(255) (email del usuario)
  - user_type: String(20) (employee | client)
  - token: String(500) (token único)
  - code: String(10) (código numérico)
  - expires_at: DateTime (fecha de expiración)
  - used: Boolean (si ya fue consumido)

Relaciones:
  (sin relationship declarados)
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    user_type = Column(String(20), nullable=False)  # 'employee' o 'client'
    token = Column(String(500), nullable=True, unique=True, index=True)
    code = Column(String(10), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    ip_used = Column(String(45), nullable=True)
    created_at = Column(DateTime, server_default=func.now())