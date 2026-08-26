"""
Servicio: asignación y reasignación de técnicos con validación de
especializaciones.

Orquesta:
  - Desactivación de un técnico: reasigna automáticamente sus citas futuras
    a técnicos con la especialización requerida; si no hay candidato,
    cancela la cita y genera el reembolso. También reasigna entregas.
  - Reasignación manual (admin) con validación estricta de especialidad.
  - Historial de trazabilidad por cita (tabla historial_citas).
"""
from __future__ import annotations

from datetime import date

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.cita import Cita
from app.models.especializacion import HistorialCita
from app.models.pedido import Pedido
from app.services import reembolso_service
from app.services.especialidades import (
    ESTADOS_ENTREGA_OCUPAN,
    ESTADOS_OCUPAN,
    mejor_tecnico_para,
    tecnico_ocupado,
)


def _nombre_tecnico_de(t) -> str | None:
    if t is None or not t.usuario:
        return None
    return f"{t.usuario.first_name} {t.usuario.last_name}".strip()


def _nombre_tecnico_de_cita(cita: Cita, segundo: bool = False) -> str | None:
    if segundo:
        return cita.nombre_tecnico_2
    return cita.nombre_tecnico


def registrar_historial(
    db: Session,
    id_cita: int,
    accion: str,
    tecnico_anterior_id: int | None = None,
    tecnico_anterior_nombre: str | None = None,
    tecnico_nuevo_id: int | None = None,
    tecnico_nuevo_nombre: str | None = None,
    administrador_id: int | None = None,
    motivo: str | None = None,
    detalle: str | None = None,
) -> HistorialCita:
    """Registra un evento de trazabilidad para una cita."""
    entrada = HistorialCita(
        id_cita=id_cita,
        accion=accion,
        tecnico_anterior_id=tecnico_anterior_id,
        tecnico_anterior_nombre=tecnico_anterior_nombre,
        tecnico_nuevo_id=tecnico_nuevo_id,
        tecnico_nuevo_nombre=tecnico_nuevo_nombre,
        administrador_id=administrador_id,
        motivo=(motivo or "")[:255] or None,
        detalle=detalle,
    )
    db.add(entrada)
    db.commit()
    db.refresh(entrada)
    return entrada


def especializacion_requerida_cita(db: Session, cita: Cita):
    """Especialización exigida por una cita: la guardada en la cita o, en su
    defecto, la derivada de los productos asociados."""
    if cita.id_especializacion:
        from app.models.especializacion import Especializacion

        esp = (
            db.query(Especializacion)
            .filter(Especializacion.id_especializacion == cita.id_especializacion)
            .first()
        )
        if esp:
            return esp
    productos = [
        cp.producto for cp in (cita.productos_asociados or []) if cp.producto is not None
    ]
    if not productos:
        return None
    from app.services.especialidades import especializaciones_de_productos
    from app.models.especializacion import Especializacion

    ids = especializaciones_de_productos(productos)
    if len(ids) != 1:
        return None
    return (
        db.query(Especializacion)
        .filter(Especializacion.id_especializacion == ids[0])
        .first()
    )


def citas_futuras_de_tecnico(db: Session, id_tecnico: int) -> list[Cita]:
    """Citas activas (Pendiente/Confirmada) de hoy en adelante donde el
    técnico es el principal."""
    hoy = date.today()
    return (
        db.query(Cita)
        .filter(
            Cita.id_tecnico == id_tecnico,
            Cita.fecha >= hoy,
            Cita.estado.in_(ESTADOS_OCUPAN),
        )
        .order_by(Cita.fecha, Cita.hora)
        .all()
    )


def entregas_pendientes_de_tecnico(db: Session, id_tecnico: int) -> list[Pedido]:
    """Entregas activas (Asignada/En camino) de hoy en adelante del técnico."""
    hoy = date.today()
    return (
        db.query(Pedido)
        .filter(
            Pedido.id_tecnico_entrega == id_tecnico,
            Pedido.fecha_entrega >= hoy,
            Pedido.estado_entrega.in_(ESTADOS_ENTREGA_OCUPAN),
        )
        .order_by(Pedido.fecha_entrega)
        .all()
    )


