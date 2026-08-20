from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Tecnico(Base):
    __tablename__ = "tecnicos"

    id_tecnico: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_usuario_t: Mapped[int] = mapped_column(ForeignKey("usuarios.id_usuario"), nullable=True)
    certificacion_t: Mapped[str] = mapped_column(String(100), nullable=True)
    cargo_t: Mapped[str] = mapped_column(String(50), nullable=True)

    usuario = relationship("User", foreign_keys=[id_usuario_t])