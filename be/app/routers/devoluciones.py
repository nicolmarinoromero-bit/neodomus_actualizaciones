"""Devoluciones de productos solicitadas por el cliente.

Flujo:
  - El cliente pide la devolución de un producto entregado desde la
    calificación del pedido (botón "Solicitar devolución").
  - Los administradores reciben una notificación y pueden aprobarla o
    rechazarla.

Estados: Pendiente → Aprobada | Rechazada.
"""
from datetime import datetime
from typing import List, Optional

import random

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.cliente import Cliente
from app.models.devolucion import Devolucion
from app.models.pedido import DetallePedido, Pedido
from app.models.producto import Producto
from app.models.roles_usuario import RolesUsuario
from app.models.user import User
from app.services.notificaciones import notificar_admin_devolucion_solicitada
from app.utils.security import get_current_client, get_current_employee

router = APIRouter(prefix="/devoluciones", tags=["Devoluciones"])


def _admin(
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> User:
    role = db.execute(
        select(RolesUsuario.nombre_rol).where(RolesUsuario.id_rol == current_user.id_rol_u)
    ).scalar_one_or_none()
    if role not in ("admin", "administrador"):
        raise HTTPException(status_code=403, detail="Permisos insuficientes")
    return current_user


class DevolucionCreate(BaseModel):
    id_pedido: int
    id_producto: int = Field(gt=0)
    motivo: Optional[str] = None
    preferencia: Optional[str] = None  # 'producto' | 'dinero'


def _serializar_devolucion(d: Devolucion, cliente=None, producto=None) -> dict:
    return {
        "id_devolucion": d.id_devolucion,
        "id_pedido": d.id_pedido_d,
        "id_producto": d.id_producto_d,
        "producto": (
            producto.nombre_producto
            if producto is not None
            else (f"Producto #{d.id_producto_d}" if d.id_producto_d else None)
        ),
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


@router.post("")
def solicitar_devolucion(
    data: DevolucionCreate,
    client: Cliente = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """El cliente solicita la devolución de un producto de un pedido entregado."""
    pedido = (
        db.query(Pedido)
        .filter(Pedido.id_pedido == data.id_pedido, Pedido.id_cliente_pe == client.id_cliente)
        .first()
    )
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if pedido.estado_entrega != "Entregado":
        raise HTTPException(
            status_code=400,
            detail="Solo puedes solicitar la devolución de productos de pedidos ya entregados",
        )

    detalle = (
        db.query(DetallePedido)
        .filter(
            DetallePedido.id_pedido_d == pedido.id_pedido,
            DetallePedido.id_producto_d == data.id_producto,
        )
        .first()
    )
    if not detalle:
        raise HTTPException(
            status_code=400, detail="Ese producto no pertenece a este pedido"
        )

    existente = (
        db.query(Devolucion)
        .filter(
            Devolucion.id_cliente_d == client.id_cliente,
            Devolucion.id_pedido_d == pedido.id_pedido,
            Devolucion.id_producto_d == data.id_producto,
            Devolucion.estado.in_(("Pendiente", "Aprobada")),
        )
        .first()
    )
    if existente:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Ya existe una solicitud de devolución {existente.estado.lower()} para este producto"
            ),
        )

    devolucion = Devolucion(
        id_cliente_d=client.id_cliente,
        id_pedido_d=pedido.id_pedido,
        id_producto_d=data.id_producto,
        motivo=(data.motivo or "").strip() or None,
        estado="Pendiente",
        preferencia=(
            data.preferencia.strip().lower()
            if (data.preferencia or "").strip().lower() in ("producto", "dinero")
            else None
        ),
    )
    db.add(devolucion)
    db.flush()

    # Asignar un técnico ALEATORIO para que vaya a recoger el producto.
    from app.models.tecnico import Tecnico as TecnicoModel

    tecnicos_activos = (
        db.query(TecnicoModel)
        .join(User, User.id_usuario == TecnicoModel.id_usuario_t)
        .filter(User.is_active == True, User.id_rol_u == 2)  # noqa: E712
        .all()
    )
    tecnico_recogida = random.choice(tecnicos_activos) if tecnicos_activos else None
    if tecnico_recogida is not None:
        devolucion.id_tecnico_recogida = tecnico_recogida.id_tecnico
        devolucion.recogida_estado = "Asignada"
    db.commit()
    db.refresh(devolucion)

    producto = (
        db.query(Producto).filter(Producto.id_producto == data.id_producto).first()
    )
    nombre_producto = (
        detalle.descripcion_detalle
        or (producto.nombre_producto if producto else None)
        or f"Producto #{data.id_producto}"
    )
    notificar_admin_devolucion_solicitada(
        db,
        pedido.id_pedido,
        f"{client.first_name} {client.last_name}".strip() or "Cliente",
        nombre_producto,
        devolucion.motivo,
    )

    # ── Notificar al técnico de recogida y al cliente ────────────
    if tecnico_recogida is not None:
        from app.services.notificaciones import crear_notificacion, programar_correo

        direccion_cliente = (client.address or "").strip() or "Por definir"
        nombre_tecnico = (
            f"{tecnico_recogida.usuario.first_name} {tecnico_recogida.usuario.last_name}".strip()
            if tecnico_recogida.usuario
            else "Técnico"
        )
        direccion_cliente = (cliente_direccion or "").strip() or "Por definir"

        # Técnico: plataforma + correo con la dirección.
        if tecnico_recogida.usuario:
            crear_notificacion(
                db,
                id_usuario=tecnico_recogida.usuario.id_usuario,
                id_cliente=None,
                tipo="recogida",
                titulo="Recogida por devolución asignada",
                mensaje=(
                    f"Debes recoger el producto '{nombre_producto}' del pedido "
                    f"#{pedido.id_pedido} en: {direccion_cliente}."
                ),
            )
            if tecnico_recogida.usuario.email:
                programar_correo(
                    tecnico_recogida.usuario.email,
                    "Recogida por devolución asignada - Neodomus",
                    "<div style='font-family:Arial,sans-serif;max-width:560px;margin:auto'>"
                    "<h2 style='color:#1f1a12'>Recogida asignada</h2>"
                    f"<p>Hola <strong>{nombre_tecnico}</strong>, te asignamos recoger el "
                    f"<strong>{nombre_producto}</strong> del pedido #{pedido.id_pedido}.</p>"
                    f"<p><strong>Dirección:</strong> {direccion_cliente}<br/>"
                    f"<strong>Cliente:</strong> {client.first_name} {client.last_name}</p>"
                    "</div>",
                )

        # Cliente: plataforma.
        crear_notificacion(
            db,
            id_usuario=None,
            id_cliente=client.id_cliente,
            tipo="recogida",
            titulo="Técnico asignado para tu devolución",
            mensaje=(
                f"{nombre_tecnico} pasará a recoger el producto '{nombre_producto}' "
                f"de tu pedido #{pedido.id_pedido}."
            ),
        )

    return _serializar_devolucion(devolucion, producto=producto)


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


@router.get("")
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
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Devoluciones donde el técnico autenticado fue asignado a recoger
    el producto del cliente."""
    from app.models.tecnico import Tecnico

    ficha = db.query(Tecnico).filter(Tecnico.id_usuario_t == current_user.id_usuario).first()
    if not ficha:
        return []

    filas = (
        db.query(Devolucion)
        .filter(
            Devolucion.id_tecnico_recogida == ficha.id_tecnico,
            Devolucion.recogida_estado.in_(("Asignada", "Recogida")),
        )
        .order_by(Devolucion.created_at.desc())
        .all()
    )

    resultado = []
    for d in filas:
        cliente = db.query(Cliente).filter(Cliente.id_cliente == d.id_cliente_d).first()
        pedido = db.query(Pedido).filter(Pedido.id_pedido == d.id_pedido_d).first()
        producto = (
            db.query(Producto).filter(Producto.id_producto == d.id_producto_d).first()
            if d.id_producto_d
            else None
        )
        resultado.append({
            "id_devolucion": d.id_devolucion,
            "id_pedido": d.id_pedido_d,
            "producto": (
                producto.nombre_producto if producto else f"Producto #{d.id_producto_d}"
            ),
            "cliente": (
                f"{cliente.first_name} {cliente.last_name}".strip() if cliente else "Cliente"
            ),
            "direccion": (cliente.address or "").strip() if cliente else "Por definir",
            "telefono": cliente.telefono_cliente if cliente else None,
            "estado_devolucion": d.estado,
            "preferencia": d.preferencia or "dinero",
            "recogida_estado": d.recogida_estado,
            "motivo": d.motivo,
        })
    return resultado


class RecogidaUpdate(BaseModel):
    recogida: bool = True


@router.put("/{id_devolucion}/recogida")
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


class ReasignarTecnicoIn(BaseModel):
    id_tecnico: int


@router.put("/admin/{id_devolucion}/reasignar-tecnico")
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
        raise HTTPException(status_code=404, detail="Devolución no encontrada")

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
    nombre_cliente = (
        f"{cliente.first_name} {cliente.last_name}".strip() if cliente else "Cliente"
    )
    nombre_nuevo = (
        f"{nuevo.usuario.first_name} {nuevo.usuario.last_name}".strip()
        if nuevo.usuario
        else "Técnico"
    )
    direccion = ((cliente.address or "").strip() if cliente else "") or "Por definir"

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


class EstadoDevolucionUpdate(BaseModel):
    estado: str
    resolucion: Optional[str] = None


@router.put("/{id_devolucion}/estado")
def resolver_devolucion(
    id_devolucion: int,
    data: EstadoDevolucionUpdate,
    admin: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Aprueba o rechaza una solicitud de devolución (solo administradores).

    Al aprobar se define la resolución: 'Reembolso' (devolver el dinero)
    o 'Cambio' (enviar un producto de reemplazo).
    """
    estado = data.estado.strip().capitalize()
    if estado not in ("Aprobada", "Rechazada"):
        raise HTTPException(status_code=400, detail="Estado no válido (Aprobada / Rechazada)")

    resolucion = data.resolucion.strip().capitalize() if data.resolucion else None
    if estado == "Aprobada":
        if resolucion not in ("Reembolso", "Cambio"):
            raise HTTPException(
                status_code=400,
                detail="Debes indicar la resolución: Reembolso o Cambio",
            )
    else:
        resolucion = None

    devolucion = (
        db.query(Devolucion).filter(Devolucion.id_devolucion == id_devolucion).first()
    )
    if not devolucion:
        raise HTTPException(status_code=404, detail="Devolución no encontrada")
    if devolucion.estado != "Pendiente":
        raise HTTPException(status_code=400, detail="Esta devolución ya fue resuelta")

    devolucion.estado = estado
    devolucion.resolucion = resolucion
    devolucion.resuelta_por = admin.id_usuario
    devolucion.resuelta_at = datetime.now()

    # Al aprobar, el producto vuelve al inventario (1 unidad por solicitud;
    # el modelo no registra cantidad ni variante).
    if estado == "Aprobada" and devolucion.id_producto_d:
        producto_devuelto = (
            db.query(Producto).filter(Producto.id_producto == devolucion.id_producto_d).first()
        )
        if producto_devuelto:
            producto_devuelto.stock_producto = (producto_devuelto.stock_producto or 0) + 1

    from app.services.notificaciones import crear_notificacion

    if estado == "Aprobada" and resolucion == "Reembolso":
        mensaje = (
            f"Tu solicitud de devolución #{devolucion.id_devolucion} fue aprobada. "
            "Se devolverá el dinero de tu producto por el mismo medio de pago."
        )
    elif estado == "Aprobada":
        mensaje = (
            f"Tu solicitud de devolución #{devolucion.id_devolucion} fue aprobada. "
            "Coordinaremos el envío de tu producto de cambio."
        )
    else:
        mensaje = (
            f"Tu solicitud de devolución #{devolucion.id_devolucion} fue rechazada "
            "por el equipo de Neodomus."
        )

    crear_notificacion(
        db,
        id_usuario=None,
        id_cliente=devolucion.id_cliente_d,
        tipo="entrega",
        titulo=f"Devolución {estado.lower()}",
        mensaje=mensaje,
    )
    db.commit()
    return {
        "id_devolucion": devolucion.id_devolucion,
        "estado": devolucion.estado,
        "resolucion": devolucion.resolucion,
    }
