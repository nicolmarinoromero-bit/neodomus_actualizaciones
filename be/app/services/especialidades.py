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
ESTADOS_ENTREGA_OCUPAN = ("Asignada", "Recogido", "En camino")

# Franja laboral: citas cada 3 horas (08, 11, 14, 17), lunes a sábado.
# Domingo (weekday=6) queda bloqueado para agendar.
HORA_INICIO = 8
HORA_FIN = 18
DIAS_LABORALES = (0, 1, 2, 3, 4, 5)  # Monday..Saturday

# Duración estimada de un servicio en la agenda (horas).
# Depende de la dificultad de instalación de los productos de la compra;
# un servicio dura entre 1 y 2.5 h sin importar el volumen (el volumen
# lo reparten varios técnicos o varios días).
HORAS_POR_DIFICULTAD = {"baja": 1.0, "media": 2.0, "alta": 4.0}
HORAS_DIFICULTAD_DEFAULT = 1.5
DURACION_MIN = 1.0
DURACION_MAX = 2.5


def _clamp_duracion(horas: float) -> float:
    return max(DURACION_MIN, min(DURACION_MAX, horas))


def horas_producto(producto) -> float:
    """Horas estimadas según la dificultad de instalación del producto."""
    dificultad = (getattr(producto, "dificultad_instalacion", None) or "").strip().lower()
    return HORAS_POR_DIFICULTAD.get(dificultad, HORAS_DIFICULTAD_DEFAULT)


def duracion_base_tipo(tipo_servicio: Optional[str]) -> float:
    """Duración por defecto cuando la cita no tiene productos asociados."""
    return 1.5 if (tipo_servicio or "").strip().lower() == "instalacion" else 1.0


def duracion_desde_items(db: Session, items: Optional[Iterable[dict]]) -> Optional[float]:
    """Duración estimada (1–2.5 h) a partir de ítems de compra
    [{id_producto, cantidad}] antes de crear la cita."""
    from app.models.producto import Producto

    total = 0.0
    for item in items or []:
        try:
            id_producto = int(item.get("id_producto"))
            cantidad = max(1, int(item.get("cantidad") or 1))
        except (TypeError, ValueError):
            continue
        producto = db.query(Producto).filter(Producto.id_producto == id_producto).first()
        if producto is not None:
            total += horas_producto(producto) * cantidad
    if total <= 0:
        return None
    return _clamp_duracion(total)


def duracion_estimada_cita(db: Session, cita: Cita) -> float:
    """Horas que la cita ocupa en la agenda del técnico (entre 1 y 2.5)."""
    total = 0.0
    for cp in (cita.productos_asociados or []):
        producto = cp.producto
        if producto is not None:
            total += horas_producto(producto) * max(1, cp.cantidad or 1)
    if total > 0:
        return _clamp_duracion(total)
    return duracion_base_tipo(cita.tipo_servicio)


def _hora_a_minutos(hora: str | None) -> Optional[int]:
    try:
        partes = (hora or "").split(":")
        return int(partes[0]) * 60 + int(partes[1])
    except (TypeError, ValueError, IndexError):
        return None


def _se_solapan(ini_a: int, fin_a: int, ini_b: int, fin_b: int) -> bool:
    return ini_a < fin_b and ini_b < fin_a


def compatible_especialidad(tipo_servicio: Optional[str], certificacion: Optional[str]) -> bool:
    """Cualquier técnico puede atender cualquier servicio."""
    return True


# ────────────────────────────────────────────────────────────────
# Especializaciones (M2M técnico/producto)
# ────────────────────────────────────────────────────────────────


def especializaciones_de_tecnico(tecnico) -> list[int]:
    """Ids de especialización de un técnico (objeto Tecnico)."""
    return [e.id_especializacion for e in (tecnico.especializaciones or [])]


def tecnico_cubre(
    tecnico,
    ids_especializacion: Iterable[int],
) -> bool:
    """True si el técnico tiene TODAS las especializaciones indicadas.
    Si no se exige ninguna, todo técnico activo sirve."""
    requeridas = set(ids_especializacion or [])
    if not requeridas:
        return True
    propias = set(especializaciones_de_tecnico(tecnico))
    return requeridas.issubset(propias)