def _notificar_cliente_reasignacion(db: Session, cita: Cita, nuevo_nombre: str) -> None:
    from app.config import settings
    from app.services.notificaciones import notificar_cita_reasignada_cliente

    # El cliente no se avisa de cambios originados por modificaciones al
    # técnico (desactivación/edición/reasignación automática).
    if not settings.NOTIFICAR_CLIENTE_CAMBIOS_TECNICO:
        return

    cliente = cita.cliente
    if cliente is None:
        return
    notificar_cita_reasignada_cliente(
        db,
        cliente.id_cliente,
        cliente.email,
        f"{cliente.first_name} {cliente.last_name}".strip() or "Cliente",
        {
            "servicio": cita.tipo_servicio,
            "fecha": cita.fecha.strftime("%d/%m/%Y"),
            "hora": cita.hora,
            "tecnico": nuevo_nombre or "un técnico",
        },
    )


def _notificar_tecnico_asignacion(db: Session, cita: Cita, tecnico) -> None:
    from app.services.notificaciones import notificar_cita_asignada_tecnico

    if tecnico is None or not tecnico.usuario or not tecnico.usuario.email:
        return
    cliente = cita.cliente
    notificar_cita_asignada_tecnico(
        db,
        tecnico.usuario.id_usuario,
        tecnico.usuario.email,
        _nombre_tecnico_de(tecnico) or "técnico",
        {
            "cliente": f"{cliente.first_name} {cliente.last_name}".strip()
            if cliente
            else "Cliente",
            "servicio": cita.tipo_servicio,
            "fecha": cita.fecha.strftime("%d/%m/%Y"),
            "hora": cita.hora,
            "direccion": cita.direccion,
            "telefono": cliente.telefono_cliente if cliente else None,
            "descripcion": cita.descripcion,
        },
    )


def cancelar_cita_con_reembolso(
    db: Session,
    cita: Cita,
    motivo: str,
    administrador_id: int | None = None,
) -> dict | None:
    """Cancela una cita pagada y genera el reembolso correspondiente.

    Devuelve el resumen del reembolso o None si no había pago aprobado."""
    estado_anterior = cita.estado
    nombre_anterior = cita.nombre_tecnico
    cita.estado = "Cancelada"
    db.commit()

    registrar_historial(
        db,
        cita.id_cita,
        accion="cancelacion",
        tecnico_anterior_id=cita.id_tecnico,
        tecnico_anterior_nombre=nombre_anterior,
        administrador_id=administrador_id,
        motivo=motivo,
        detalle=f"Estado anterior: {estado_anterior}",
    )

    # Notificar al cliente con el motivo.
    from app.services.notificaciones import notificar_cita_estado_cliente

    cliente = cita.cliente
    if cliente is not None:
        motivo_cliente = (
            f"{motivo} El monto pagado será reembolsado a tu medio de pago."
            if (cita.estado_pago == "aprobado")
            else motivo
        )
        notificar_cita_estado_cliente(
            db,
            cliente.id_cliente,
            cliente.email,
            f"{cliente.first_name} {cliente.last_name}".strip() or "Cliente",
            {
                "servicio": cita.tipo_servicio,
                "fecha": cita.fecha.strftime("%d/%m/%Y"),
                "tecnico": nombre_anterior or "-",
            },
            "Cancelada",
            motivo=motivo_cliente,
        )

    # Reembolso si la cita estaba pagada — queda PENDIENTE para confirmación del admin.
    reembolso_resumen = None
    if (cita.estado_pago == "aprobado") and cita.costo_cita:
        from app.models.especializacion import Reembolso as ReembolsoModel

        reembolso = ReembolsoModel(
            id_cita=cita.id_cita,
            monto=round(float(cita.costo_cita), 2),
            estado="Pendiente",
            motivo=motivo,
            numero_transaccion_original=cita.numero_transaccion,
        )
        db.add(reembolso)
        db.flush()
        reembolso_resumen = {
            "id_reembolso": reembolso.id_reembolso,
            "monto": reembolso.monto,
            "estado": reembolso.estado,
        }
    return reembolso_resumen


