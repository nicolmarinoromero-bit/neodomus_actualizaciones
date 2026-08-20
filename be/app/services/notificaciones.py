"""
Servicio: notificaciones de citas y entregas (correo + plataforma).

Centraliza las plantillas HTML y el envío en segundo plano (fire-and-forget)
para:
  - Cita asignada a un técnico.
  - Cita finalizada / cancelada (aviso al cliente, con solicitud de
    calificación si se completó).
  - Pedido de entrega asignado a un técnico.
  - Aviso previo de entrega al cliente.

Cada evento de asignación también crea una notificación en plataforma
(tabla notificaciones) para que el técnico la vea en la campana y en su
panel, además del correo.
"""
import asyncio


def crear_notificacion(db, id_usuario: int | None, tipo: str, titulo: str, mensaje: str,
                       id_cliente: int | None = None) -> None:
    """Crea una notificación de plataforma para un usuario o cliente (fire-and-forget).

    No lanza excepciones: si falla, solo se registra en consola, igual que
    el envío de correo, para no interrumpir el flujo principal.
    """
    try:
        from app.models.notificacion import Notificacion

        db.add(
            Notificacion(
                id_usuario=id_usuario,
                id_cliente=id_cliente,
                tipo=tipo,
                titulo=titulo[:150],
                mensaje=mensaje[:500],
            )
        )
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error creando notificación de plataforma (usuario={id_usuario} cliente={id_cliente}): {e}")


def programar_correo(correo: str, subject: str, body: str) -> None:
    """Programa el envío de un correo en segundo plano (fire-and-forget).

    Si no hay un event loop corriendo (rutas síncronas de FastAPI), ejecuta
    el envío de forma bloqueante con asyncio.run para no perder el correo.
    """
    from app.utils.email import send_email

    async def _tarea():
        try:
            await send_email(correo, subject, body)
        except Exception as e:
            print(f"Error enviando correo en segundo plano a {correo}: {e}")

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        try:
            asyncio.run(_tarea())
        except Exception as e:
            print(f"Error enviando correo (sin loop) a {correo}: {e}")
        return
    loop.create_task(_tarea())


def _plantilla(header: str, titulo: str, filas: list[tuple[str, str]], nota: str, color: str = "#1f1a12", acento: str = "#ffd98a") -> str:
    """Cuerpo HTML base de los correos."""
    filas_html = "".join(
        f"<tr><td style='padding:10px 12px;border:1px solid #eee;font-size:13px;color:#666'>{k}</td>"
        f"<td style='padding:10px 12px;border:1px solid #eee;font-size:13px;color:#333'>{v}</td></tr>"
        for k, v in filas
    )
    return (
        "<div style='background:#f6f4ef;padding:24px;font-family:Arial,Helvetica,sans-serif'>"
        "<div style='max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8e2d6'>"
        f"<div style='background:{color};padding:20px 26px;border-bottom:4px solid #d4a54b'>"
        "<h2 style='margin:0;color:#ffffff;font-size:19px'>Neodomus</h2>"
        f"<p style='margin:4px 0 0;color:{acento};font-size:12px;font-weight:600;letter-spacing:1px'>{header}</p></div>"
        "<div style='padding:26px'>"
        f"<p style='margin:0 0 8px;color:#333;font-size:14px'>{titulo}</p>"
        "<table style='border-collapse:collapse;width:100%;font-family:Arial,Helvetica,sans-serif'>"
        f"{filas_html}</table>"
        f"<p style='margin:18px 0 0;padding:12px 14px;background:#faf7f0;border:1px solid #e8e2d6;border-radius:8px;color:#7a6a4a;font-size:13px'>{nota}</p>"
        "</div>"
        "<div style='background:#f6f4ef;padding:14px 26px;border-top:1px solid #e8e2d6'>"
        "<p style='margin:0;color:#999;font-size:12px'>Neodomus — Sistema de gestión inteligente.</p>"
        "</div></div></div>"
    )


def notificar_bienvenida_tecnico(correo: str, tecnico_nombre: str, email: str, password: str) -> None:
    """Correo de bienvenida con las credenciales de acceso cuando el
    administrador registra a un técnico."""
    subject = "Bienvenido a Neodomus - Tus credenciales de acceso"
    filas = [
        ("Usuario (correo)", email),
        ("Contraseña", password),
    ]
    body = _plantilla(
        "CUENTA CREADA",
        f"Hola {tecnico_nombre}, el administrador de Neodomus creó tu cuenta de técnico. Estas son tus credenciales para iniciar sesión en el panel:",
        filas,
        "Por seguridad, al iniciar sesión por primera vez se te pedirá cambiar la contraseña. Guárdalas en un lugar seguro.",
        color="#1a2e1a",
        acento="#8fd98a",
    )
    programar_correo(correo, subject, body)


