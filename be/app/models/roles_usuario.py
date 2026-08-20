from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class RolesUsuario(Base):
    __tablename__ = "roles_usuario"

    id_rol: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre_rol: Mapped[str] = mapped_column(String(50), nullable=False)