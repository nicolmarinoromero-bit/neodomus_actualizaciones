from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TecnicoFavorito(Base):
    """Técnico marcado como favorito por un cliente autenticado.

    Persistencia real en BD (no estado local) para que "Mis técnicos"
    del usuario refleje siempre sus favoritos, en cualquier dispositivo.
    """

    __tablename__ = "tecnicos_favoritos"

    id_cliente: Mapped[int] = mapped_column(
        ForeignKey("clientes.id_cliente", ondelete="CASCADE"),
        primary_key=True,
    )
    id_tecnico: Mapped[int] = mapped_column(
        ForeignKey("tecnicos.id_tecnico", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[object] = mapped_column(
        DateTime(), server_default=func.now(), nullable=False
    )