def notificar_cita_reasignada_cliente(
    db, cliente_id: int, correo: str, cliente_nombre: str, datos: dict
) -> None:
    """Correo + notificación de plataforma al cliente cuando el administrador
    reasigna su cita a otro técnico (o la aplaza a otra fecha). ``datos`` debe
    contener: servicio, fecha, hora, tecnico."""
    crear_notificacion(
        db,
        id_usuario=None,
        id_cliente=cliente_id,
        tipo="cita",
        titulo="Tu cita fue re agendada",
        mensaje=(
            f"Tu cita de {datos['servicio']} fue re asignada: "
            f"{datos['fecha']} a las {datos['hora']} con {datos['tecnico']}."
        ),
    )
    filas = [
        ("Servicio", datos["servicio"]),
        ("Fecha", datos["fecha"]),
        ("Hora", datos["hora"]),
        ("Técnico", datos["tecnico"]),
    ]
    body = _plantilla(
        "CITA RE AGENDADA",
        f"Hola {cliente_nombre}, tu cita de {datos['servicio']} fue re agendada. "
        "Revisa los nuevos datos a continuación:",
        filas,
        "Si no puedes asistir, puedes reprogramarla desde Mis citas en la plataforma.",
        color="#3d3d3d",
        acento="#ffd98a",
    )
    programar_correo(correo, subject="Tu cita en Neodomus fue re agendada", body=body)


def notificar_admin_citas_reasignar(
    db, cantidad: int, tecnico_nombre: str, citas_resumen: list[str]
) -> None:
    """Alerta a todos los administradores (plataforma + correo) cuando un
    técnico es inhabilitado y quedan citas pendientes de reasignar."""
    from app.models.user import User

    admins = db.query(User).filter(User.id_rol_u == 1, User.is_active == True).all()  # noqa: E712
    if not admins:
        return
    detalle = "; ".join(citas_resumen[:5]) + ("..." if len(citas_resumen) > 5 else "")
    for admin in admins:
        crear_notificacion(
            db,
            id_usuario=admin.id_usuario,
            id_cliente=None,
            tipo="cita",
            titulo=f"{cantidad} cita(s) por reasignar",
            mensaje=(
                f"El técnico {tecnico_nombre} fue inhabilitado y tiene {cantidad} "
                f"cita(s) pendiente(s). Reasígnelas desde Citas. {detalle}"
            ),
        )
    nombre_admin = f"{admins[0].first_name} {admins[0].last_name}".strip() or "Administrador"
    filas = [
        ("Técnico inhabilitado", tecnico_nombre),
        ("Citas por reasignar", str(cantidad)),
        ("Detalle", detalle or "-"),
    ]
    body = _plantilla(
        "CITAS POR REASIGNAR",
        f"Hola {nombre_admin}, el técnico {tecnico_nombre} fue inhabilitado y quedaron "
        f"{cantidad} cita(s) sin atender. Reasigna los técnicos o aplaza las citas "
        "desde el módulo de Citas del panel administrativo.",
        filas,
        "Mientras tanto, las citas NO fueron canceladas: el cliente mantiene su cita agendada.",
        color="#3d3d3d",
        acento="#ffd98a",
    )
    for admin in admins:
        programar_correo(admin.email, subject="Citas por reasignar en Neodomus", body=body)


def notificar_cita_asignada_tecnico(
    db, id_tecnico_usuario: int | None, correo: str, tecnico_nombre: str, datos: dict
) -> None:
    """Correo + notificación de plataforma al técnico cuando recibe una cita
    (agendada por cliente o pedido)."""
    if id_tecnico_usuario is not None:
        crear_notificacion(
            db,
            id_tecnico_usuario,
            "cita",
            "Nueva cita asignada",
            (
                f"Servicio de {datos['servicio']} para {datos['cliente']} el "
                f"{datos['fecha']} a las {datos['hora']} en {datos['direccion']}."
            ),
        )
    subject = "Nueva cita asignada en Neodomus"
    filas = [
        ("Cliente", datos["cliente"]),
        ("Servicio", datos["servicio"]),
        ("Fecha", datos["fecha"]),
        ("Hora", datos["hora"]),
        ("Dirección", datos["direccion"]),
        ("Teléfono cliente", str(datos.get("telefono") or "-")),
        ("Descripción", datos.get("descripcion") or "-"),
    ]
    body = _plantilla(
        "CITA ASIGNADA",
        f"Hola {tecnico_nombre}, se te asignó una nueva cita. Revisa la agenda del panel para ver los productos y datos completos del cliente.",
        filas,
        "Si no puedes atender esta cita, comunícate con el administrador.",
    )
    programar_correo(correo, subject, body)


