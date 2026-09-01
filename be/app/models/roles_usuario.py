"""
Módulo: models/roles_usuario.py

Tabla: roles_usuario
Descripción: Catálogo de roles del sistema (administrador, técnico, etc.) para control de acceso.

Campos clave:
  - id_rol: int (PK)
  - nombre_rol: String(50) (nombre del rol, ej. "Administrador")

Relaciones:
  (sin relationship declarados)
"""
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class RolesUsuario(Base):
    __tablename__ = "roles_usuario"

    id_rol: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre_rol: Mapped[str] = mapped_column(String(50), nullable=False)