"""Devoluciones de productos solicitadas por el cliente.

Flujo (estilo e-commerce):
  - El cliente entra a su pedido entregado y pulsa "Solicitar devolución".
  - Elige uno o varios productos del pedido y cuántas unidades devolver
    (devolución parcial o total), indica el motivo estructurado y revisa
    un resumen antes de confirmar.
  - La solicitud queda en el pipeline: Solicitada → En revisión → Aprobada
    → Producto en devolución → Recibida → Reembolso procesado (+ Rechazada).
  - Los administradores la gestionan desde el panel y cada cambio de estado
    notifica al cliente. Las líneas legadas de ``devoluciones`` siguen
    alimentando el flujo de recogida del técnico.

Endpoints legados conservados: POST "" (una línea), PUT /{id}/estado,
recogidas y evidencias del técnico, reasignación de técnico.
"""
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import List, Optional, Union

import uuid

from fastapi import APIRouter, Depends, HTTPException, File, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.cliente import Cliente
from app.models.devolucion import Devolucion
from app.models.pedido import DetallePedido
from app.models.producto import Producto
from app.models.roles_usuario import RolesUsuario
from app.models.solicitud_devolucion import SolicitudDevolucion
from app.models.user import User
from app.services import devoluciones_service as dv_service
from app.services import minio_service
from app.services.notificaciones import (
    crear_notificacion,
    notificar_admin_devolucion_solicitada,
    notificar_devolucion_cliente,
)
from app.utils.security import get_current_client, get_current_employee, get_current_user

EXTENSIONES_EVIDENCIA = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ERROR_DEVOLUCION_NO_ENCONTRADA = "Devolución no encontrada"
DIRECCION_POR_DEFINIR = "Por definir"
ROLES_ADMINISTRATIVOS = {"admin", "administrador", "soporte"}

router = APIRouter(prefix="/devoluciones", tags=["Devoluciones"])


def _url_evidencia_devolucion(id_devolucion: int, tipo: str) -> str:
    return f"/devoluciones/{id_devolucion}/evidencia-{tipo}/archivo"


def _es_rol_administrativo(db: Session, user: User) -> bool:
    role = db.execute(
        select(RolesUsuario.nombre_rol).where(RolesUsuario.id_rol == user.id_rol_u)
    ).scalar_one_or_none()
    return role in ROLES_ADMINISTRATIVOS


def _validar_acceso_evidencia(db: Session, devolucion: Devolucion, current_user) -> None:
    from app.models.tecnico import Tecnico

    if isinstance(current_user, Cliente):
        tiene_acceso = devolucion.id_cliente_d == current_user.id_cliente
    elif _es_rol_administrativo(db, current_user):
        tiene_acceso = True
    else:
        ficha = db.query(Tecnico).filter(Tecnico.id_usuario_t == current_user.id_usuario).first()
        tiene_acceso = bool(ficha and devolucion.id_tecnico_recogida == ficha.id_tecnico)

    if not tiene_acceso:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver esta evidencia")


def _direccion_o_predeterminada(cliente: Optional[Cliente]) -> str:
    if cliente is None:
        return DIRECCION_POR_DEFINIR
    return (cliente.address or "").strip() or DIRECCION_POR_DEFINIR


def _servir_evidencia_devolucion(db: Session, id_devolucion: int, tipo: str, current_user) -> Response:
    """Sirve la evidencia de recogida/cambio previa comprobación de rol/asignación."""
    devolucion = db.query(Devolucion).filter(Devolucion.id_devolucion == id_devolucion).first()
    if not devolucion:
        raise HTTPException(status_code=404, detail=ERROR_DEVOLUCION_NO_ENCONTRADA)
    ref = devolucion.evidencia_recogida if tipo == "recogida" else devolucion.evidencia_cambio
    if not ref:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")

    _validar_acceso_evidencia(db, devolucion, current_user)
    try:
        contenido, media = minio_service.leer_archivo(ref)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return Response(content=contenido, media_type=media)


