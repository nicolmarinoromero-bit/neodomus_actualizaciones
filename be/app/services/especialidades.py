"""
Servicio: disponibilidad de técnicos para citas.

Centraliza las reglas:
  1) Cualquier técnico puede atender cualquier servicio (sin filtro de
     especialidad): todos los técnicos hacen de todo.
  2) Ocupación del técnico por día (una cita o entrega activa bloquea TODO
     el día, para que el técnico no atienda a otros clientes ese día).
  3) Exclusividad de franja horaria: una fecha + hora solo puede ser
     reservada por un cliente a la vez.
"""
from datetime import date
from typing import Iterable, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.cita import Cita

# Estados que bloquean la agenda del técnico
ESTADOS_OCUPAN = ("Pendiente", "Confirmada")

# Estados de entrega que bloquean el día del técnico
ESTADOS_ENTREGA_OCUPAN = ("Asignada", "En camino")

# Franja laboral: citas en incrementos de 1 hora, lunes a viernes
HORA_INICIO = 8
HORA_FIN = 18
DIAS_LABORALES = (0, 1, 2, 3, 4)  # Monday..Friday


def compatible_especialidad(tipo_servicio: Optional[str], certificacion: Optional[str]) -> bool:
    """Cualquier técnico puede atender cualquier servicio."""
    return True


def _dia_es_laboral(fecha: date) -> bool:
    """True solo de lunes a viernes."""
    return fecha.weekday() in DIAS_LABORALES


def horas_laborales(fecha: date) -> list[str]:
    """Franjas horarias de 1 hora de la jornada (08:00-18:00)."""
    return [f"{h:02d}:00" for h in range(HORA_INICIO, HORA_FIN)]


def slot_tomado(db: Session, fecha: date, hora: str, excluir_cita_id: Optional[int] = None) -> bool:
    """True si ya existe una cita activa en esa fecha y hora (sin contar
    `excluir_cita_id`). Una franja solo puede ser reservada por un cliente."""
    query = db.query(Cita).filter(
        Cita.fecha == fecha,
        Cita.hora == hora,
        Cita.estado.in_(ESTADOS_OCUPAN),
    )
    if excluir_cita_id is not None:
        query = query.filter(Cita.id_cita != excluir_cita_id)
    return query.first() is not None


def tecnico_ocupado(
    db: Session,
    id_tecnico: Optional[int],
    fecha: date,
    hora: str | None = None,
    excluir_cita_id: Optional[int] = None,
) -> bool:
    """True si el técnico ya tiene una cita activa (Pendiente/Confirmada)
    o una entrega asignada en la fecha indicada. Si se pasa `hora`, solo se
    considera ocupado a esa hora puntual; sin `hora`, el día completo queda
    ocupado. También considera las citas donde el técnico es el segundo
    asignado."""
    if id_tecnico is None:
        return False
    q_citas = db.query(Cita).filter(
        or_(
            Cita.id_tecnico == id_tecnico,
            Cita.id_tecnico_2 == id_tecnico,
        ),
        Cita.fecha == fecha,
        Cita.estado.in_(ESTADOS_OCUPAN),
    )
    if hora is not None:
        q_citas = q_citas.filter(Cita.hora == hora)
    if excluir_cita_id is not None:
        q_citas = q_citas.filter(Cita.id_cita != excluir_cita_id)
    if q_citas.first() is not None:
        return True
    from app.models.pedido import Pedido

    q_entregas = db.query(Pedido).filter(
        Pedido.id_tecnico_entrega == id_tecnico,
        Pedido.fecha_entrega == fecha,
        Pedido.estado_entrega.in_(ESTADOS_ENTREGA_OCUPAN),
    )
    if hora is not None:
        q_entregas = q_entregas.filter(Pedido.hora_entrega == hora)
    return q_entregas.first() is not None