from typing import List, Optional
from datetime import date, datetime, timedelta
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tecnico import Tecnico
from app.models.cliente import Cliente
from app.models.roles_usuario import RolesUsuario
from app.models.user import User
from app.models.cita import Cita
from app.models.cita_producto import CitaProducto
from app.models.producto import Producto
from app.models.producto_variante import ProductoVariante
from app.models.otros import Comision
from app.models.calificacion import Calificacion
from app.models.evidencia import Evidencia
from app.models.pedido import Pedido, DetallePedido
from app.services.especialidades import (
    _dia_es_laboral,
    horas_laborales,
    slot_tomado,
    tecnico_ocupado,
)
from app.services.notificaciones import notificar_cita_reasignada_cliente
from app.utils.security import get_current_employee

ESTADOS_CITA = ("Pendiente", "Confirmada", "Finalizada", "Cancelada")

ESTADOS_ID = {1: "Pendiente", 2: "Confirmada", 3: "Finalizada", 4: "Cancelada"}

EVIDENCIAS_DIR = Path(__file__).resolve().parent.parent / "static" / "evidencias"

EXTENSIONES_EVIDENCIA = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

router = APIRouter(prefix="/tecnicos", tags=["Técnicos"])


class TecnicoAdminResponse(BaseModel):
    id_tecnico: int
    id_usuario: int
    first_name: str
    last_name: str
    email: str
    telefono_usuario: int | None = None
    documento_usuario: int | None = None
    certificacion_t: str | None = None
    cargo_t: str | None = None
    is_active: bool
    desactivado_hasta: datetime | None = None
    created_at: datetime | None = None
    password_reset_required: bool = False
    servicios: list[str] = []


class TecnicoUpdate(BaseModel):
    certificacion: str | None = None
    cargo: str | None = None


class EstadoCitaUpdate(BaseModel):
    estado: str | None = None
    estado_id: int | None = None


class TecnicoCitaResponse(BaseModel):
    id_cita: int
    fecha: date
    hora: str
    estado: str
    tipo_servicio: str
    cliente: str
    telefono: int | None = None
    email: str | None = None
    documento_tipo: str | None = None
    documento_numero: int | None = None
    direccion: str
    descripcion: str | None = None
    id_tecnico: int | None = None
    nombre_tecnico: str | None = None
    id_tecnico_2: int | None = None
    nombre_tecnico_2: str | None = None
    costo_cita: float | None = None
    id_comision_c: int | None = None
    comision_porcentaje: float | None = None
    comision_valor: float | None = None
    evidencias: list[dict] = []
    calificacion: dict | None = None
    cliente_info: dict | None = None
    productos: list[dict] = []


class TecnicoClienteResponse(BaseModel):
    id_cliente: int
    nombre: str
    email: str | None = None
    telefono: int | None = None
    direccion: str | None = None
    citas_count: int


class ComisionTecnicoResponse(BaseModel):
    id_cita: int
    fecha: date
    hora: str
    tipo_servicio: str
    cliente_nombre: str
    costo_cita: float | None = None
    estado_pago: str | None = None


class ReagendarCitaRequest(BaseModel):
    fecha: date
    hora: str
    metodo_pago: str | None = None
    id_comision: int
    porcentaje_comision: float | None = None
    valor_comision: float | None = None


class TecnicoPublicoResponse(BaseModel):
    id_tecnico: int
    first_name: str
    last_name: str
    certificacion_t: str | None = None
    cargo_t: str | None = None
    is_active: bool
    disponible: bool = True
    telefono: int | None = None
    foto_url: str | None = None
    calificacion: float | None = None


def _serializar_publico(db: Session, t: Tecnico) -> TecnicoPublicoResponse:
    u = t.usuario
    promedio = (
        db.query(func.avg(Calificacion.calificacion))
        .filter(Calificacion.id_tecnico_c == t.id_tecnico)
        .scalar()
    )
    return TecnicoPublicoResponse(
        id_tecnico=t.id_tecnico,
        first_name=u.first_name if u else "",
        last_name=u.last_name if u else "",
        certificacion_t=t.certificacion_t,
        cargo_t=t.cargo_t,
        is_active=u.is_active if u else False,
        disponible=bool(u and u.is_active),
        telefono=u.telefono_usuario if u else None,
        foto_url=u.foto_url if u else None,
        calificacion=round(float(promedio), 2) if promedio is not None else None,
    )