@router.get(
    "/{id_devolucion}/evidencia-recogida/archivo",
    responses={403: {"description": "Acceso denegado"}, 404: {"description": "Evidencia no encontrada"}},
)
def descargar_evidencia_recogida(
    id_devolucion: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _servir_evidencia_devolucion(db, id_devolucion, "recogida", current_user)


@router.get(
    "/{id_devolucion}/evidencia-cambio/archivo",
    responses={403: {"description": "Acceso denegado"}, 404: {"description": "Evidencia no encontrada"}},
)
def descargar_evidencia_cambio(
    id_devolucion: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _servir_evidencia_devolucion(db, id_devolucion, "cambio", current_user)


# Valida las condiciones de esta operación y devuelve un error HTTP si no se cumplen.
def _admin(
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> User:
    role = db.execute(
        select(RolesUsuario.nombre_rol).where(RolesUsuario.id_rol == current_user.id_rol_u)
    ).scalar_one_or_none()
    if role not in ROLES_ADMINISTRATIVOS:
        raise HTTPException(status_code=403, detail="Permisos insuficientes")
    return current_user


# Agrupa los campos de DevolucionCreate: id_pedido, id_producto, motivo, preferencia.
class DevolucionCreate(BaseModel):
    id_pedido: int
    id_producto: int = Field(gt=0)
    motivo: Optional[str] = None
    preferencia: Optional[str] = None  # 'producto' | 'dinero'


def _serializar_devolucion(d: Devolucion, cliente=None, producto=None) -> dict:
    if producto is not None:
        nombre_producto = producto.nombre_producto
    elif d.id_producto_d:
        nombre_producto = f"Producto #{d.id_producto_d}"
    else:
        nombre_producto = None

    return {
        "id_devolucion": d.id_devolucion,
        "id_pedido": d.id_pedido_d,
        "id_producto": d.id_producto_d,
        "producto": nombre_producto,
        "cantidad": d.cantidad or 1,
        "id_solicitud": d.id_solicitud_dv,
        "preferencia": d.preferencia,
        "id_tecnico_recogida": d.id_tecnico_recogida,
        "recogida_estado": d.recogida_estado,
        "cliente": (
            f"{cliente.first_name} {cliente.last_name}".strip()
            if cliente is not None
            else None
        ),
        "motivo": d.motivo,
        "estado": d.estado,
        "resolucion": d.resolucion,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "resuelta_at": d.resuelta_at.isoformat() if d.resuelta_at else None,
    }


def _mapas_detalle_solicitud(db: Session, solicitud, lineas: list) -> tuple[dict, dict]:
    ids_productos = [linea.id_producto_d for linea in lineas if linea.id_producto_d]
    if not ids_productos:
        return {}, {}

    productos = db.query(Producto).filter(Producto.id_producto.in_(ids_productos)).all()
    detalles = (
        db.query(DetallePedido)
        .filter(
            DetallePedido.id_pedido_d == solicitud.id_pedido_s,
            DetallePedido.id_producto_d.in_(ids_productos),
        )
        .all()
    )
    return (
        {producto.id_producto: producto for producto in productos},
        {detalle.id_producto_d: detalle for detalle in detalles},
    )


def _notificar_tecnicos_solicitud(
    db: Session,
    client: Cliente,
    solicitud,
    lineas: list,
    productos_map: dict,
    detalles_map: dict,
    cliente_nombre: str,
) -> None:
    from app.models.tecnico import Tecnico
    from app.services.notificaciones import programar_correo

    direccion = _direccion_o_predeterminada(client)
    tecnicos_notificados: set[int] = set()
    for linea in lineas:
        id_tecnico = linea.id_tecnico_recogida
        if not id_tecnico or id_tecnico in tecnicos_notificados:
            continue
        tecnicos_notificados.add(id_tecnico)

        tecnico = db.query(Tecnico).filter(Tecnico.id_tecnico == id_tecnico).first()
        if not tecnico or not tecnico.usuario:
            continue

        nombre_producto = _nombre_linea(linea, detalles_map, productos_map)
        crear_notificacion(
            db,
            id_usuario=tecnico.usuario.id_usuario,
            id_cliente=None,
            tipo="recogida",
            titulo="Recogida por devolución asignada",
            mensaje=f"Debes recoger '{nombre_producto}' del pedido #{solicitud.id_pedido_s} en: {direccion}.",
        )
        if tecnico.usuario.email:
            nombre_tecnico = f"{tecnico.usuario.first_name} {tecnico.usuario.last_name}".strip() or "Técnico"
            programar_correo(
                tecnico.usuario.email,
                "Recogida por devolución asignada - Neodomus",
                "<div style='font-family:Arial,sans-serif;max-width:560px;margin:auto'>"
                "<h2 style='color:#1f1a12'>Recogida asignada</h2>"
                f"<p>Hola <strong>{nombre_tecnico}</strong>, te asignamos recoger el "
                f"<strong>{nombre_producto}</strong> del pedido #{solicitud.id_pedido_s}.</p>"
                f"<p><strong>Dirección:</strong> {direccion}<br/>"
                f"<strong>Cliente:</strong> {cliente_nombre}</p>"
                "</div>",
            )

        crear_notificacion(
            db,
            id_usuario=None,
            id_cliente=client.id_cliente,
            tipo="recogida",
            titulo="Técnico asignado para tu devolución",
            mensaje=f"Un técnico pasará a recoger los productos de tu devolución {solicitud.numero} (pedido #{solicitud.id_pedido_s}).",
        )


def _notificar_solicitud_creada(db: Session, client: Cliente, solicitud) -> None:
    """Notifica administradores, técnicos asignados y al cliente."""
    cliente_nombre = f"{client.first_name} {client.last_name}".strip() or "Cliente"
    lineas = (
        db.query(Devolucion)
        .filter(Devolucion.id_solicitud_dv == solicitud.id_solicitud)
        .all()
    )
    productos_map, detalles_map = _mapas_detalle_solicitud(db, solicitud, lineas)
    resumen_productos = ", ".join(
        f"{_texto_cantidad_linea(linea)} {_nombre_linea(linea, detalles_map, productos_map)}"
        for linea in lineas
    )

    notificar_admin_devolucion_solicitada(
        db,
        solicitud.id_pedido_s,
        cliente_nombre,
        f"{resumen_productos} ({solicitud.numero})",
        dv_service.MOTIVOS_DEVOLUCION.get(solicitud.motivo_tipo or "", solicitud.motivo_tipo),
    )
    _notificar_tecnicos_solicitud(
        db, client, solicitud, lineas, productos_map, detalles_map, cliente_nombre
    )
    notificar_devolucion_cliente(
        db,
        client.id_cliente,
        client.email,
        cliente_nombre,
        numero=solicitud.numero,
        pedido_id=solicitud.id_pedido_s,
        evento="solicitada",
        monto=float(solicitud.monto_total or 0),
        productos_txt=resumen_productos,
    )


def _nombre_linea(linea: Devolucion, detalles_map: dict, productos_map: dict) -> str:
    det = detalles_map.get(linea.id_producto_d)
    prod = productos_map.get(linea.id_producto_d)
    if det is not None and det.descripcion_detalle:
        return det.descripcion_detalle
    if prod is not None:
        return prod.nombre_producto
    return f"Producto #{linea.id_producto_d or '?'}"


def _texto_cantidad_linea(linea: Devolucion) -> str:
    """Cantidad legible de una línea: '2,5 m' para cortes, '2×' para unidades."""
    if linea.cantidad_metros is not None:
        metros = f"{Decimal(linea.cantidad_metros):f}".rstrip("0").rstrip(".")
        return f"{metros.replace('.', ',')} m de"
    return f"{linea.cantidad}×"


@router.post(
    "",
    responses={400: {"description": "Solicitud inválida"}, 404: {"description": "Pedido no encontrado"}},
)
def solicitar_devolucion(
    data: DevolucionCreate,
    client: Cliente = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Endpoint LEGADO (una sola línea): delega en el servicio de solicitudes
    para que las reglas de cantidades y duplicados sean las mismas."""
    try:
        solicitud = dv_service.crear_solicitud(
            db,
            client,
            id_pedido=data.id_pedido,
            items=[{"id_producto": data.id_producto, "cantidad": 1}],
            motivo_tipo="otro",
            motivo_otro=(data.motivo or "").strip() or None,
            comentario=None,
        )
    except dv_service.ItemInvalido as e:
        raise HTTPException(status_code=400, detail=e.mensaje)
    except PermissionError as e:
        # Pedido inexistente o de otro cliente (PEN-09: rechazo explícito).
        raise HTTPException(status_code=404, detail=str(e))

    _notificar_solicitud_creada(db, client, solicitud)

    linea = (
        db.query(Devolucion)
        .filter(Devolucion.id_solicitud_dv == solicitud.id_solicitud)
        .first()
    )
    producto = (
        db.query(Producto).filter(Producto.id_producto == data.id_producto).first()
    )
    return _serializar_devolucion(linea, producto=producto)


# ──────────────────────────────────────────────────────────────────
# Nuevo flujo: solicitudes con múltiples productos y cantidades
# ──────────────────────────────────────────────────────────────────

# Longitud en metros del item: número o texto ("2,5"); el servicio valida
# precisión (≤ 2 decimales) y que corresponda al corte completo (PEN-09).
MetrosItem = Union[str, int, float]


# Agrupa los campos de ItemDevolucionIn: id_producto, cantidad, metros.
class ItemDevolucionIn(BaseModel):
    id_producto: int = Field(gt=0)
    cantidad: int = Field(default=1, ge=1)
    metros: Optional[MetrosItem] = None


# Agrupa los campos de SolicitudDevolucionCreate: id_pedido, items, motivo_tipo, motivo_otro, comentario.
class SolicitudDevolucionCreate(BaseModel):
    id_pedido: int
    items: List[ItemDevolucionIn]
    motivo_tipo: str  # clave del catálogo MOTIVOS_DEVOLUCION
    motivo_otro: Optional[str] = None  # obligatorio si motivo_tipo == 'otro'
    comentario: Optional[str] = None


@router.get(
    "/elegibilidad/{id_pedido}",
    responses={404: {"description": "Pedido no encontrado"}},
)
def elegibilidad_devolucion(
    id_pedido: int,
    client: Cliente = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Productos del pedido entregado con las unidades disponibles para
    devolver (compradas − ya solicitadas en solicitudes activas)."""
    try:
        return dv_service.elegibilidad_pedido(db, client, id_pedido)
    except PermissionError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/solicitudes",
    responses={400: {"description": "Solicitud inválida"}, 404: {"description": "Pedido no encontrado"}},
)
def crear_solicitud_devolucion(
    data: SolicitudDevolucionCreate,
    client: Cliente = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Crea una solicitud de devolución parcial o total con varias líneas."""
    try:
        solicitud = dv_service.crear_solicitud(
            db,
            client,
            id_pedido=data.id_pedido,
            items=[item.model_dump() for item in data.items],
            motivo_tipo=data.motivo_tipo,
            motivo_otro=data.motivo_otro,
            comentario=data.comentario,
        )
    except dv_service.ItemInvalido as e:
        raise HTTPException(status_code=400, detail=e.mensaje)
    except PermissionError as e:
        # Pedido inexistente o de otro cliente: se rechaza sin exponer
        # detalles internos (PEN-09 / seguridad).
        raise HTTPException(status_code=404, detail=str(e))

    _notificar_solicitud_creada(db, client, solicitud)
    return dv_service.serializar_solicitud(db, solicitud)


@router.get("/mis-solicitudes")
def mis_solicitudes_devolucion(
    client: Cliente = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Solicitudes de devolución del cliente autenticado (más recientes primero)."""
    filas = (
        db.query(SolicitudDevolucion)
        .filter(SolicitudDevolucion.id_cliente_s == client.id_cliente)
        .order_by(SolicitudDevolucion.created_at.desc())
        .limit(100)
        .all()
    )
    return [dv_service.serializar_solicitud(db, s) for s in filas]


@router.get("/admin/solicitudes", responses={403: {"description": "Permisos insuficientes"}})
def listar_solicitudes_admin(
    estado: Optional[str] = Query(None),
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Todas las solicitudes de devolución con sus líneas (administradores)."""
    consulta = db.query(SolicitudDevolucion)
    if estado:
        consulta = consulta.filter(SolicitudDevolucion.estado == estado)
    filas = consulta.order_by(SolicitudDevolucion.created_at.desc()).limit(200).all()
    return [dv_service.serializar_solicitud(db, s) for s in filas]


# Agrupa los campos de EstadoSolicitudUpdate: estado, resolucion, motivo_rechazo, observaciones.
class EstadoSolicitudUpdate(BaseModel):
    estado: Optional[str] = None  # None → solo actualiza observaciones
    resolucion: Optional[str] = None
    motivo_rechazo: Optional[str] = None
    observaciones: Optional[str] = None


def _guardar_estado_solicitud(
    db: Session, solicitud: SolicitudDevolucion, data: EstadoSolicitudUpdate, admin: User, solo_observaciones: bool
) -> tuple[SolicitudDevolucion, Optional[object]]:
    try:
        if solo_observaciones:
            solicitud.observaciones_admin = (data.observaciones or "").strip() or None
            solicitud.updated_at = datetime.now()
            db.commit()
            db.refresh(solicitud)
            return solicitud, None
        solicitud, reembolso = dv_service.cambiar_estado(
            db,
            solicitud,
            data.estado,
            resolucion=data.resolucion,
            motivo_rechazo=data.motivo_rechazo,
            observaciones=data.observaciones,
            admin_id=admin.id_usuario,
        )
        return solicitud, reembolso
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except dv_service.ItemInvalido as exc:
        raise HTTPException(status_code=400, detail=exc.mensaje) from exc


def _notificar_cambio_estado_solicitud(db: Session, solicitud: SolicitudDevolucion) -> None:
    cliente = db.query(Cliente).filter(Cliente.id_cliente == solicitud.id_cliente_s).first()
    evento = {
        dv_service.EST_EN_REVISION: "en_revision",
        dv_service.EST_APROBADA: "aprobada",
        dv_service.EST_RECHAZADA: "rechazada",
        dv_service.EST_RECIBIDA: "recibida",
        dv_service.EST_REEMBOLSO: "reembolso_procesado",
    }.get(solicitud.estado)
    if not evento or not cliente:
        return

    lineas = (
        db.query(Devolucion)
        .filter(Devolucion.id_solicitud_dv == solicitud.id_solicitud)
        .all()
    )
    ids_productos = [linea.id_producto_d for linea in lineas if linea.id_producto_d]
    productos = (
        db.query(Producto).filter(Producto.id_producto.in_(ids_productos)).all()
        if ids_productos
        else []
    )
    productos_map = {producto.id_producto: producto for producto in productos}
    productos_txt = ", ".join(
        f"{_texto_cantidad_linea(linea)} {_nombre_linea(linea, {}, productos_map)}"
        for linea in lineas
    )
    notificar_devolucion_cliente(
        db,
        cliente.id_cliente,
        cliente.email,
        f"{cliente.first_name} {cliente.last_name}".strip() or "Cliente",
        numero=solicitud.numero,
        pedido_id=solicitud.id_pedido_s or 0,
        evento=evento,
        monto=float(solicitud.monto_total or 0),
        motivo_rechazo=solicitud.motivo_rechazo,
        productos_txt=productos_txt,
    )


@router.put(
    "/admin/solicitudes/{id_solicitud}/estado",
    responses={
        400: {"description": "Actualización inválida"},
        403: {"description": "Permisos insuficientes"},
        404: {"description": "Solicitud no encontrada"},
    },
)
def cambiar_estado_solicitud(
    id_solicitud: int,
    data: EstadoSolicitudUpdate,
    admin: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Avanza el pipeline de una devolución y notifica al cliente.

    Estados válidos: En revisión · Aprobada (+ Reembolso/Cambio)
    · Rechazada (+ motivo) · Producto en devolución · Recibida
    · Reembolso procesado.
    """
    solicitud = (
        db.query(SolicitudDevolucion)
        .filter(SolicitudDevolucion.id_solicitud == id_solicitud)
        .first()
    )
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    solo_observaciones = not data.estado
    if solo_observaciones and data.observaciones is None:
        raise HTTPException(status_code=400, detail="Nada que actualizar")

    solicitud, reembolso = _guardar_estado_solicitud(
        db, solicitud, data, admin, solo_observaciones
    )

    # Notificaciones al cliente según el nuevo estado.
    if not solo_observaciones:
        _notificar_cambio_estado_solicitud(db, solicitud)

    respuesta = dv_service.serializar_solicitud(db, solicitud)
    respuesta["id_reembolso"] = reembolso.id_reembolso if reembolso else None
    return respuesta


@router.get("/mias")
def mis_devoluciones(
    client: Cliente = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Devoluciones solicitadas por el cliente autenticado."""
    filas = (
        db.query(Devolucion)
        .filter(Devolucion.id_cliente_d == client.id_cliente)
        .order_by(Devolucion.created_at.desc())
        .all()
    )
    ids_productos = [f.id_producto_d for f in filas if f.id_producto_d]
    productos = (
        {p.id_producto: p for p in db.query(Producto).filter(Producto.id_producto.in_(ids_productos)).all()}
        if ids_productos
        else {}
    )
    return [_serializar_devolucion(f, producto=productos.get(f.id_producto_d)) for f in filas]


@router.get("", responses={403: {"description": "Permisos insuficientes"}})
def listar_devoluciones_admin(
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Todas las solicitudes de devolución (solo administradores)."""
    filas = (
        db.query(Devolucion)
        .order_by(Devolucion.created_at.desc())
        .limit(200)
        .all()
    )
    clientes = {c.id_cliente: c for c in db.query(Cliente).all()}
    ids_productos = [f.id_producto_d for f in filas if f.id_producto_d]
    productos = (
        {p.id_producto: p for p in db.query(Producto).filter(Producto.id_producto.in_(ids_productos)).all()}
        if ids_productos
        else {}
    )
    return [
        _serializar_devolucion(
            f,
            cliente=clientes.get(f.id_cliente_d),
            producto=productos.get(f.id_producto_d),
        )
        for f in filas
    ]


@router.get("/mis-recogidas")
def mis_recogidas(
    historial: bool = Query(False),
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Devoluciones donde el técnico autenticado fue asignado a recoger
    el producto del cliente.

    Con ``historial=false`` (por defecto) devuelve solo las recogidas
    activas (Asignada / Recogida). Con ``historial=true`` devuelve TODAS,
    incluidas resueltas o rechazadas, para el historial del técnico.
    """
    from app.models.tecnico import Tecnico

    ficha = db.query(Tecnico).filter(Tecnico.id_usuario_t == current_user.id_usuario).first()
    if not ficha:
        return []

    consulta = db.query(Devolucion).filter(
        Devolucion.id_tecnico_recogida == ficha.id_tecnico
    )
    if not historial:
        # Activas = SOLO lo pendiente por hacer:
        #   - Asignada (falta recoger el producto), o
        #   - ya recogida pero con producto de CAMBIO pendiente de entrega.
        # Al confirmar la recogida con evidencia, la devolución sale de esta
        # lista y queda guardada en el HISTORIAL (historial=true).
        consulta = consulta.filter(
            or_(
                Devolucion.recogida_estado == "Asignada",
                and_(
                    Devolucion.recogida_estado == "Recogida",
                    Devolucion.resolucion == "Cambio",
                    Devolucion.evidencia_cambio.is_(None),
                ),
            )
        )
    filas = consulta.order_by(Devolucion.created_at.desc()).limit(200).all()
    return [_serializar_recogida_tecnico(db, devolucion) for devolucion in filas]


def _serializar_recogida_tecnico(db: Session, devolucion: Devolucion) -> dict:
    cliente = db.query(Cliente).filter(Cliente.id_cliente == devolucion.id_cliente_d).first()
    producto = None
    if devolucion.id_producto_d:
        producto = (
            db.query(Producto)
            .filter(Producto.id_producto == devolucion.id_producto_d)
            .first()
        )
    nombre_producto = (
        producto.nombre_producto if producto else f"Producto #{devolucion.id_producto_d}"
    )
    nombre_cliente = (
        f"{cliente.first_name} {cliente.last_name}".strip() if cliente else "Cliente"
    )

    return {
        "id_devolucion": devolucion.id_devolucion,
        "id_pedido": devolucion.id_pedido_d,
        "producto": nombre_producto,
        "cantidad": devolucion.cantidad or 1,
        "producto_imagen": producto.imagen_url if producto else None,
        "cliente": nombre_cliente,
        "direccion": _direccion_o_predeterminada(cliente),
        "telefono": cliente.telefono_cliente if cliente else None,
        "email": cliente.email if cliente else None,
        "estado_devolucion": devolucion.estado,
        "resolucion": devolucion.resolucion,
        "preferencia": devolucion.preferencia or "dinero",
        "recogida_estado": devolucion.recogida_estado,
        "motivo": devolucion.motivo,
        "fecha_solicitud": (
            devolucion.created_at.isoformat() if devolucion.created_at else None
        ),
        "evidencia_recogida_url": (
            _url_evidencia_devolucion(devolucion.id_devolucion, "recogida")
            if devolucion.evidencia_recogida
            else None
        ),
        "fecha_recogida": (
            devolucion.fecha_recogida.isoformat() if devolucion.fecha_recogida else None
        ),
        "evidencia_cambio_url": (
            _url_evidencia_devolucion(devolucion.id_devolucion, "cambio")
            if devolucion.evidencia_cambio
            else None
        ),
        "fecha_entrega_cambio": (
            devolucion.fecha_entrega_cambio.isoformat()
            if devolucion.fecha_entrega_cambio
            else None
        ),
    }


# Agrupa los campos de RecogidaUpdate: recogida.
class RecogidaUpdate(BaseModel):
    recogida: bool = True


@router.put(
    "/{id_devolucion}/recogida",
    responses={404: {"description": "Recogida no encontrada"}},
)
def marcar_recogida(
    id_devolucion: int,
    data: RecogidaUpdate,
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """El técnico asignado confirma que recogió el producto."""
    from app.models.tecnico import Tecnico

    ficha = db.query(Tecnico).filter(Tecnico.id_usuario_t == current_user.id_usuario).first()
    devolucion = (
        db.query(Devolucion)
        .filter(
            Devolucion.id_devolucion == id_devolucion,
            Devolucion.id_tecnico_recogida == (ficha.id_tecnico if ficha else -1),
        )
        .first()
    )
    if not devolucion:
        raise HTTPException(status_code=404, detail="Recogida no encontrada")

    devolucion.recogida_estado = "Recogida" if data.recogida else "Asignada"
    db.commit()
    return {
        "id_devolucion": devolucion.id_devolucion,
        "recogida_estado": devolucion.recogida_estado,
    }


async def _leer_evidencia_imagen(file: UploadFile, uso: str) -> tuple[str, bytes]:
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail=f"Selecciona una foto {uso}")

    extension = Path(file.filename).suffix.lower()
    if extension not in EXTENSIONES_EVIDENCIA:
        raise HTTPException(status_code=400, detail="Formato no permitido (usa JPG, PNG, WEBP o GIF)")

    contenido = await file.read()
    if not contenido:
        raise HTTPException(status_code=400, detail="El archivo está vacío")
    if len(contenido) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen supera los 5 MB")

    try:
        import io

        from PIL import Image

        Image.open(io.BytesIO(contenido)).verify()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="El archivo no es una imagen válida") from exc

    return extension, contenido


def _reintegrar_stock_recogida(
    db: Session, devolucion: Devolucion
) -> tuple[Optional[Producto], Optional[dict]]:
    if not devolucion.id_producto_d:
        return None, None
    producto = db.query(Producto).filter(Producto.id_producto == devolucion.id_producto_d).first()
    if producto is None:
        return None, None

    from app.services.inventario_service import reintegrar_stock
    from app.services.pedidos_service import _variante_por_descripcion

    consulta_detalle = db.query(DetallePedido).filter(
        DetallePedido.id_pedido_d == devolucion.id_pedido_d,
        DetallePedido.id_producto_d == devolucion.id_producto_d,
    )
    if devolucion.cantidad_metros is not None:
        detalle = consulta_detalle.filter(DetallePedido.cantidad_metros.isnot(None)).first()
        cantidad = Decimal(str(devolucion.cantidad_metros))
    else:
        detalle = (
            consulta_detalle.filter(DetallePedido.cantidad_metros.is_(None)).first()
            or consulta_detalle.first()
        )
        cantidad = Decimal(int(devolucion.cantidad or 1))

    variante = (
        _variante_por_descripcion(producto, detalle.descripcion_detalle)
        if detalle is not None
        else None
    )
    info = reintegrar_stock(db, producto, variante, cantidad)
    return producto, info


def _avanzar_solicitud_tras_recogida(db: Session, devolucion: Devolucion) -> None:
    if not devolucion.id_solicitud_dv:
        return
    solicitud = (
        db.query(SolicitudDevolucion)
        .filter(SolicitudDevolucion.id_solicitud == devolucion.id_solicitud_dv)
        .first()
    )
    if solicitud is None:
        return

    estado_previo = solicitud.estado
    dv_service.avanzar_por_recogida(db, devolucion)
    db.refresh(solicitud)
    estados_notificables = {
        dv_service.EST_RECIBIDA,
        dv_service.EST_REEMBOLSO,
        dv_service.EST_EN_DEVOLUCION,
    }
    if solicitud.estado == estado_previo or solicitud.estado not in estados_notificables:
        return

    cliente = db.query(Cliente).filter(Cliente.id_cliente == solicitud.id_cliente_s).first()
    if cliente is None:
        return
    notificar_devolucion_cliente(
        db,
        cliente.id_cliente,
        cliente.email,
        f"{cliente.first_name} {cliente.last_name}".strip() or "Cliente",
        numero=solicitud.numero,
        pedido_id=solicitud.id_pedido_s or 0,
        evento="reembolso_procesado" if solicitud.estado == dv_service.EST_REEMBOLSO else "recibida",
        monto=float(solicitud.monto_total or 0),
    )


def _notificar_recogida_a_cliente(db: Session, devolucion: Devolucion, cliente: Optional[Cliente]) -> None:
    if cliente is None:
        return
    if (devolucion.resolucion or "") == "Reembolso":
        detalle = "Tu reembolso continúa el proceso por el medio de pago original."
    else:
        detalle = "Coordinaremos el envío de tu producto de cambio."
    crear_notificacion(
        db,
        id_usuario=None,
        id_cliente=cliente.id_cliente,
        tipo="entrega",
        titulo=f"Devolución #{devolucion.id_devolucion} recogida",
        mensaje=f"El técnico recogió tu producto. {detalle}",
    )


def _notificar_recogida_a_administradores(
    db: Session,
    devolucion: Devolucion,
    producto: Optional[Producto],
    cliente: Optional[Cliente],
) -> None:
    from app.models.user import User as UserModel

    nombre_cliente = (
        f"{cliente.first_name} {cliente.last_name}".strip() if cliente is not None else "Cliente"
    )
    producto_nombre = (
        producto.nombre_producto
        if producto
        else f"Producto #{devolucion.id_producto_d or '?'}"
    )
    admins_ids = (
        db.execute(
            select(UserModel.id_usuario).where(
                UserModel.id_rol_u == 1,
                UserModel.is_active.is_(True),
            )
        )
        .scalars()
        .all()
    )
    for id_admin in admins_ids:
        crear_notificacion(
            db,
            id_usuario=id_admin,
            id_cliente=None,
            tipo="recogida",
            titulo="Devolución recogida por técnico",
            mensaje=(
                f"El técnico recogió '{producto_nombre}' de {nombre_cliente} "
                f"(devolución #{devolucion.id_devolucion}, pedido #{devolucion.id_pedido_d}). "
                "Evidencia fotográfica disponible en MinIO."
            ),
        )


@router.post(
    "/{id_devolucion}/evidencia-recogida",
    responses={
        400: {"description": "Evidencia inválida o devolución no lista para recogida"},
        404: {"description": "Recogida no encontrada"},
    },
)
async def subir_evidencia_recogida(
    id_devolucion: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """El técnico asignado sube la evidencia fotográfica de que recogió el
    producto en casa del cliente. Al confirmarse:
      - recogida_estado -> 'Recogida' (con fecha y foto en MinIO)
      - el producto REGRESA al inventario (+1)
      - se notifica al cliente."""
    from app.models.tecnico import Tecnico

    ficha = db.query(Tecnico).filter(Tecnico.id_usuario_t == current_user.id_usuario).first()
    devolucion = (
        db.query(Devolucion)
        .with_for_update()
        .populate_existing()
        .filter(
            Devolucion.id_devolucion == id_devolucion,
            Devolucion.id_tecnico_recogida == (ficha.id_tecnico if ficha else -1),
        )
        .first()
    )
    if not devolucion:
        raise HTTPException(status_code=404, detail="Recogida no encontrada")
    if devolucion.estado != "Aprobada":
        raise HTTPException(status_code=400, detail="La devolución no está aprobada")
    if devolucion.recogida_estado == "Recogida":
        # Idempotencia (PEN-10): la fila bloqueada garantiza que un doble
        # envío (o dos técnicos) no re-integre el stock dos veces.
        raise HTTPException(status_code=400, detail="Esta recogida ya fue confirmada")

    ext, contenido = await _leer_evidencia_imagen(file, "de la recogida")

    nombre = f"{uuid.uuid4().hex}{ext}"
    clave = minio_service.subir_imagen_privada("recogidas", nombre, contenido)

    devolucion.evidencia_recogida = clave
    devolucion.fecha_recogida = datetime.now()
    devolucion.recogida_estado = "Recogida"

    # La cantidad exacta de unidades o metros regresa al inventario.
    producto_devuelto, stock_reintegrado_info = _reintegrar_stock_recogida(db, devolucion)
    db.commit()

    # Avanza el pipeline y notifica los cambios al cliente.
    _avanzar_solicitud_tras_recogida(db, devolucion)

    cliente = db.query(Cliente).filter(Cliente.id_cliente == devolucion.id_cliente_d).first()
    _notificar_recogida_a_cliente(db, devolucion, cliente)
    _notificar_recogida_a_administradores(db, devolucion, producto_devuelto, cliente)

    return {
        "id_devolucion": devolucion.id_devolucion,
        "recogida_estado": devolucion.recogida_estado,
        "evidencia_recogida_url": _url_evidencia_devolucion(devolucion.id_devolucion, "recogida"),
        "fecha_recogida": devolucion.fecha_recogida.isoformat(),
        "stock_reintegrado": bool(producto_devuelto),
        "cantidad_reintegrada": (
            float(stock_reintegrado_info["cantidad_reintegrada"])
            if stock_reintegrado_info
            else None
        ),
    }


@router.post(
    "/{id_devolucion}/evidencia-cambio",
    responses={
        400: {"description": "Evidencia inválida o entrega no lista"},
        404: {"description": ERROR_DEVOLUCION_NO_ENCONTRADA},
    },
)
async def subir_evidencia_cambio(
    id_devolucion: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """El técnico asignado sube la evidencia fotográfica de la ENTREGA del
    producto de cambio al cliente (resolución 'Cambio'). Al confirmarse se
    guarda la foto en MinIO, la fecha de entrega y se notifica al cliente y
    a los administradores."""
    from app.models.tecnico import Tecnico

    ficha = db.query(Tecnico).filter(Tecnico.id_usuario_t == current_user.id_usuario).first()
    devolucion = (
        db.query(Devolucion)
        .filter(
            Devolucion.id_devolucion == id_devolucion,
            Devolucion.id_tecnico_recogida == (ficha.id_tecnico if ficha else -1),
        )
        .first()
    )
    if not devolucion:
        raise HTTPException(status_code=404, detail=ERROR_DEVOLUCION_NO_ENCONTRADA)
    if devolucion.recogida_estado != "Recogida":
        raise HTTPException(
            status_code=400,
            detail="Primero debes confirmar la recogida del producto original",
        )
    if (devolucion.resolucion or "").lower() != "cambio":
        raise HTTPException(
            status_code=400,
            detail="Esta devolución no tiene resolución de cambio de producto",
        )
    if devolucion.evidencia_cambio:
        raise HTTPException(
            status_code=400, detail="La entrega del producto de cambio ya fue confirmada"
        )

    ext, contenido = await _leer_evidencia_imagen(file, "de la entrega")

    nombre = f"{uuid.uuid4().hex}{ext}"
    clave = minio_service.subir_imagen_privada("recogidas", nombre, contenido)

    devolucion.evidencia_cambio = clave
    devolucion.fecha_entrega_cambio = datetime.now()
    db.commit()

    cliente = db.query(Cliente).filter(Cliente.id_cliente == devolucion.id_cliente_d).first()
    if cliente is not None:
        crear_notificacion(
            db,
            id_usuario=None,
            id_cliente=cliente.id_cliente,
            tipo="entrega",
            titulo=f"Cambio entregado - Devolución #{devolucion.id_devolucion}",
            mensaje=(
                "El técnico entregó tu producto de cambio. ¡Gracias por tu paciencia!"
            ),
        )

    from app.models.user import User as UserModel

    nombre_cliente = (
        f"{cliente.first_name} {cliente.last_name}".strip()
        if cliente is not None
        else "Cliente"
    )
    admins_activos = (
        db.query(UserModel)
        .filter(UserModel.id_rol_u == 1, UserModel.is_active == True)  # noqa: E712
        .all()
    )
    for adm in admins_activos:
        crear_notificacion(
            db,
            id_usuario=adm.id_usuario,
            id_cliente=None,
            tipo="recogida",
            titulo="Producto de cambio entregado",
            mensaje=(
                f"El técnico entregó el producto de cambio de la devolución "
                f"#{devolucion.id_devolucion} a {nombre_cliente} "
                f"(pedido #{devolucion.id_pedido_d})."
            ),
        )

    return {
        "id_devolucion": devolucion.id_devolucion,
        "evidencia_cambio_url": _url_evidencia_devolucion(devolucion.id_devolucion, "cambio"),
        "fecha_entrega_cambio": devolucion.fecha_entrega_cambio.isoformat(),
    }


# Agrupa los campos de ReasignarTecnicoIn: id_tecnico.
class ReasignarTecnicoIn(BaseModel):
    id_tecnico: int


@router.put(
    "/admin/{id_devolucion}/reasignar-tecnico",
    responses={
        400: {"description": "El técnico ya está asignado"},
        403: {"description": "Permisos insuficientes"},
        404: {"description": "Devolución o técnico no encontrado"},
    },
)
def reasignar_tecnico_recogida(
    id_devolucion: int,
    data: ReasignarTecnicoIn,
    admin: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """El administrador cambia el técnico asignado para recoger la devolución
    (por ejemplo, si la cuenta del técnico anterior fue inhabilitada).
    Notifica al nuevo técnico y al cliente."""
    from app.models.tecnico import Tecnico as TecnicoModel
    from app.services.notificaciones import crear_notificacion, programar_correo

    devolucion = (
        db.query(Devolucion).filter(Devolucion.id_devolucion == id_devolucion).first()
    )
    if not devolucion:
        raise HTTPException(status_code=404, detail=ERROR_DEVOLUCION_NO_ENCONTRADA)

    nuevo = (
        db.query(TecnicoModel)
        .join(User, User.id_usuario == TecnicoModel.id_usuario_t)
        .filter(
            TecnicoModel.id_tecnico == data.id_tecnico,
            User.is_active == True,  # noqa: E712
        )
        .first()
    )
    if not nuevo:
        raise HTTPException(status_code=404, detail="Técnico no encontrado o inactivo")

    anterior_id = devolucion.id_tecnico_recogida
    if anterior_id == nuevo.id_tecnico:
        raise HTTPException(status_code=400, detail="Ese técnico ya está asignado")

    devolucion.id_tecnico_recogida = nuevo.id_tecnico
    devolucion.recogida_estado = "Asignada"
    db.commit()

    cliente = db.query(Cliente).filter(Cliente.id_cliente == devolucion.id_cliente_d).first()
    nombre_nuevo = (
        f"{nuevo.usuario.first_name} {nuevo.usuario.last_name}".strip()
        if nuevo.usuario
        else "Técnico"
    )
    direccion = _direccion_o_predeterminada(cliente)

    # Notificar al NUEVO técnico (plataforma + correo).
    if nuevo.usuario:
        crear_notificacion(
            db,
            id_usuario=nuevo.usuario.id_usuario,
            id_cliente=None,
            tipo="recogida",
            titulo="Nueva recogida por devolución reasignada",
            mensaje=(
                f"Te asignaron recoger el producto de la devolución "
                f"#{id_devolucion} en: {direccion}."
            ),
        )
        if nuevo.usuario.email:
            programar_correo(
                nuevo.usuario.email,
                "Recogida por devolución - Neodomus",
                "<div style='font-family:Arial,sans-serif;max-width:560px;margin:auto'>"
                "<h2 style='color:#1f1a12'>Recogida por devolución</h2>"
                f"<p>Hola <strong>{nombre_nuevo}</strong>, se te reasignó la recogida "
                f"de la devolución #{id_devolucion}.</p>"
                f"<p><strong>Dirección:</strong> {direccion}</p></div>",
            )

    # Notificar al CLIENTE sobre el cambio de técnico.
    crear_notificacion(
        db,
        id_usuario=None,
        id_cliente=devolucion.id_cliente_d,
        tipo="recogida",
        titulo="Cambio de técnico para tu devolución",
        mensaje=(
            f"{nombre_nuevo} será el nuevo técnico encargado de recoger tu "
            f"devolución #{id_devolucion}."
        ),
    )

    return {
        "id_devolucion": id_devolucion,
        "id_tecnico_anterior": anterior_id,
        "id_tecnico_nuevo": nuevo.id_tecnico,
        "nombre_tecnico": nombre_nuevo,
        "mensaje": "Técnico reasignado y notificado",
    }


def _crear_reembolso_desde_devolucion(db: Session, devolucion: Devolucion):
    """Al aprobar una devolución con resolución 'Reembolso' registra un
    reembolso PENDIENTE por el valor pagado del producto, para que el
    administrador lo confirme desde la pestaña Reembolsos."""
    from app.models.especializacion import Reembolso
    from app.models.pago import Pago

    existe = (
        db.query(Reembolso)
        .filter(
            Reembolso.id_pedido == devolucion.id_pedido_d,
            Reembolso.estado.in_(("Pendiente", "Procesando", "Reembolsado")),
        )
        .first()
    )
    if existe:
        return None

    # Preferir el subtotal pagado por EL PRODUCTO devuelto.
    monto = 0.0
    detalle = (
        db.query(DetallePedido)
        .filter(
            DetallePedido.id_pedido_d == devolucion.id_pedido_d,
            DetallePedido.id_producto_d == devolucion.id_producto_d,
        )
        .first()
        if devolucion.id_producto_d
        else None
    )
    if detalle and detalle.subtotal_detalle:
        monto = float(detalle.subtotal_detalle)
    pago = (
        db.query(Pago)
        .filter(Pago.id_pedido == devolucion.id_pedido_d)
        .order_by(Pago.id_pago.desc())
        .first()
    )
    if monto <= 0:
        monto = float(pago.monto or 0) if pago else 0.0
    if monto <= 0:
        return None

    reembolso = Reembolso(
        id_cita=None,
        id_pedido=devolucion.id_pedido_d,
        monto=round(monto, 2),
        estado="Pendiente",
        motivo=f"Devolución #{devolucion.id_devolucion} aprobada",
        numero_transaccion_original=(pago.numero_transaccion if pago else None),
    )
    db.add(reembolso)
    db.flush()
    return reembolso


# Agrupa los campos de EstadoDevolucionUpdate: estado, resolucion.
class EstadoDevolucionUpdate(BaseModel):
    estado: str
    resolucion: Optional[str] = None


def _normalizar_estado_resolucion(data: EstadoDevolucionUpdate) -> tuple[str, Optional[str]]:
    estado = data.estado.strip().capitalize()
    if estado not in ("Aprobada", "Rechazada"):
        raise HTTPException(status_code=400, detail="Estado no válido (Aprobada / Rechazada)")

    resolucion = data.resolucion.strip().capitalize() if data.resolucion else None
    if estado == "Aprobada" and resolucion not in ("Reembolso", "Cambio"):
        raise HTTPException(
            status_code=400,
            detail="Debes indicar la resolución: Reembolso o Cambio",
        )
    if estado == "Rechazada":
        resolucion = None
    return estado, resolucion


def _resolver_solicitud_vinculada(
    db: Session,
    devolucion: Devolucion,
    estado: str,
    resolucion: Optional[str],
    admin: User,
) -> Optional[dict]:
    if not devolucion.id_solicitud_dv:
        return None
    solicitud = (
        db.query(SolicitudDevolucion)
        .filter(SolicitudDevolucion.id_solicitud == devolucion.id_solicitud_dv)
        .first()
    )
    if solicitud is None or solicitud.estado not in (
        dv_service.EST_SOLICITADA,
        dv_service.EST_EN_REVISION,
    ):
        return None

    estado_solicitud = (
        dv_service.EST_APROBADA if estado == "Aprobada" else dv_service.EST_RECHAZADA
    )
    motivo_rechazo = (
        resolucion if estado == "Rechazada" and resolucion else None
    ) or "No cumple con las políticas de devolución"
    try:
        solicitud, _ = dv_service.cambiar_estado(
            db,
            solicitud,
            estado_solicitud,
            resolucion=resolucion,
            motivo_rechazo=motivo_rechazo,
            admin_id=admin.id_usuario,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    cliente = db.query(Cliente).filter(Cliente.id_cliente == solicitud.id_cliente_s).first()
    if cliente:
        notificar_devolucion_cliente(
            db,
            cliente.id_cliente,
            cliente.email,
            f"{cliente.first_name} {cliente.last_name}".strip() or "Cliente",
            numero=solicitud.numero,
            pedido_id=solicitud.id_pedido_s or 0,
            evento="aprobada" if estado == "Aprobada" else "rechazada",
            monto=float(solicitud.monto_total or 0),
            motivo_rechazo=solicitud.motivo_rechazo,
        )
    return {
        "id_devolucion": devolucion.id_devolucion,
        "estado": estado,
        "resolucion": solicitud.resolucion if estado == "Aprobada" else None,
        "id_solicitud": solicitud.id_solicitud,
        "solicitud_estado": solicitud.estado,
    }


def _mensaje_resolucion_devolucion(devolucion: Devolucion, estado: str, resolucion: Optional[str]) -> str:
    if estado == "Rechazada":
        return (
            f"Tu solicitud de devolución #{devolucion.id_devolucion} fue rechazada "
            "por el equipo de Neodomus."
        )
    if resolucion == "Reembolso":
        return (
            f"Tu solicitud de devolución #{devolucion.id_devolucion} fue aprobada. "
            "Se devolverá el dinero de tu producto por el mismo medio de pago."
        )
    return (
        f"Tu solicitud de devolución #{devolucion.id_devolucion} fue aprobada. "
        "Coordinaremos el envío de tu producto de cambio."
    )


@router.put(
    "/{id_devolucion}/estado",
    responses={
        400: {"description": "Estado o resolución inválidos"},
        403: {"description": "Permisos insuficientes"},
        404: {"description": ERROR_DEVOLUCION_NO_ENCONTRADA},
    },
)
def resolver_devolucion(
    id_devolucion: int,
    data: EstadoDevolucionUpdate,
    admin: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Aprueba o rechaza una solicitud de devolución (solo administradores).

    Al aprobar se define la resolución: 'Reembolso' (devolver el dinero)
    o 'Cambio' (enviar un producto de reemplazo).
    Si la línea pertenece a una solicitud del nuevo pipeline, la decisión
    se aplica a TODA la solicitud para mantener un único historial.
    """
    estado, resolucion = _normalizar_estado_resolucion(data)

    devolucion = (
        db.query(Devolucion).filter(Devolucion.id_devolucion == id_devolucion).first()
    )
    if not devolucion:
        raise HTTPException(status_code=404, detail=ERROR_DEVOLUCION_NO_ENCONTRADA)

    respuesta_solicitud = _resolver_solicitud_vinculada(
        db, devolucion, estado, resolucion, admin
    )
    if respuesta_solicitud is not None:
        return respuesta_solicitud

    if devolucion.estado != "Pendiente":
        raise HTTPException(status_code=400, detail="Esta devolución ya fue resuelta")

    devolucion.estado = estado
    devolucion.resolucion = resolucion
    devolucion.resuelta_por = admin.id_usuario
    devolucion.resuelta_at = datetime.now()

    # NOTA: el producto NO vuelve al inventario aquí; entra cuando el técnico
    # confirma la recogida física con evidencia (endpoint evidencia-recogida).

    from app.services.notificaciones import crear_notificacion

    crear_notificacion(
        db,
        id_usuario=None,
        id_cliente=devolucion.id_cliente_d,
        tipo="entrega",
        titulo=f"Devolución {estado.lower()}",
        mensaje=_mensaje_resolucion_devolucion(devolucion, estado, resolucion),
    )

    # Aprobada como Reembolso → registrar el reembolso pendiente del dinero.
    if estado == "Aprobada" and resolucion == "Reembolso":
        _crear_reembolso_desde_devolucion(db, devolucion)

    db.commit()
    return {
        "id_devolucion": devolucion.id_devolucion,
        "estado": devolucion.estado,
        "resolucion": devolucion.resolucion,
    }