def reasignar_cita_automatica(
    db: Session,
    cita: Cita,
    excluir_ids: set[int] | None = None,
    administrador_id: int | None = None,
    motivo: str = "Reasignación automática",
) -> dict:
    """Intenta reasignar una cita a un técnico con la especialización
    requerida y libre en la franja.

    Devuelve {"estado": "reasignada"|"cancelada"|"sin_cambio", ...}.
    """
    excluir = set(excluir_ids or set())
    if cita.id_tecnico is not None:
        excluir.add(cita.id_tecnico)

    esp = especializacion_requerida_cita(db, cita)
    ids_req = [esp.id_especializacion] if esp else []

    candidato = mejor_tecnico_para(
        db, ids_req, fecha=cita.fecha, hora=cita.hora, excluir_ids=excluir
    )
    nombre_anterior = cita.nombre_tecnico
    id_anterior = cita.id_tecnico

    if candidato is None:
        # Nadie libre en esa franja exacta: buscar el horario más cercano
        # (prioridad 2) antes de cancelar.
        from datetime import timedelta as _td

        from app.services.especialidades import buscar_proximo_horario

        proximo = (
            buscar_proximo_horario(db, ids_req, cita.fecha + _td(days=1), None, excluir_ids=excluir)
            if cita.fecha is not None
            else None
        )
        if proximo is not None:
            nueva_fecha, nueva_hora, tecnico_nuevo = proximo
            fecha_anterior = cita.fecha
            hora_anterior = cita.hora
            cita.id_tecnico = tecnico_nuevo.id_tecnico
            cita.nombre_tecnico = _nombre_tecnico_de(tecnico_nuevo)
            cita.fecha = nueva_fecha
            cita.hora = nueva_hora
            db.commit()
            db.refresh(cita)

            registrar_historial(
                db,
                cita.id_cita,
                accion="reprogramacion",
                tecnico_anterior_id=id_anterior,
                tecnico_anterior_nombre=nombre_anterior,
                tecnico_nuevo_id=cita.id_tecnico,
                tecnico_nuevo_nombre=cita.nombre_tecnico,
                administrador_id=administrador_id,
                motivo=motivo,
                detalle=(
                    f"Reprogramación automática: {fecha_anterior} {hora_anterior} → "
                    f"{nueva_fecha} {nueva_hora}"
                    + (f" (especialización: {esp.nombre})" if esp else "")
                ),
            )

            _notificar_cliente_reasignacion(db, cita, cita.nombre_tecnico)
            _notificar_tecnico_asignacion(db, cita, tecnico_nuevo)

            from app.services.notificaciones import crear_notificacion
            from app.models.user import User as _User

            for admin in db.query(_User).filter(_User.id_rol_u == 1, _User.is_active == True).all():  # noqa: E712
                crear_notificacion(
                    db,
                    id_usuario=admin.id_usuario,
                    id_cliente=None,
                    tipo="cita",
                    titulo="Cita reprogramada automáticamente",
                    mensaje=(
                        f"La cita #{cita.id_cita} se reprogramó al "
                        f"{nueva_fecha.strftime('%d/%m/%Y')} {nueva_hora} con "
                        f"{cita.nombre_tecnico} porque nadie pudo atender en el horario original."
                    ),
                )

            return {
                "estado": "reprogramada",
                "id_cita": cita.id_cita,
                "fecha_anterior": str(fecha_anterior),
                "hora_anterior": hora_anterior,
                "fecha_nueva": str(nueva_fecha),
                "hora_nueva": nueva_hora,
                "tecnico_nuevo": cita.nombre_tecnico,
            }

        # Sin técnico disponible ni hueco próximo: cancelar + reembolsar.
        motivo_cancelacion = (
            f"No hay técnicos disponibles con la especialización "
            f"'{esp.nombre}' para tu cita."
            if esp
            else "No hay técnicos disponibles para tu cita en este momento."
        )
        reembolso = cancelar_cita_con_reembolso(
            db, cita, motivo=motivo_cancelacion, administrador_id=administrador_id
        )

        # Alerta a administradores: reembolso pendiente por falta de técnico.
        from app.services.notificaciones import notificar_admin_reembolso_pendiente_cita

        cliente_c = cita.cliente
        notificar_admin_reembolso_pendiente_cita(
            db,
            id_cita=cita.id_cita,
            cliente_nombre=(
                f"{cliente_c.first_name} {cliente_c.last_name}".strip()
                if cliente_c
                else "Cliente"
            ),
            especializacion=esp.nombre if esp else None,
            monto=float(cita.costo_cita or 0),
            motivo=motivo_cancelacion,
        )

        return {
            "estado": "cancelada",
            "id_cita": cita.id_cita,
            "motivo": motivo_cancelacion,
            "reembolso": reembolso,
        }

    cita.id_tecnico = candidato.id_tecnico
    cita.nombre_tecnico = _nombre_tecnico_de(candidato)
    db.commit()
    db.refresh(cita)

    registrar_historial(
        db,
        cita.id_cita,
        accion="reasignacion",
        tecnico_anterior_id=id_anterior,
        tecnico_anterior_nombre=nombre_anterior,
        tecnico_nuevo_id=candidato.id_tecnico,
        tecnico_nuevo_nombre=cita.nombre_tecnico,
        administrador_id=administrador_id,
        motivo=motivo,
        detalle=(
            f"Especialización requerida: {esp.nombre}" if esp else None
        ),
    )

    _notificar_cliente_reasignacion(db, cita, cita.nombre_tecnico)
    _notificar_tecnico_asignacion(db, cita, candidato)

    return {
        "estado": "reasignada",
        "id_cita": cita.id_cita,
        "tecnico_anterior": nombre_anterior,
        "tecnico_nuevo": cita.nombre_tecnico,
    }