def _admin(
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> User:
    role = db.execute(select(RolesUsuario.nombre_rol).where(RolesUsuario.id_rol == current_user.id_rol_u)).scalar_one_or_none()
    if role not in ("admin", "administrador"):
        raise HTTPException(status_code=403, detail="Permisos insuficientes")
    return current_user


def _serializar(t: Tecnico) -> TecnicoAdminResponse:
    u = t.usuario
    return TecnicoAdminResponse(
        id_tecnico=t.id_tecnico,
        id_usuario=u.id_usuario if u else 0,
        first_name=u.first_name if u else "",
        last_name=u.last_name if u else "",
        email=u.email if u else "",
        telefono_usuario=u.telefono_usuario if u else None,
        documento_usuario=u.documento_usuario if u else None,
        certificacion_t=t.certificacion_t,
        cargo_t=t.cargo_t,
        is_active=u.is_active if u else False,
        desactivado_hasta=u.desactivado_hasta if u else None,
        created_at=u.created_at if u else None,
        password_reset_required=bool(u.password_reset_required) if u else False,
        servicios=[],
    )


@router.get("/publicos", response_model=List[TecnicoPublicoResponse])
def listar_tecnicos_publicos(
    db: Session = Depends(get_db),
    tipo_servicio: Optional[str] = None,
    fecha: Optional[date] = None,
    hora: Optional[str] = None,
):
    """Lista los técnicos reales del sistema (acceso público, solo datos básicos).

    Usado por las páginas de cliente para agendar citas con técnicos reales.
    No se filtra por especialidad: cualquier técnico atiende cualquier servicio.

    Filtros opcionales:
    - fecha + hora: marca `disponible=False` a los técnicos ocupados con una
      cita activa en ese horario.
    """
    tecnicos = (
        db.query(Tecnico)
        .join(User, User.id_usuario == Tecnico.id_usuario_t)
        .filter(User.id_rol_u == 2)
        .order_by(Tecnico.id_tecnico.asc())
        .all()
    )
    resultado: list[TecnicoPublicoResponse] = []
    for t in tecnicos:
        item = _serializar_publico(db, t)
        if fecha is not None and hora is not None:
            ocupado = tecnico_ocupado(db, t.id_tecnico, fecha, hora)
            item.disponible = item.is_active and not ocupado
        resultado.append(item)
    return resultado


@router.get("", response_model=List[TecnicoAdminResponse])
def listar_tecnicos(
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Lista los técnicos reales registrados en el sistema (solo admin)"""
    tecnicos = (
        db.query(Tecnico)
        .join(User, User.id_usuario == Tecnico.id_usuario_t)
        .filter(User.id_rol_u == 2)
        .order_by(Tecnico.id_tecnico.asc())
        .all()
    )
    return [_serializar(t) for t in tecnicos]


@router.get("/unassigned", response_model=List[int])
def listar_usuarios_tecnicos_sin_ficha_admin(
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Ids de usuarios con rol técnico que aún no tienen ficha en la tabla tecnicos"""
    ficha_ids = [t.id_usuario_t for t in db.query(Tecnico).all()]
    usuarios_tecnicos = (
        db.query(User.id_usuario)
        .filter(User.id_rol_u == 2, User.is_active == True)  # noqa: E712
        .all()
    )
    return [u[0] for u in usuarios_tecnicos if u[0] not in ficha_ids]


@router.put("/{tecnico_id}", response_model=TecnicoAdminResponse)
def actualizar_tecnico(
    tecnico_id: int,
    data: TecnicoUpdate,
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Actualiza la ficha técnica (especialidad y cargo) de un técnico (solo admin)"""
    tecnico = db.query(Tecnico).filter(Tecnico.id_tecnico == tecnico_id).first()
    if not tecnico:
        raise HTTPException(status_code=404, detail="Técnico no encontrado")
    if data.certificacion is not None:
        tecnico.certificacion_t = data.certificacion
    if data.cargo is not None:
        tecnico.cargo_t = data.cargo
    db.commit()
    db.refresh(tecnico)
    return _serializar(tecnico)


@router.delete("/{tecnico_id}", response_model=dict)
def eliminar_tecnico(
    tecnico_id: int,
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Elimina la ficha técnica de un usuario (solo admin)"""
    tecnico = db.query(Tecnico).filter(Tecnico.id_tecnico == tecnico_id).first()
    if not tecnico:
        raise HTTPException(status_code=404, detail="Técnico no encontrado")
    db.delete(tecnico)
    db.commit()
    return {"msg": "Ficha de técnico eliminada", "id": tecnico_id}


def _ficha_tecnico_actual(db: Session, current_user: User) -> Tecnico:
    """Ficha del técnico autenticado (o error 404 si no tiene ficha)"""
    tecnico = (
        db.query(Tecnico)
        .filter(Tecnico.id_usuario_t == current_user.id_usuario)
        .first()
    )
    if not tecnico:
        raise HTTPException(
            status_code=404,
            detail="No hay ficha de técnico asociada a tu cuenta",
        )
    return tecnico


def _serializar_cita_tecnico(db: Session, cita: Cita) -> TecnicoCitaResponse:
    """Serializa una cita con los datos completos del cliente asociado
    y los productos vinculados a la cita."""
    cliente = (
        db.query(Cliente).filter(Cliente.id_cliente == cita.id_cliente).first()
    )
    documento_tipo = None
    if cliente and cliente.id_tipo_documento_c:
        from app.models.otros import TipoDocumento

        td = (
            db.query(TipoDocumento)
            .filter(TipoDocumento.id_tipo_documento == cliente.id_tipo_documento_c)
            .first()
        )
        documento_tipo = td.nombre_tipo if td else None
    id_comision = None
    com_porcentaje = None
    com_valor = None
    if cita.id_comision_c is not None:
        com = (
            db.query(Comision)
            .filter(Comision.id_comision == cita.id_comision_c)
            .first()
        )
        if com:
            id_comision = com.id_comision
            com_porcentaje = (
                float(com.porcentaje_comision)
                if com.porcentaje_comision is not None
                else None
            )
            com_valor = (
                float(com.valor_comision) if com.valor_comision is not None else None
            )

    cliente_info = None
    if cliente:
        cliente_info = {
            "id_cliente": cliente.id_cliente,
            "nombre": f"{cliente.first_name} {cliente.last_name}".strip(),
            "email": cliente.email,
            "telefono": cliente.telefono_cliente,
            "direccion": cliente.address,
            "documento_tipo": documento_tipo,
            "documento_numero": cliente.documento_cliente,
        }

    productos = _productos_cita(db, cita.id_cita)

    return TecnicoCitaResponse(
        id_cita=cita.id_cita,
        fecha=cita.fecha,
        hora=cita.hora,
        estado=cita.estado,
        tipo_servicio=cita.tipo_servicio,
        cliente=f"{cliente.first_name} {cliente.last_name}".strip() if cliente else "Cliente",
        telefono=cliente.telefono_cliente if cliente else None,
        email=cliente.email if cliente else None,
        documento_tipo=documento_tipo,
        documento_numero=cliente.documento_cliente if cliente else None,
        direccion=cita.direccion,
        descripcion=cita.descripcion,
        id_tecnico=cita.id_tecnico,
        nombre_tecnico=cita.nombre_tecnico,
        id_tecnico_2=cita.id_tecnico_2,
        nombre_tecnico_2=cita.nombre_tecnico_2,
        costo_cita=float(cita.costo_cita) if cita.costo_cita is not None else None,
        id_comision_c=id_comision,
        comision_porcentaje=com_porcentaje,
        comision_valor=com_valor,
        evidencias=_serializar_evidencias(db, cita.id_cita),
        calificacion=_calificacion_cita(db, cita),
        cliente_info=cliente_info,
        productos=productos,
    )


def _serializar_evidencias(db: Session, id_cita: int) -> list[dict]:
    """Evidencias subidas para la cita, más recientes primero."""
    filas = (
        db.query(Evidencia)
        .filter(Evidencia.id_cita == id_cita)
        .order_by(Evidencia.id_evidencia.desc())
        .all()
    )
    return [
        {
            "id_evidencia": e.id_evidencia,
            "url": f"/evidencias/{e.url_archivo}",
            "descripcion": e.descripcion,
            "fecha_subida": e.fecha_subida.isoformat() if e.fecha_subida else None,
        }
        for e in filas
    ]


def _calificacion_cita(db: Session, cita: Cita) -> dict | None:
    """Calificación recibida por el técnico para esta cita (si existe)."""
    cal = (
        db.query(Calificacion)
        .filter(Calificacion.id_cita_c == cita.id_cita)
        .first()
    )
    if not cal:
        return None
    return {
        "calificacion": cal.calificacion,
        "comentario": cal.comentario,
        "fecha": cal.created_at.isoformat() if cal.created_at else None,
    }


def _productos_cita(db: Session, id_cita: int) -> list[dict]:
    """Productos asociados a la cita con información detallada."""
    filas = (
        db.query(CitaProducto)
        .filter(CitaProducto.id_cita == id_cita)
        .all()
    )
    if not filas:
        return []
    resultado = []
    for cp in filas:
        producto = db.query(Producto).filter(Producto.id_producto == cp.id_producto).first()
        if not producto:
            continue
        variante = None
        if cp.id_variante:
            v = db.query(ProductoVariante).filter(ProductoVariante.id == cp.id_variante).first()
            if v:
                variante = {
                    "nombre": v.nombre,
                    "hex": v.hex,
                    "tamaño": v.tamaño,
                    "imagen_url": v.imagen_url,
                }
        resultado.append({
            "id_producto": producto.id_producto,
            "nombre": producto.nombre_producto,
            "marca": producto.marca,
            "referencia": producto.referencia_producto,
            "precio_venta": float(producto.precio_venta_producto) if producto.precio_venta_producto else None,
            "imagen_url": producto.imagen_url,
            "variante": variante,
            "cantidad": cp.cantidad,
            "notas": cp.notas,
        })
    return resultado


@router.get("/mis-clientes", response_model=List[TecnicoClienteResponse])
def mis_clientes_tecnico(
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    """Clientes con los que el técnico autenticado tiene (o tuvo) citas,
    ordenados alfabéticamente, con el número de citas por cliente.

    Filtros opcionales:
    - q: busca por nombre, apellido o email (case-insensitive).
    - skip / limit: paginación.
    """
    tecnico = _ficha_tecnico_actual(db, current_user)
    filas = (
        db.query(Cita.id_cliente, func.count(Cita.id_cita))
        .filter(Cita.id_tecnico == tecnico.id_tecnico)
        .group_by(Cita.id_cliente)
        .all()
    )
    if not filas:
        return []
    ids = [fila[0] for fila in filas]
    clientes_query = db.query(Cliente).filter(Cliente.id_cliente.in_(ids))
    if q:
        patron = f"%{q}%"
        clientes_query = clientes_query.filter(
            (Cliente.first_name.ilike(patron))
            | (Cliente.last_name.ilike(patron))
            | (Cliente.email.ilike(patron))
        )
    clientes = {c.id_cliente: c for c in clientes_query.all()}
    citas_por_cliente = dict(filas)
    resultado: list[TecnicoClienteResponse] = []
    for id_cliente, cantidad in filas:
        c = clientes.get(id_cliente)
        if not c:
            continue
        resultado.append(
            TecnicoClienteResponse(
                id_cliente=c.id_cliente,
                nombre=f"{c.first_name} {c.last_name}".strip() or "Cliente",
                email=c.email,
                telefono=c.telefono_cliente,
                direccion=c.address,
                citas_count=citas_por_cliente.get(id_cliente, cantidad),
            )
        )
    resultado.sort(key=lambda r: r.nombre.lower())
    return resultado[skip : skip + limit]


@router.get("/clientes/{cliente_id}/citas", response_model=List[TecnicoCitaResponse])
def citas_cliente_tecnico(
    cliente_id: int,
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Citas de un cliente específico asignadas al técnico autenticado,
    ordenadas por fecha y hora descendente (más recientes primero).
    Incluye las evidencias de cada cita."""
    tecnico = _ficha_tecnico_actual(db, current_user)
    cliente = db.query(Cliente).filter(Cliente.id_cliente == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    citas = (
        db.query(Cita)
        .filter(
            or_(
                Cita.id_tecnico == tecnico.id_tecnico,
                Cita.id_tecnico_2 == tecnico.id_tecnico,
            ),
            Cita.id_cliente == cliente_id,
        )
        .order_by(Cita.fecha.desc(), Cita.hora.desc())
        .all()
    )
    return [_serializar_cita_tecnico(db, cita) for cita in citas]


@router.get("/comisiones", response_model=List[ComisionTecnicoResponse])
def comisiones_tecnico(
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Comisiones ganadas por el técnico autenticado.

    Devuelve todas las citas asignadas al técnico que tengan una comisión
    asociada, ordenadas por fecha descendente. Incluye el estado de pago
    de la cita para que el técnico pueda verificar si el cliente ya pagó.
    """
    tecnico = _ficha_tecnico_actual(db, current_user)
    citas = (
        db.query(Cita)
        .filter(
            Cita.id_tecnico == tecnico.id_tecnico,
            Cita.id_comision_c.isnot(None),
        )
        .order_by(Cita.fecha.desc(), Cita.hora.desc())
        .all()
    )
    resultado: list[ComisionTecnicoResponse] = []
    for cita in citas:
        com = db.query(Comision).filter(Comision.id_comision == cita.id_comision_c).first()
        if not com:
            continue
        cliente = db.query(Cliente).filter(Cliente.id_cliente == cita.id_cliente).first()
        cliente_nombre = (
            f"{cliente.first_name} {cliente.last_name}".strip() if cliente else "Cliente"
        )
        resultado.append(
            ComisionTecnicoResponse(
                id_cita=cita.id_cita,
                fecha=cita.fecha,
                hora=cita.hora,
                tipo_servicio=cita.tipo_servicio,
                cliente_nombre=cliente_nombre,
                costo_cita=float(cita.costo_cita) if cita.costo_cita is not None else None,
                estado_pago=cita.estado_pago,
                metodo_pago=cita.metodo_pago,
                id_comision=com.id_comision,
                porcentaje_comision=float(com.porcentaje_comision) if com.porcentaje_comision is not None else None,
                valor_comision=float(com.valor_comision) if com.valor_comision is not None else None,
            )
        )
    return resultado


@router.get("/mis-citas", response_model=List[TecnicoCitaResponse])
def mis_citas_tecnico(
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Citas asignadas al técnico autenticado (como técnico principal o
    segundo técnico), ordenadas por fecha y hora"""
    tecnico = _ficha_tecnico_actual(db, current_user)
    citas = (
        db.query(Cita)
        .filter(
            or_(
                Cita.id_tecnico == tecnico.id_tecnico,
                Cita.id_tecnico_2 == tecnico.id_tecnico,
            )
        )
        .order_by(Cita.fecha.asc(), Cita.hora.asc())
        .all()
    )
    return [_serializar_cita_tecnico(db, cita) for cita in citas]


@router.put("/citas/{cita_id}/estado", response_model=TecnicoCitaResponse)
def actualizar_estado_cita_tecnico(
    cita_id: int,
    data: EstadoCitaUpdate,
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """El técnico actualiza el estado de una cita que le fue asignada.
    Las citas se crean ya Confirmadas y el técnico solo puede marcarlas
    como Finalizada (las anulaciones las maneja el cliente o el admin)."""
    tecnico = _ficha_tecnico_actual(db, current_user)
    cita = (
        db.query(Cita)
        .filter(
            Cita.id_cita == cita_id,
            or_(
                Cita.id_tecnico == tecnico.id_tecnico,
                Cita.id_tecnico_2 == tecnico.id_tecnico,
            ),
        )
        .first()
    )
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if data.estado is not None:
        nuevo_estado = data.estado
    elif data.estado_id is not None:
        nuevo_estado = ESTADOS_ID.get(data.estado_id)
        if nuevo_estado is None:
            raise HTTPException(status_code=400, detail="estado_id no válido")
    else:
        raise HTTPException(status_code=400, detail="Indica un estado válido")
    if nuevo_estado != "Finalizada":
        raise HTTPException(
            status_code=400,
            detail="El técnico solo puede marcar una cita como Finalizada. Los demás cambios los realiza el administrador o el cliente.",
        )
    if cita.estado == "Finalizada":
        raise HTTPException(status_code=400, detail="La cita ya está finalizada")
    # El técnico debe dejar evidencia del trabajo realizado para finalizar.
    tiene_evidencia = (
        db.query(Evidencia)
        .filter(Evidencia.id_cita == cita.id_cita)
        .first()
        is not None
    )
    if not tiene_evidencia:
        raise HTTPException(
            status_code=400,
            detail="Debes subir al menos una evidencia del trabajo realizado antes de finalizar la cita",
        )
    cita.estado = nuevo_estado
    db.commit()
    db.refresh(cita)

    # ── Notificar al cliente por correo Y notificación de plataforma ──
    from app.models.cliente import Cliente
    from app.services.notificaciones import notificar_cita_estado_cliente

    cliente = (
        db.query(Cliente).filter(Cliente.id_cliente == cita.id_cliente).first()
    )
    if cliente and cliente.email:
        nombre_cliente = f"{cliente.first_name} {cliente.last_name}".strip() or "Cliente"
        datos = {
            "servicio": cita.tipo_servicio,
            "fecha": cita.fecha.strftime("%d/%m/%Y"),
            "tecnico": cita.nombre_tecnico or "técnico",
        }
        notificar_cita_estado_cliente(
            db,
            cliente_id=cliente.id_cliente,
            correo=cliente.email,
            cliente_nombre=nombre_cliente,
            datos=datos,
            nuevo_estado=nuevo_estado,
        )

    return _serializar_cita_tecnico(db, cita)


@router.get("/citas/{cita_id}/proxima-fecha", response_model=dict)
def proxima_fecha_tecnico(
    cita_id: int,
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Sugiere la próxima fecha laboral disponible desde mañana en la que el
    técnico autenticado esté libre a la hora de la cita (excluyendo la cita actual)."""
    tecnico = _ficha_tecnico_actual(db, current_user)
    cita = _cita_asignada_a_mi(db, tecnico, cita_id)
    if cita.estado not in ("Pendiente", "Confirmada"):
        raise HTTPException(status_code=400, detail="Solo puedes aplazar una cita pendiente o confirmada")
    dia = max(cita.fecha + timedelta(days=1), date.today())
    for _ in range(45):
        if _dia_es_laboral(dia):
            if not tecnico_ocupado(db, tecnico.id_tecnico, dia, cita.hora, excluir_cita_id=cita.id_cita) \
               and not slot_tomado(db, dia, cita.hora, excluir_cita_id=cita.id_cita):
                u = db.query(User).get(tecnico.usuario.id_usuario) if tecnico.usuario else None
                return {
                    "fecha": dia,
                    "hora": cita.hora,
                    "id_tecnico": tecnico.id_tecnico,
                    "nombre_tecnico": f"{tecnico.usuario.first_name} {tecnico.usuario.last_name}".strip()
                        if tecnico and tecnico.usuario else None,
                }
        dia += timedelta(days=1)
    raise HTTPException(
        status_code=404,
        detail="No se encontró una fecha próxima con el técnico disponible",
    )


@router.get("/citas/{cita_id}/horas-disponibles", response_model=list)
def horas_disponibles_tecnico(
    cita_id: int,
    fecha: date,
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Franjas horarias libres para el técnico en la fecha indicada, excluyendo
    la cita actual. Se usa para sugerir horas al técnico al reagendar."""
    tecnico = _ficha_tecnico_actual(db, current_user)
    cita = _cita_asignada_a_mi(db, tecnico, cita_id)
    return [
        h
        for h in horas_laborales(fecha)
        if not slot_tomado(db, fecha, h, excluir_cita_id=cita.id_cita)
        and not tecnico_ocupado(
            db, tecnico.id_tecnico, fecha, h, excluir_cita_id=cita.id_cita
        )
    ]


@router.put("/citas/{cita_id}/reagendar", response_model=TecnicoCitaResponse)
def reagendar_cita_tecnico(
    cita_id: int,
    data: ReagendarCitaRequest,
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Permite al técnico reagendar una cita (cambiar fecha y hora).
    Se valida disponibilidad del técnico, franja laboral y que la hora no esté
    ocupada por otra cita (excluyendo la actual)."""
    tecnico = _ficha_tecnico_actual(db, current_user)
    cita = _cita_asignada_a_mi(db, tecnico, cita_id)
    if cita.estado not in ("Pendiente", "Confirmada"):
        raise HTTPException(status_code=400, detail="Solo puedes aplazar una cita pendiente o confirmada")
    if data.fecha < date.today():
        raise HTTPException(status_code=400, detail="La fecha no puede ser en el pasado")
    _validar_franja_cita(data.fecha, data.hora)
    if slot_tomado(db, data.fecha, data.hora, excluir_cita_id=cita.id_cita):
        raise HTTPException(status_code=400, detail="Esa fecha y hora ya están reservadas por otra cita")
    if tecnico_ocupado(db, tecnico.id_tecnico, data.fecha, data.hora, excluir_cita_id=cita.id_cita):
        raise HTTPException(status_code=400, detail="No tienes disponibilidad en esa fecha y hora")
    if cita.id_tecnico_2 is not None and tecnico_ocupado(
        db, cita.id_tecnico_2, data.fecha, data.hora, excluir_cita_id=cita.id_cita
    ):
        raise HTTPException(
            status_code=400,
            detail="El segundo técnico no está disponible en esa fecha y hora",
        )
    cita.fecha = data.fecha
    cita.hora = data.hora
    db.commit()
    db.refresh(cita)

    # Notificar al cliente
    cliente = db.query(Cliente).filter(Cliente.id_cliente == cita.id_cliente).first()
    if cliente and cliente.email:
        notificar_cita_reasignada_cliente(
            db,
            cliente_id=cliente.id_cliente,
            correo=cliente.email,
            cliente_nombre=f"{cliente.first_name} {cliente.last_name}".strip() or "Cliente",
            datos={
                "servicio": cita.tipo_servicio,
                "fecha": cita.fecha.strftime("%d/%m/%Y"),
                "hora": cita.hora,
                "tecnico": cita.nombre_tecnico or "técnico",
            },
        )

    return _serializar_cita_tecnico(db, cita)


def _cita_asignada_a_mi(db: Session, tecnico: Tecnico, cita_id: int) -> Cita:
    cita = (
        db.query(Cita)
        .filter(
            Cita.id_cita == cita_id,
            or_(
                Cita.id_tecnico == tecnico.id_tecnico,
                Cita.id_tecnico_2 == tecnico.id_tecnico,
            ),
        )
        .first()
    )
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return cita


@router.post("/citas/{cita_id}/evidencias")
async def subir_evidencia_cita(
    cita_id: int,
    request: Request,
    file: UploadFile = File(...),
    descripcion: str = Form(""),
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """El técnico sube una evidencia (foto) del trabajo realizado en una
    cita asignada. Devuelve la lista actualizada de evidencias."""
    tecnico = _ficha_tecnico_actual(db, current_user)
    cita = _cita_asignada_a_mi(db, tecnico, cita_id)
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Selecciona un archivo de imagen")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in EXTENSIONES_EVIDENCIA:
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
    except Exception:
        raise HTTPException(status_code=400, detail="El archivo no es una imagen válida")
    EVIDENCIAS_DIR.mkdir(parents=True, exist_ok=True)
    nombre = f"{uuid.uuid4().hex}{ext}"
    (EVIDENCIAS_DIR / nombre).write_bytes(contenido)
    db.add(
        Evidencia(
            id_cita=cita.id_cita,
            id_tecnico=tecnico.id_tecnico,
            url_archivo=nombre,
            descripcion=(descripcion or "").strip()[:255] or None,
        )
    )
    db.commit()
    return {"msg": "Evidencia subida correctamente", "evidencias": _serializar_evidencias(db, cita.id_cita)}


@router.delete("/citas/{cita_id}/evidencias/{evidencia_id}")
def eliminar_evidencia_cita(
    cita_id: int,
    evidencia_id: int,
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """El técnico elimina una evidencia propia de la cita."""
    tecnico = _ficha_tecnico_actual(db, current_user)
    _cita_asignada_a_mi(db, tecnico, cita_id)
    evidencia = (
        db.query(Evidencia)
        .filter(
            Evidencia.id_evidencia == evidencia_id,
            Evidencia.id_cita == cita_id,
            Evidencia.id_tecnico == tecnico.id_tecnico,
        )
        .first()
    )
    if not evidencia:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    try:
        (EVIDENCIAS_DIR / evidencia.url_archivo).unlink(missing_ok=True)
    except OSError:
        pass
    db.delete(evidencia)
    db.commit()
    return {"msg": "Evidencia eliminada", "evidencias": _serializar_evidencias(db, cita_id)}


class EntregaTecnicoResponse(BaseModel):
    id_pedido: int
    cliente: str
    telefono: int | None = None
    email: str | None = None
    direccion: str | None = None
    fecha_entrega: date | None = None
    hora_entrega: str | None = None
    estado_entrega: str | None = None
    productos: list[dict] = []


def _serializar_entrega_tecnico(db: Session, pedido: Pedido) -> EntregaTecnicoResponse:
    from app.models.cliente import Cliente

    cliente = (
        db.query(Cliente).filter(Cliente.id_cliente == pedido.id_cliente_pe).first()
    )
    detalles = (
        db.query(DetallePedido)
        .filter(
            DetallePedido.id_pedido_d == pedido.id_pedido,
            DetallePedido.id_producto_d.isnot(None),
        )
        .all()
    )
    return EntregaTecnicoResponse(
        id_pedido=pedido.id_pedido,
        cliente=f"{cliente.first_name} {cliente.last_name}".strip() if cliente else "Cliente",
        telefono=cliente.telefono_cliente if cliente else None,
        email=cliente.email if cliente else None,
        direccion=(cliente.address or "").strip() if cliente else None,
        fecha_entrega=pedido.fecha_entrega,
        hora_entrega=pedido.hora_entrega,
        estado_entrega=pedido.estado_entrega,
        productos=[
            {
                "descripcion": d.descripcion_detalle or f"Producto #{d.id_producto_d}",
                "cantidad": d.cantidad_detalle or 1,
                "subtotal": d.subtotal_detalle or 0,
            }
            for d in detalles
        ],
    )


@router.get("/mis-entregas", response_model=List[EntregaTecnicoResponse])
def mis_entregas_tecnico(
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Pedidos de entrega asignados al técnico autenticado, con productos y
    datos completos del cliente (dirección, teléfono, correo)."""
    tecnico = _ficha_tecnico_actual(db, current_user)
    pedidos = (
        db.query(Pedido)
        .filter(Pedido.id_tecnico_entrega == tecnico.id_tecnico)
        .order_by(Pedido.fecha_entrega.asc(), Pedido.hora_entrega.asc())
        .all()
    )
    return [_serializar_entrega_tecnico(db, p) for p in pedidos]


class EstadoEntregaUpdate(BaseModel):
    estado: str


@router.put("/entregas/{pedido_id}/estado", response_model=EntregaTecnicoResponse)
def actualizar_estado_entrega_tecnico(
    pedido_id: int,
    data: EstadoEntregaUpdate,
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """El técnico marca una entrega como 'En camino' (notifica al cliente con
    anticipación y sus datos de identificación) o 'Entregado'."""
    tecnico = _ficha_tecnico_actual(db, current_user)
    pedido = (
        db.query(Pedido)
        .filter(
            Pedido.id_pedido == pedido_id,
            Pedido.id_tecnico_entrega == tecnico.id_tecnico,
        )
        .first()
    )
    if not pedido:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")
    estado = data.estado.strip()
    if estado not in ("En camino", "Entregado"):
        raise HTTPException(status_code=400, detail="Estado no válido (En camino / Entregado)")
    pedido.estado_entrega = estado
    db.commit()
    db.refresh(pedido)

    if estado == "En camino":
        from app.models.cliente import Cliente
        from app.services.notificaciones import notificar_aviso_entrega_cliente

        cliente = (
            db.query(Cliente).filter(Cliente.id_cliente == pedido.id_cliente_pe).first()
        )
        if cliente and cliente.email:
            nombre_cliente = f"{cliente.first_name} {cliente.last_name}".strip() or "Cliente"
            notificar_aviso_entrega_cliente(
                cliente.email,
                nombre_cliente,
                {
                    "pedido": pedido.id_pedido,
                    "fecha": pedido.fecha_entrega.strftime("%d/%m/%Y") if pedido.fecha_entrega else "-",
                    "hora": pedido.hora_entrega or "-",
                    "tecnico": pedido.nombre_tecnico_entrega or "técnico",
                    "telefono_tecnico": tecnico.usuario.telefono_usuario if tecnico.usuario else None,
                },
            )

    return _serializar_entrega_tecnico(db, pedido)