def notificar_cita_finalizada_cliente(correo: str, cliente_nombre: str, datos: dict) -> None:
    """Correo al cliente cuando el técnico finaliza la cita: solicita calificar."""
    subject = "Tu cita en Neodomus fue finalizada"
    filas = [
        ("Servicio", datos["servicio"]),
        ("Fecha", datos["fecha"]),
        ("Técnico", datos["tecnico"]),
    ]
    body = _plantilla(
        "CITA FINALIZADA",
        f"Hola {cliente_nombre}, tu cita fue completada. Ahora puedes calificar al técnico {datos['tecnico']} desde la sección Mis citas (es obligatorio para poder agendar una nueva cita).",
        filas,
        "¡Gracias por usar Neodomus!",
        color="#1a2e1a",
        acento="#8fd98a",
    )
    programar_correo(correo, subject, body)


def notificar_cita_cancelada_cliente(correo: str, cliente_nombre: str, datos: dict) -> None:
    """Correo al cliente cuando el técnico no pudo completar la cita."""
    subject = "Tu cita en Neodomus no se pudo completar"
    filas = [
        ("Servicio", datos["servicio"]),
        ("Fecha", datos["fecha"]),
        ("Técnico", datos["tecnico"]),
    ]
    body = _plantilla(
        "CITA CANCELADA",
        f"Hola {cliente_nombre}, el técnico {datos['tecnico']} no pudo completar tu cita de {datos['servicio']} programada para el {datos['fecha']}. Puedes reagendarla desde Mis citas.",
        filas,
        "Lamentamos el inconveniente.",
        color="#3d1212",
        acento="#ff9b9b",
    )
    programar_correo(correo, subject, body)


def notificar_entrega_asignada_tecnico(
    db, id_tecnico_usuario: int | None, correo: str, tecnico_nombre: str, datos: dict
) -> None:
    """Correo + notificación de plataforma al técnico cuando recibe un pedido
    de entrega de productos."""
    if id_tecnico_usuario is not None:
        crear_notificacion(
            db,
            id_tecnico_usuario,
            "entrega",
            "Nuevo pedido de entrega asignado",
            (
                f"Entrega del pedido #{datos['pedido']} para {datos['cliente']} el "
                f"{datos['fecha']} a las {datos['hora']} en {datos['direccion']}."
            ),
        )
    subject = "Nuevo pedido de entrega asignado en Neodomus"
    filas = [
        ("Pedido", f"#{datos['pedido']}"),
        ("Cliente", datos["cliente"]),
        ("Dirección", datos["direccion"]),
        ("Teléfono", str(datos.get("telefono") or "-")),
        ("Fecha de entrega", datos["fecha"]),
        ("Hora de entrega", datos["hora"]),
    ]
    body = _plantilla(
        "PEDIDO DE ENTREGA",
        f"Hola {tecnico_nombre}, se te asignó la entrega del pedido #{datos['pedido']}. En el panel de entregas verás los productos y los datos del cliente para verificar su identidad.",
        filas,
        "Cuando vayas a entregar, marca el pedido como En camino para notificar al cliente con anticipación.",
    )
    programar_correo(correo, subject, body)


def notificar_aviso_entrega_cliente(correo: str, cliente_nombre: str, datos: dict) -> None:
    """Correo al cliente con aviso previo de entrega (verificación de identidad)."""
    subject = "Tu pedido Neodomus va en camino"
    filas = [
        ("Pedido", f"#{datos['pedido']}"),
        ("Fecha de entrega", datos["fecha"]),
        ("Hora de entrega", datos["hora"]),
        ("Técnico", datos["tecnico"]),
        ("Teléfono del técnico", str(datos.get("telefono_tecnico") or "-")),
    ]
    body = _plantilla(
        "ENTREGA EN CAMINO",
        f"Hola {cliente_nombre}, el técnico {datos['tecnico']} va en camino con tu pedido #{datos['pedido']}. Verifica su identidad con el nombre y el teléfono indicados antes de recibir los productos.",
        filas,
        "Recuerda revisar los productos al recibirlos.",
        color="#1a2e1a",
        acento="#8fd98a",
    )
    programar_correo(correo, subject, body)


# ──────────────────────────────────────────────────────────────────
# 📋 Notificaciones al cliente por cambios de estado de cita
# ──────────────────────────────────────────────────────────────────

_ESTADO_COLORES = {
    "Pendiente":    ("#3d3d3d", "#ffd98a"),
    "Confirmada":   ("#1a2e1a", "#8fd98a"),
    "Finalizada":   ("#1a2e1a", "#8fd98a"),
    "Cancelada":    ("#3d1212", "#ff9b9b"),
}