def especializaciones_requeridas_entrega(db: Session, pedido: Pedido) -> list[int]:
    """Especializaciones exigidas por los PRODUCTOS del pedido."""
    from app.services.especialidades import (
        especializaciones_de_productos as _esp_de_productos,
    )

    productos = [
        d.producto for d in (pedido.detalles or []) if d.producto is not None
    ]
    return _esp_de_productos(productos)


def reasignar_entrega(db: Session, pedido: Pedido, excluir_ids: set[int] | None = None) -> dict | None:
    """Reasigna la entrega de un pedido buscando técnico disponible DENTRO DEL
    RANGO horario de la entrega, con esta prioridad:

      1. Cubre TODAS las especializaciones requeridas por los productos.
      2. Comparte al menos una especialización (relacionada).
      3. Cualquier técnico activo libre en el rango.

    Dentro de cada nivel se elige el de menor carga activa. Devuelve un dict
    con el técnico elegido y si se usó una especialización alternativa, o
    None si no hay candidatos.
    """
    from app.services.especialidades import (
        _tecnicos_activos,
        especializaciones_de_tecnico,
        ventana_entrega,
        tecnico_libre_en_rango,
    )

    excluir = set(excluir_ids or set())
    if pedido.id_tecnico_entrega:
        excluir.add(pedido.id_tecnico_entrega)

    fecha = pedido.fecha_entrega
    hora_ini = pedido.hora_entrega or "10:00"
    hora_fin = pedido.hora_entrega_fin

    if fecha is not None:
        candidatos = [
            t
            for t in _tecnicos_activos(db)
            if t.id_tecnico not in excluir
            and tecnico_libre_en_rango(
                db, t.id_tecnico, fecha, hora_ini, hora_fin,
                excluir_pedido_id=pedido.id_pedido,
            )
        ]
    else:
        candidatos = [t for t in _tecnicos_activos(db) if t.id_tecnico not in excluir]
    if not candidatos:
        return None

    requeridas = set(especializaciones_requeridas_entrega(db, pedido))

    def _carga(t):
        return (
            db.query(Pedido)
            .filter(
                Pedido.id_tecnico_entrega == t.id_tecnico,
                Pedido.estado_entrega.in_(ESTADOS_ENTREGA_OCUPAN),
            )
            .count()
        )

    exactos = [t for t in candidatos if requeridas.issubset(set(especializaciones_de_tecnico(t)))] if requeridas else list(candidatos)
    if exactos:
        elegido = min(exactos, key=_carga)
        alternativa = False
    else:
        relacionados = [
            t for t in candidatos
            if set(especializaciones_de_tecnico(t)) & requeridas
        ] if requeridas else []
        elegido = min(relacionados or candidatos, key=_carga)
        alternativa = True  # especialización alternativa o generalista

    anterior = pedido.nombre_tecnico_entrega
    pedido.id_tecnico_entrega = elegido.id_tecnico
    pedido.nombre_tecnico_entrega = _nombre_tecnico_de(elegido)
    db.commit()

    # Notificar al nuevo técnico.
    from app.services.notificaciones import notificar_entrega_asignada_tecnico

    cliente = pedido.cliente if hasattr(pedido, "cliente") else None
    ini_e, fin_e = ventana_entrega(pedido)
    rango_txt = (
        f"{pedido.hora_entrega or '10:00'} - {pedido.hora_entrega_fin}"
        if pedido.hora_entrega_fin
        else f"{pedido.hora_entrega or '10:00'}"
    )
    if elegido.usuario and elegido.usuario.email:
        notificar_entrega_asignada_tecnico(
            db,
            elegido.usuario.id_usuario,
            elegido.usuario.email,
            pedido.nombre_tecnico_entrega or "técnico",
            {
                "pedido": pedido.id_pedido,
                "cliente": f"{cliente.first_name} {cliente.last_name}".strip()
                if cliente
                else "Cliente",
                "direccion": (cliente.address if cliente else "") or "Por definir",
                "telefono": cliente.telefono_cliente if cliente else None,
                "fecha": pedido.fecha_entrega.strftime("%d/%m/%Y") if pedido.fecha_entrega else "-",
                "hora": rango_txt,
            },
        )

    # Alertar a administradores si se usó una especialización alternativa.
    if alternativa:
        from app.config import settings
        from app.services.notificaciones import crear_notificacion
        from app.models.user import User as _User

        for admin in db.query(_User).filter(_User.id_rol_u == 1, _User.is_active == True).all():  # noqa: E712
            crear_notificacion(
                db,
                id_usuario=admin.id_usuario,
                id_cliente=None,
                tipo="entrega",
                titulo="Entrega asignada con especialización alternativa",
                mensaje=(
                    f"La entrega del pedido #{pedido.id_pedido} se asignó a "
                    f"{pedido.nombre_tecnico_entrega} sin cubrir la especialización "
                    f"requerida ({', '.join(str(r) for r in sorted(requeridas)) or 'n/a'})."
                ),
            )
        if cliente and settings.NOTIFICAR_CLIENTE_CAMBIOS_TECNICO:
            crear_notificacion(
                db,
                id_usuario=None,
                id_cliente=cliente.id_cliente,
                tipo="entrega",
                titulo="Tu entrega tiene un nuevo técnico",
                mensaje=(
                    f"Tu pedido #{pedido.id_pedido} será entregado por "
                    f"{pedido.nombre_tecnico_entrega} el "
                    f"{pedido.fecha_entrega.strftime('%d/%m/%Y') if pedido.fecha_entrega else ''} "
                    f"entre {rango_txt}."
                ),
            )

    return {
        "tecnico": elegido,
        "nombre": pedido.nombre_tecnico_entrega,
        "especializacion_alternativa": alternativa,
        "anterior": anterior,
    }


