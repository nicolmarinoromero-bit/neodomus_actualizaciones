"""
Módulo: models/cliente.py

Tabla: clientes
Descripción: Cuenta de cliente de la plataforma NeoDomus, con datos personales, autenticación (local o Google) y verificación por email.

Campos clave:
  - id_cliente: int (PK)
  - first_name: String(100) (nombre)
  - last_name: String(100) (apellido)
  - email: String(100) (email único, usado para login)
  - password_hash: String(255) (hash de contraseña)
  - is_active: Boolean (cuenta activada tras verificación)
  - auth_provider: String(20) (local | google)

Relaciones:
  - email_verification_tokens → EmailVerificationToken (tokens de verificación)
"""
from datetime import datetime
from typing import TYPE_CHECKING, List
from sqlalchemy import BigInteger, Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.email_verification_token import EmailVerificationToken

class Cliente(Base):
    __tablename__ = "clientes"

    id_cliente: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=True)

    id_tipo_documento_c: Mapped[int] = mapped_column(Integer, nullable=True)
    documento_cliente: Mapped[int] = mapped_column(Integer, unique=True, nullable=True)
    telefono_cliente: Mapped[int] = mapped_column(BigInteger, nullable=True)
    address: Mapped[str] = mapped_column(String(150), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verification_token: Mapped[str] = mapped_column(String(100), unique=True, nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(20), default="local", nullable=False)
    google_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Solo se mantiene la relación con EmailVerificationToken si se usa
    email_verification_tokens: Mapped[List["EmailVerificationToken"]] = relationship(
        "EmailVerificationToken",
        back_populates="cliente",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