def _tecnicos_activos(db: Session) -> list:
    from app.models.tecnico import Tecnico
    from app.models.user import User

    return (
        db.query(Tecnico)
        .join(User, User.id_usuario == Tecnico.id_usuario_t)
        .filter(User.is_active == True, User.id_rol_u == 2)  # noqa: E712
        .all()
    )


def candidatos_para_especializaciones(
    db: Session,
    ids_especializacion: Iterable[int],
    fecha: Optional[date] = None,
    hora: str | None = None,
    excluir_ids: Optional[Iterable[int]] = None,
    duracion_horas: float = DURACION_MIN,
) -> list:
    """Técnicos activos que cubren todas las especializaciones pedidas y están
    libres durante toda la duración del servicio (si se indica fecha/hora).
    Ordenados por nombre."""
    excluir = set(excluir_ids or [])
    candidatos = [
        t
        for t in _tecnicos_activos(db)
        if t.id_tecnico not in excluir and tecnico_cubre(t, ids_especializacion)
    ]
    if fecha is not None:
        candidatos = [
            t
            for t in candidatos
            if not tecnico_ocupado(
                db, t.id_tecnico, fecha, hora, duracion_horas=duracion_horas
            )
        ]
    return sorted(candidatos, key=lambda t: ((t.usuario.first_name + " " + t.usuario.last_name) if t.usuario else ""))


def mejor_tecnico_para(
    db: Session,
    ids_especializacion: Iterable[int],
    fecha: Optional[date] = None,
    hora: str | None = None,
    excluir_ids: Optional[Iterable[int]] = None,
):
    """Mejor candidato disponible para unas especializaciones: prioriza al
    que cubre TODO; si ninguno cubre todo pero hay fecha/hora, devuelve None
    (no se asigna a alguien sin la especialidad)."""
    return next(iter(candidatos_para_especializaciones(db, ids_especializacion, fecha, hora, excluir_ids)), None)


def buscar_proximo_horario(
    db: Session,
    ids_especializacion: Iterable[int],
    desde_fecha: date,
    desde_hora: str | None,
    excluir_ids: Optional[Iterable[int]] = None,
    duracion_horas: float = DURACION_MIN,
    max_dias: int = 10,
):
    """Busca el primer hueco disponible (día laborable, franja 08-18) a partir
    de `desde_fecha` para un técnico que cubra las especializaciones pedidas.
    El mismo día solo se aceptan horas posteriores a `desde_hora`.

    Devuelve (fecha, hora, tecnico) o None si no hay hueco en max_días."""
    from datetime import timedelta

    excluir = set(excluir_ids or [])
    horas = horas_laborales(desde_fecha, duracion_horas)
    try:
        idx = horas.index((desde_hora or "08:00")[:5]) if (desde_hora or "")[:5] in horas else 0
    except ValueError:
        idx = 0

    for delta in range(max_dias + 1):
        f = desde_fecha + timedelta(days=delta)
        if not _dia_es_laboral(f):
            continue
        franjas = horas if delta > 0 else horas[idx:]
        for h in franjas:
            candidato = mejor_tecnico_para(
                db, ids_especializacion, fecha=f, hora=h,
                excluir_ids=excluir, 
            )
            if candidato is not None and not tecnico_ocupado(
                db, candidato.id_tecnico, f, h, duracion_horas=duracion_horas
            ):
                return f, h, candidato
        horas = horas_laborales(f, duracion_horas)
    return None


def especializaciones_de_productos(productos: Iterable) -> list[int]:
    """Unión de ids de especialización requerida por una lista de productos."""
    ids: set[int] = set()
    for p in productos:
        for e in (p.especializaciones_requeridas or []):
            ids.add(e.id_especializacion)
    return sorted(ids)


def _dia_es_laboral(fecha: date) -> bool:
    """True solo de lunes a sábado (el domingo queda bloqueado)."""
    return fecha.weekday() in DIAS_LABORALES


