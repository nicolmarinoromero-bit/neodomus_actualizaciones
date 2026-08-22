"""
Módulo: services/tareas_programadas.py

Lógica de las tareas automáticas que ejecuta el scheduler:

1. Recordatorios de citas: avisa al cliente cuando su cita está a <= 12 horas
   y aún no se le ha recordado (antes solo ocurría si el cliente abría la app).
2. Expiración de pagos: los pagos pendientes (punto de pago) cuya fecha
   límite venció se marcan 'expirado' y el pedido queda cancelado.
"""

from datetime import datetime, time

from sqlalchemy.orm import Session

from app.models.cita import Cita
from app.models.cliente import Cliente
from app.models.pago import Pago
from app.services.notificaciones import (
    crear_notificacion,
    notificar_recordatorio_cita,
)


def enviar_recordatorio_si_corresponde(db: Session, cliente: Cliente, cita: Cita) -> bool:
    """Envía el recordatorio si la cita está a <= 12 horas y no se envió.
    Marca la cita y retorna True si envió."""
    if cita.estado not in ("Pendiente", "Confirmada") or cita.recordatorio_enviado:
        return False
    try:
        hora_parts = str(cita.hora).split(":")
        cita_dt = datetime.combine(cita.fecha, time(int(hora_parts[0]), int(hora_parts[1])))
    except (ValueError, IndexError, TypeError):
        return False
    horas_restantes = (cita_dt - datetime.now()).total_seconds() / 3600
    if not (0 < horas_restantes <= 12):
        return False
    notificar_recordatorio_cita(
        db,
        cliente_id=cliente.id_cliente,
        correo=cliente.email,
        cliente_nombre=f"{cliente.first_name} {cliente.last_name}",
        datos={
            "servicio": cita.tipo_servicio,
            "fecha": cita.fecha.strftime("%d/%m/%Y"),
            "hora": cita.hora,
            "direccion": cita.direccion,
        },
    )
    cita.recordatorio_enviado = True
    db.commit()
    return True


def procesar_recordatorios_pendientes(db: Session) -> int:
    """Recorre todas las citas próximas sin recordatorio y las notifica."""
    enviados = 0
    citas = (
        db.query(Cita)
        .filter(
            Cita.estado.in_(("Pendiente", "Confirmada")),
            Cita.recordatorio_enviado.is_(False),
        )
        .all()
    )
    clientes = {
        c.id_cliente: c
        for c in db.query(Cliente).filter(Cliente.id_cliente.in_(
            {x.id_cliente for x in citas if x.id_cliente}
        )).all()
    } if citas else {}
    for cita in citas:
        cliente = clientes.get(cita.id_cliente)
        if not cliente:
            continue
        try:
            if enviar_recordatorio_si_corresponde(db, cliente, cita):
                enviados += 1
        except Exception as e:
            print(f"Error recordatorio cita #{cita.id_cita}: {e}")
            db.rollback()
    return enviados


def expirar_pagos_vencidos(db: Session) -> int:
    """Marca como 'expirado' los pagos pendientes con fecha límite vencida y
    cancela el pedido asociado si sigue en espera de pago."""
    ahora = datetime.now()
    vencidos = (
        db.query(Pago)
        .filter(
            Pago.estado == "pendiente",
            Pago.fecha_limite_pago.isnot(None),
            Pago.fecha_limite_pago < ahora,
        )
        .all()
    )
    for pago in vencidos:
        pago.estado = "expirado"
        pedido = pago.pedido
        if pedido and pedido.estado_pedido == "Pago pendiente":
            pedido.estado_pedido = "Cancelado"
            if pedido.id_cliente_pe:
                crear_notificacion(
                    db,
                    id_usuario=None,
                    id_cliente=pedido.id_cliente_pe,
                    tipo="pedido",
                    titulo=f"Pago del pedido #{pedido.id_pedido} expirado",
                    mensaje=(
                        f"El pago de tu pedido #{pedido.id_pedido} no se confirmó dentro "
                        "del plazo y el pedido fue cancelado. Si ya realizaste el pago, "
                        "contáctanos para verificarlo."
                    ),
                )
    if vencidos:
        db.commit()
    return len(vencidos)
