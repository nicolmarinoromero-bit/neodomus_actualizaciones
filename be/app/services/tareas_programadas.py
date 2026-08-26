"""
Módulo: services/tareas_programadas.py

Lógica de las tareas automáticas que ejecuta el scheduler:

1. Recordatorios de citas: avisa al cliente cuando su cita está a <= 12 horas
   y aún no se le ha recordado (antes solo ocurría si el cliente abría la app).
2. Expiración de pagos: los pagos pendientes (punto de pago) cuya fecha
   límite venció se marcan 'expirado' y el pedido queda cancelado.
3. Recordatorios de calificación: cada hora avisa a los clientes que tienen
   servicios o productos sin calificar (calificación voluntaria, no bloquea).
"""

from datetime import datetime, time, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.cita import Cita
from app.models.calificacion import Calificacion
from app.models.calificacion_producto import CalificacionProducto
from app.models.cliente import Cliente
from app.models.notificacion import Notificacion
from app.models.oferta_horario import OfertaHorario
from app.models.pago import Pago
from app.models.pedido import DetallePedido, Pedido
from app.services.notificaciones import (
    crear_notificacion,
    notificar_recordatorio_cita,
)

# Ventana mínima entre recordatorios del mismo tipo (el job corre cada 3 h).
INTERVALO_RECORDATORIO = timedelta(minutes=170)


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
                # Enviar email al cliente sobre la cancelación.
                try:
                    from app.models.cliente import Cliente as ClienteModel
                    from app.services.notificaciones import notificar_pedido_cancelado_cliente

                    cliente = db.query(ClienteModel).filter(ClienteModel.id_cliente == pedido.id_cliente_pe).first()
                    if cliente and cliente.email:
                        nombre_cliente = f"{cliente.first_name} {cliente.last_name}".strip() or "Cliente"
                        notificar_pedido_cancelado_cliente(
                            db,
                            cliente_id=cliente.id_cliente,
                            correo=cliente.email,
                            cliente_nombre=nombre_cliente,
                            pedido_id=pedido.id_pedido,
                            motivo="El pago no fue confirmado dentro del plazo establecido",
                        )
                except Exception:
                    pass
    if vencidos:
        db.commit()
    return len(vencidos)

def expirar_ofertas_vencidas(db) -> int:
    """Ofertas de horario no aceptadas dentro de su ventana -> 'Expirada'."""
    ahora = datetime.now()
    n = (
        db.query(OfertaHorario)
        .filter(OfertaHorario.estado == "Ofrecida", OfertaHorario.expira_en <= ahora)
        .update({"estado": "Expirada"}, synchronize_session=False)
    )
    if n:
        db.commit()
    return n


# ────────────────────────────────────────────────────────────────────
# ⭐ Recordatorios horarios de calificación (técnico y productos)
# ────────────────────────────────────────────────────────────────────

def _renovar_recordatorio_previo(db: Session, id_cliente: int, tipo: str) -> bool:
    """Anti-spam: devuelve True si toca enviar un recordatorio nuevo.

    Si ya existe uno SIN leer enviado hace menos de ~1 hora no se repite.
    Al enviar uno nuevo, los anteriores sin leer se marcan como leídos para
    que el cliente tenga siempre UN solo recordatorio activo por tipo.
    """
    ahora = datetime.now()
    previos = (
        db.query(Notificacion)
        .filter(
            Notificacion.id_cliente == id_cliente,
            Notificacion.tipo == tipo,
            Notificacion.leida.is_(False),
        )
        .all()
    )
    if any(
        n.fecha_creacion and (ahora - n.fecha_creacion) < INTERVALO_RECORDATORIO
        for n in previos
    ):
        return False
    for n in previos:
        n.leida = True
    return True


def _clientes_con_servicios_sin_calificar(db: Session) -> dict[int, int]:
    """{id_cliente: cantidad de citas Finalizadas sin calificar}."""
    filas = (
        db.query(Cita.id_cliente, func.count(Cita.id_cita))
        .outerjoin(
            Calificacion,
            (Calificacion.id_cita_c == Cita.id_cita)
            & (Calificacion.id_cliente_c == Cita.id_cliente),
        )
        .filter(
            Cita.estado == "Finalizada",
            Cita.id_tecnico.isnot(None),
            Cita.id_cliente.isnot(None),
            Calificacion.id_calificacion.is_(None),
        )
        .group_by(Cita.id_cliente)
        .all()
    )
    return {int(cid): int(n) for cid, n in filas}