_ESTADO_TEXTO = {
    "Pendiente":    ("CITA EN ESPERA",
                     "Tu cita sigue en espera de confirmación por parte del técnico."),
    "Confirmada":   ("CITA CONFIRMADA",
                     "El técnico confirmó tu cita. Se presentará en la fecha y hora acordadas."),
    "Finalizada":   ("CITA FINALIZADA",
                     "Tu cita fue completada. Ahora puedes calificar al técnico desde Mis citas (es obligatorio para poder agendar una nueva cita)."),
    "Cancelada":    ("CITA CANCELADA",
                     "El técnico no pudo completar tu cita. Puedes reagendarla desde Mis citas."),
}


def notificar_cita_estado_cliente(
    db,
    cliente_id: int,
    correo: str,
    cliente_nombre: str,
    datos: dict,
    nuevo_estado: str,
    motivo: str | None = None,
) -> None:
    """Notifica al cliente por correo y plataforma cuando el estado de su cita cambia.

    ``datos`` debe contener al menos: servicio, fecha, tecnico. ``motivo``
    (opcional) personaliza el mensaje de una cancelación, p. ej. cuando la
    cita se cancela porque el técnico asignado fue deshabilitado.
    """
    header, body_text = _ESTADO_TEXTO.get(
        nuevo_estado,
        (f"CITA — {nuevo_estado.upper()}", f"El estado de tu cita cambió a {nuevo_estado}."),
    )
    color, acento = _ESTADO_COLORES.get(nuevo_estado, ("#1f1a12", "#ffd98a"))

    filas = [
        ("Servicio", datos["servicio"]),
        ("Fecha", datos["fecha"]),
        ("Técnico", datos["tecnico"]),
        ("Nuevo estado", nuevo_estado),
    ]

    if nuevo_estado == "Finalizada":
        body_text += (
            " Ahora necesitas calificar al técnico. "
            "Es obligatorio: no podrás agendar nuevas citas hasta que completes la calificación."
        )
    elif nuevo_estado == "Cancelada":
        if motivo:
            body_text = (
                f"Tu cita de {datos['servicio']} programada para el {datos['fecha']} "
                f"fue cancelada. {motivo} Puedes reagendarla desde Mis citas."
            )
        else:
            body_text += " Puedes reagendarla desde Mis citas."
    elif nuevo_estado == "Confirmada":
        body_text = (
            f"El técnico {datos['tecnico']} confirmó tu cita de {datos['servicio']} "
            f"para el {datos['fecha']}. Se presentará en la fecha y hora acordadas."
        )

    crear_notificacion(
        db,
        id_usuario=None,
        id_cliente=cliente_id,
        tipo="cita",
        titulo=f"Cita {nuevo_estado.lower()}",
        mensaje=(
            f"Tu cita de {datos['servicio']} para el {datos['fecha']} "
            f"fue marcada como {nuevo_estado}."
            + (
                " Debes calificar al técnico para poder agendar nuevas citas."
                if nuevo_estado == "Finalizada"
                else ""
            )
            + (f" {motivo}" if motivo else "")
        ),
    )

    subject_map = {
        "Pendiente":  "Tu cita en Neodomus está en espera",
        "Confirmada": "Tu cita en Neodomus fue confirmada",
        "Finalizada": "Califica al técnico — tu cita en Neodomus fue finalizada",
        "Cancelada":  "Tu cita en Neodomus no se pudo completar",
    }
    subject = subject_map.get(nuevo_estado, f"Actualización de tu cita — Neodomus")
    if nuevo_estado == "Cancelada" and motivo:
        subject = "Tu cita en Neodomus fue cancelada"

    body = _plantilla(header, body_text, filas, "Neodomus — Sistema de gestión inteligente.", color=color, acento=acento)
    programar_correo(correo, subject, body)


def notificar_recordatorio_cita(
    db,
    cliente_id: int,
    correo: str,
    cliente_nombre: str,
    datos: dict,
) -> None:
    """Notifica al cliente que tiene una cita próxima (recordatorio).

    Envía notificación de plataforma + correo. ``datos`` debe contener:
    servicio, fecha, hora, direccion.
    """
    crear_notificacion(
        db,
        id_usuario=None,
        id_cliente=cliente_id,
        tipo="cita",
        titulo="Recordatorio de cita",
        mensaje=(
            f"Tienes una cita de {datos['servicio']} programada para el "
            f"{datos['fecha']} a las {datos['hora']}."
        ),
    )

    filas = [
        ("Servicio", datos["servicio"]),
        ("Fecha", datos["fecha"]),
        ("Hora", datos["hora"]),
        ("Dirección", datos["direccion"]),
    ]
    body = _plantilla(
        "RECORDATORIO DE CITA",
        f"Hola {cliente_nombre}, este es un recordatorio de tu cita programada para mañana. "
        f"Revisa los detalles a continuación:",
        filas,
        "Si necesitas cancelar o reprogramar, hazlo desde Mis citas en la plataforma.",
        color="#3d3d3d",
        acento="#ffd98a",
    )
    programar_correo(correo, subject="Recordatorio de tu cita en Neodomus", body=body)