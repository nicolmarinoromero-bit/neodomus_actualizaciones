from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.especializacion import tecnico_especializacion


class Tecnico(Base):
    __tablename__ = "tecnicos"

    id_tecnico: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_usuario_t: Mapped[int] = mapped_column(ForeignKey("usuarios.id_usuario"), nullable=True)
    certificacion_t: Mapped[str] = mapped_column(String(100), nullable=True)

    usuario = relationship("User", foreign_keys=[id_usuario_t])
    especializaciones = relationship(
        "Especializacion",
        secondary=tecnico_especializacion,
        lazy="selectin",
        order_by="Especializacion.nombre",
    )