def horas_laborales(fecha: date, duracion_horas: float = DURACION_MIN) -> list[str]:
    """Franjas horarias de inicio válidas: 08:00, 11:00, 14:00 y 17:00
    (cada 3 horas a partir de las 8; la última cita es a las 17:00)."""
    paso = 3  # entre cita y cita transcurren 3 horas, hasta las 17 inclusive
    return [f"{h:02d}:00" for h in range(HORA_INICIO, HORA_FIN, paso)]


def slot_tomado(
    db: Session,
    fecha: date,
    hora: str,
    excluir_cita_id: Optional[int] = None,
    duracion_horas: float = DURACION_MIN,
) -> bool:
    """True si el intervalo [hora, hora+duracion) se cruza con alguna cita
    activa de la fecha (sin contar `excluir_cita_id`). Una franja solo puede
    ser reservada por un cliente a la vez."""
    nueva_ini = _hora_a_minutos(hora)
    if nueva_ini is None:
        return False
    nueva_fin = nueva_ini + round(duracion_horas * 60)
    citas = db.query(Cita).filter(
        Cita.fecha == fecha,
        Cita.estado.in_(ESTADOS_OCUPAN),
    )
    if excluir_cita_id is not None:
        citas = citas.filter(Cita.id_cita != excluir_cita_id)
    for cita in citas.all():
        ini = _hora_a_minutos(cita.hora)
        if ini is None:
            continue
        # Ventana fija de 3 h: una cita deja el hueco ocupado para OTROS
        # clientes hasta 3 horas después de su inicio (el técnico puede
        # desplazarse a otra agenda dentro de ese tiempo).
        fin = ini + 180
        if _se_solapan(nueva_ini, nueva_fin, ini, fin):
            return True
    return False


def auto_en_camino(db: Session, pedido) -> None:
    """Regla automática de estado de entrega: cuando falten 5 minutos para
    cumplirse las 3 horas desde el inicio de la franja, el pedido pasa a
    'En camino'. Persiste el cambio (idempotente)."""
    from datetime import datetime, time, timedelta

    if getattr(pedido, "estado_entrega", None) != "Asignada":
        return
    if not getattr(pedido, "fecha_entrega", None):
        return
    try:
        partes = (pedido.hora_entrega or "10:00").split(":")
        inicio = datetime.combine(
            pedido.fecha_entrega, time(int(partes[0]), int(partes[1]))
        )
    except (TypeError, ValueError, IndexError):
        return
    ahora = datetime.now()
    umbral = inicio + timedelta(hours=2, minutes=55)
    fin_ventana = inicio + timedelta(hours=8)
    if umbral <= ahora <= fin_ventana:
        pedido.estado_entrega = "En camino"
        db.commit()

        # Notificar al cliente que su pedido va en camino.
        try:
            from app.models.cliente import Cliente as ClienteModel
            from app.services.notificaciones import notificar_en_camino_cliente

            cliente = db.query(ClienteModel).filter(ClienteModel.id_cliente == pedido.id_cliente_pe).first()
            if cliente and cliente.email:
                nombre_cliente = f"{cliente.first_name} {cliente.last_name}".strip() or "Cliente"
                notificar_en_camino_cliente(
                    db,
                    cliente_id=cliente.id_cliente,
                    correo=cliente.email,
                    cliente_nombre=nombre_cliente,
                    datos={
                        "pedido": pedido.id_pedido,
                        "fecha": pedido.fecha_entrega.strftime("%d/%m/%Y") if pedido.fecha_entrega else "-",
                        "hora": pedido.hora_entrega or "-",
                        "tecnico": pedido.nombre_tecnico_entrega or "técnico",
                        "telefono_tecnico": None,
                    },
                )
                db.commit()
        except Exception:
            pass


