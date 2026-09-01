"""
Módulo: models/pending_registration.py

Tabla: pending_registrations
Descripción: Registro de cliente pendiente de verificación por email. Almacena los datos temporalmente hasta que el usuario confirme el código de verificación.

Campos clave:
  - id: int (PK)
  - first_name: String(100) (nombre)
  - last_name: String(100) (apellido)
  - email: String(100) (email único pendiente)
  - password_hash: String(255) (hash de contraseña)
  - code: String(6) (código de verificación)
  - expires_at: DateTime (expiración del código)

Relaciones:
  (sin relationship declarados)
"""
from sqlalchemy import Column, Integer, String, DateTime, BigInteger
from sqlalchemy.sql import func
from app.database import Base

class PendingRegistration(Base):
    __tablename__ = "pending_registrations"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    id_tipo_documento_c = Column(Integer, nullable=True)
    documento_cliente = Column(BigInteger, nullable=True)
    telefono_cliente = Column(BigInteger, nullable=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    address = Column(String(150), nullable=True)
    password_hash = Column(String(255), nullable=False)
    code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())