def _pedidos_pendientes_calificacion_productos(db: Session) -> dict[int, list[int]]:
    """{id_cliente: [ids de pedidos completados con productos sin calificar]}.

    Un pedido está pendiente si tiene productos cuya calificación individual
    (CalificacionProducto) aún no fue dejada por ese cliente.
    """
    pedidos = db.query(Pedido).order_by(Pedido.id_pedido.desc()).limit(300).all()
    resultado: dict[int, list[int]] = {}
    for pedido in pedidos:
        if not pedido.id_cliente_pe:
            continue
        from app.services.pedidos_service import pedido_completado

        if not pedido_completado(db, pedido):
            continue
        detalles = (
            db.query(DetallePedido)
            .filter(
                DetallePedido.id_pedido_d == pedido.id_pedido,
                DetallePedido.id_producto_d.isnot(None),
            )
            .all()
        )
        if not detalles:
            continue
        calificadas = (
            db.query(func.count(CalificacionProducto.id_calificacion_producto))
            .filter(
                CalificacionProducto.id_pedido_cp == pedido.id_pedido,
                CalificacionProducto.id_cliente_cp == pedido.id_cliente_pe,
            )
            .scalar() or 0
        )
        if int(calificadas) < len(detalles):
            resultado.setdefault(int(pedido.id_cliente_pe), []).append(pedido.id_pedido)
    return resultado


def _recordatorios_pendientes_recientes(db: Session, id_cliente: int, tipos: tuple[str, ...]) -> bool:
    """True si ya existe un recordatorio del mismo grupo sin leer y reciente."""
    ahora = datetime.now()
    recientes = (
        db.query(Notificacion)
        .filter(
            Notificacion.id_cliente == id_cliente,
            Notificacion.tipo.in_(list(tipos)),
            Notificacion.leida.is_(False),
        )
        .all()
    )
    return any(
        n.fecha_creacion and (ahora - n.fecha_creacion) < INTERVALO_RECORDATORIO
        for n in recientes
    )


def enviar_recordatorios_calificacion(db: Session) -> int:
    """Job horario: notifica a los clientes con calificaciones pendientes.

    - Técnico: citas Finalizadas sin calificación (tipo 'recordatorio_cita').
    - Productos: pedidos completados con productos sin calificar
      (tipo 'recordatorio_producto').

    Se envía máximo UN recordatorio por cliente y tipo cada hora; el anterior
    sin leer se marca como leído al generar el nuevo. Retorna cuántos se
    crearon.
    """
    enviados = 0

    # ── Servicios (técnico) pendientes ──────────────────────────────
    servicios = _clientes_con_servicios_sin_calificar(db)
    # ── Pedidos con productos pendientes ────────────────────────────
    productos = _pedidos_pendientes_calificacion_productos(db)

    clientes_ids = set(servicios) | set(productos)
    if not clientes_ids:
        return 0
    clientes = {
        c.id_cliente: c
        for c in db.query(Cliente).filter(Cliente.id_cliente.in_(clientes_ids)).all()
    }

    for cid in sorted(clientes_ids):
        cliente = clientes.get(cid)
        if not cliente:
            continue
        n_serv = servicios.get(cid, 0)
        pedidos_pend = productos.get(cid, [])

        # TÉCNICO: solo si no hay recordatorio reciente del MISMO grupo.
        if n_serv > 0 and not _recordatorios_pendientes_recientes(
            db, cid, ("recordatorio_cita",)
        ):
            if _renovar_recordatorio_previo(db, cid, "recordatorio_cita"):
                crear_notificacion(
                    db,
                    id_usuario=None,
                    id_cliente=cid,
                    tipo="recordatorio_cita",
                    titulo="Recuerda calificar tu servicio",
                    mensaje=(
                        f"Tienes {n_serv} servicio(s) finalizado(s) sin calificar. "
                        "Tu opinión sobre el técnico ayuda a otros clientes."
                    ),
                )
                enviados += 1

        # PRODUCTOS: agrupa todos los pedidos pendientes en un solo aviso.
        if pedidos_pend and not _recordatorios_pendientes_recientes(
            db, cid, ("recordatorio_producto",)
        ):
            if _renovar_recordatorio_previo(db, cid, "recordatorio_producto"):
                pedidos_txt = ", ".join(f"#{p}" for p in pedidos_pend[:5])
                crear_notificacion(
                    db,
                    id_usuario=None,
                    id_cliente=cid,
                    tipo="recordatorio_producto",
                    titulo="Recuerda calificar tus productos",
                    mensaje=(
                        f"Califica los productos de tus pedidos {pedidos_txt}. "
                        "¡Tu opinión nos ayuda a mejorar!"
                    ),
                )
                enviados += 1

    return enviados