def tecnico_ocupado(
    db: Session,
    id_tecnico: Optional[int],
    fecha: date,
    hora: str | None = None,
    excluir_cita_id: Optional[int] = None,
    duracion_horas: float = DURACION_MIN,
) -> bool:
    """True si el técnico ya tiene una cita activa (Pendiente/Confirmada)
    que se cruce con el intervalo [hora, hora+duracion) en la fecha indicada
    (o cualquier cita ese día si no se pasa `hora`). También considera las
    entregas activas —por solapamiento de su rango horario— y las citas donde
    es el segundo asignado."""
    if id_tecnico is None:
        return False
    q_citas = db.query(Cita).filter(
        or_(
            Cita.id_tecnico == id_tecnico,
            Cita.id_tecnico_2 == id_tecnico,
            Cita.id_tecnico_3 == id_tecnico,
        ),
        Cita.fecha == fecha,
        Cita.estado.in_(ESTADOS_OCUPAN),
    )
    if excluir_cita_id is not None:
        q_citas = q_citas.filter(Cita.id_cita != excluir_cita_id)
    nueva_ini = _hora_a_minutos(hora) if hora is not None else None
    for cita in q_citas.all():
        if nueva_ini is None:
            return True
        ini = _hora_a_minutos(cita.hora)
        if ini is None:
            continue
        fin = ini + round(duracion_estimada_cita(db, cita) * 60)
        if _se_solapan(nueva_ini, nueva_ini + round(duracion_horas * 60), ini, fin):
            return True

    from app.models.pedido import Pedido

    q_entregas = db.query(Pedido).filter(
        Pedido.id_tecnico_entrega == id_tecnico,
        Pedido.fecha_entrega == fecha,
        Pedido.estado_entrega.in_(ESTADOS_ENTREGA_OCUPAN),
    )
    if nueva_ini is None:
        return q_entregas.first() is not None
    nueva_fin = nueva_ini + round(duracion_horas * 60)
    for pedido in q_entregas.all():
        ini_e, fin_e = ventana_entrega(pedido)
        if _se_solapan(nueva_ini, nueva_fin, ini_e, fin_e):
            return True
    return False


def ventana_entrega(pedido) -> tuple[int, int]:
    """Rango [inicio_min, fin_min] de una entrega. Si no hay hora de inicio
    se asume 10:00; el fin por defecto es 1 h después del inicio."""
    ini = _hora_a_minutos(getattr(pedido, "hora_entrega", None))
    if ini is None:
        ini = 10 * 60
    fin = _hora_a_minutos(getattr(pedido, "hora_entrega_fin", None))
    if fin is None or fin <= ini:
        fin = ini + 60
    return ini, min(fin, HORA_FIN * 60)


def tecnico_libre_en_rango(
    db: Session,
    id_tecnico: Optional[int],
    fecha: date,
    hora_ini: str,
    hora_fin: str | None = None,
    excluir_pedido_id: Optional[int] = None,
) -> bool:
    """True si el técnico puede cubrir la franja [hora_ini, hora_fin] de la
    fecha: ninguna cita activa ni otra entrega activa debe solaparse."""
    if id_tecnico is None:
        return False
    ini_n = _hora_a_minutos(hora_ini)
    if ini_n is None:
        return True
    fin_n = _hora_a_minutos(hora_fin)
    if fin_n is None or fin_n <= ini_n:
        fin_n = ini_n + 60

    q_citas = db.query(Cita).filter(
        or_(
            Cita.id_tecnico == id_tecnico,
            Cita.id_tecnico_2 == id_tecnico,
            Cita.id_tecnico_3 == id_tecnico,
        ),
        Cita.fecha == fecha,
        Cita.estado.in_(ESTADOS_OCUPAN),
    )
    for cita in q_citas.all():
        ini = _hora_a_minutos(cita.hora)
        if ini is None:
            continue
        fin = ini + round(duracion_estimada_cita(db, cita) * 60)
        if _se_solapan(ini_n, fin_n, ini, fin):
            return False

    from app.models.pedido import Pedido

    q_entregas = db.query(Pedido).filter(
        Pedido.id_tecnico_entrega == id_tecnico,
        Pedido.fecha_entrega == fecha,
        Pedido.estado_entrega.in_(ESTADOS_ENTREGA_OCUPAN),
    )
    if excluir_pedido_id is not None:
        q_entregas = q_entregas.filter(Pedido.id_pedido != excluir_pedido_id)
    for pedido in q_entregas.all():
        ini_e, fin_e = ventana_entrega(pedido)
        if _se_solapan(ini_n, fin_n, ini_e, fin_e):
            return False
    return True