def desactivar_tecnico_proceso(
    db: Session,
    tecnico,
    motivo: str | None = None,
    administrador_id: int | None = None,
) -> dict:
    """Proceso completo al desactivar/habilitar-off un técnico:

    1. Quita al técnico de las citas donde es SEGUNDO técnico (futuras).
    2. Reasigna automáticamente sus citas futuras como principal a técnicos
       con la especialización requerida; si no hay, cancela + reembolsa.
    3. Reasigna sus entregas pendientes a otros técnicos.
    4. Alerta a los administradores con el resumen.

    Devuelve un resumen con lo ocurrido.
    """
    from app.services.notificaciones import notificar_admin_resultado_desactivacion

    id_tecnico = tecnico.id_tecnico
    nombre_tecnico = _nombre_tecnico_de(tecnico) or f"Técnico #{id_tecnico}"
    motivo_txt = motivo or "Técnico desactivado"

    resumen = {
        "id_tecnico": id_tecnico,
        "tecnico": nombre_tecnico,
        "segundo_tecnico_liberadas": [],
        "citas_reasignadas": [],
        "citas_canceladas": [],
        "entregas_reasignadas": [],
        "entregas_sin_tecnico": [],
    }

    # 1) Segundo/tercer técnico: liberar cupos futuros.
    hoy = date.today()
    como_segundo_o_tercero = (
        db.query(Cita)
        .filter(
            or_(Cita.id_tecnico_2 == id_tecnico, Cita.id_tecnico_3 == id_tecnico),
            Cita.fecha >= hoy,
            Cita.estado.in_(ESTADOS_OCUPAN),
        )
        .all()
    )
    for cita in como_segundo_o_tercero:
        reserva = mejor_tecnico_para(
            db,
            [cita.id_especializacion] if cita.id_especializacion else [],
            fecha=cita.fecha,
            hora=cita.hora,
            excluir_ids={id_tecnico},
        )
        if cita.id_tecnico_3 == id_tecnico:
            cita.id_tecnico_3 = reserva.id_tecnico if reserva else None
            cita.nombre_tecnico_3 = _nombre_tecnico_de(reserva) if reserva else None
        else:
            cita.id_tecnico_2 = reserva.id_tecnico if reserva else None
            cita.nombre_tecnico_2 = _nombre_tecnico_de(reserva) if reserva else None
        resumen["segundo_tecnico_liberadas"].append(cita.id_cita)
    db.commit()

    # 2) Citas futuras como principal.
    for cita in citas_futuras_de_tecnico(db, id_tecnico):
        resultado = reasignar_cita_automatica(
            db,
            cita,
            excluir_ids={id_tecnico},
            administrador_id=administrador_id,
            motivo=f"Desactivación del técnico {nombre_tecnico}",
        )
        if resultado["estado"] == "reasignada":
            resumen["citas_reasignadas"].append(resultado)
        elif resultado["estado"] == "cancelada":
            resumen["citas_canceladas"].append(resultado)

    # 3) Entregas pendientes.
    for pedido in entregas_pendientes_de_tecnico(db, id_tecnico):
        resultado_entrega = reasignar_entrega(db, pedido, excluir_ids={id_tecnico})
        if resultado_entrega is not None:
            resumen["entregas_reasignadas"].append(
                {
                    "id_pedido": pedido.id_pedido,
                    "nuevo_tecnico": pedido.nombre_tecnico_entrega,
                }
            )
        else:
            pedido.estado_entrega = "Pendiente"
            pedido.id_tecnico_entrega = None
            pedido.nombre_tecnico_entrega = None
            db.commit()
            resumen["entregas_sin_tecnico"].append(pedido.id_pedido)

            # Notificar al cliente que su entrega quedó sin técnico.
            try:
                from app.models.cliente import Cliente as ClienteModel
                from app.services.notificaciones import notificar_entrega_sin_tecnico_cliente

                cliente = db.query(ClienteModel).filter(ClienteModel.id_cliente == pedido.id_cliente_pe).first()
                if cliente:
                    nombre_cliente = f"{cliente.first_name} {cliente.last_name}".strip() or "Cliente"
                    notificar_entrega_sin_tecnico_cliente(
                        db,
                        cliente_id=cliente.id_cliente,
                        correo=cliente.email if cliente else None,
                        cliente_nombre=nombre_cliente,
                        pedido_id=pedido.id_pedido,
                    )
                    db.commit()
            except Exception:
                pass

    # 4) Alerta a administradores.
    notificar_admin_resultado_desactivacion(
        db,
        nombre_tecnico,
        reasignadas=len(resumen["citas_reasignadas"]),
        canceladas=len(resumen["citas_canceladas"]),
        entregas_reasignadas=len(resumen["entregas_reasignadas"]),
        entregas_sin_tecnico=len(resumen["entregas_sin_tecnico"]),
    )

    return resumen
