# Citas guardadas de un pedido (para la factura PDF).
from sqlalchemy.orm import Session

from app.models.cita import Cita


def citas_del_pedido(db: Session, pedido_id: int) -> list[Cita]:
    """Citas creadas para el pedido (marcadas con numero_transaccion
    PEDIDO-<id>), ordenadas por fecha y hora."""
    return (
        db.query(Cita)
        .filter(Cita.numero_transaccion == f"PEDIDO-{pedido_id}")
        .order_by(Cita.fecha, Cita.hora)
        .all()
    )
