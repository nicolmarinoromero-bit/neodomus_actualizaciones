from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.cliente import Cliente
from app.models.roles_usuario import RolesUsuario
from app.models.solicitud_cuenta import SolicitudCuenta
from app.models.user import User
from app.schemas.cliente import ClientResponse, ClientUpdate
from app.schemas.solicitud import SolicitudCreate, SolicitudResponse
from app.utils.security import get_current_client, get_current_employee
from app.models.cita import Cita
from app.models.pedido import Pedido

router = APIRouter(prefix="/clients", tags=["Clients"])


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


@router.get("", response_model=List[dict])
def listar_clientes(
    current_admin: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Lista todos los clientes registrados con conteos de pedidos y citas (solo admin)"""
    clientes = db.query(Cliente).order_by(Cliente.id_cliente.desc()).all()
    pedidos = (
        db.query(Pedido.id_cliente_pe, func.count(Pedido.id_pedido))
        .group_by(Pedido.id_cliente_pe)
        .all()
    )
    citas = (
        db.query(Cita.id_cliente, func.count(Cita.id_cita))
        .group_by(Cita.id_cliente)
        .all()
    )
    pedidos_por_cliente = dict(pedidos)
    citas_por_cliente = dict(citas)
    return [
        {
            **ClientResponse(
                id_cliente=c.id_cliente,
                first_name=c.first_name,
                last_name=c.last_name,
                id_tipo_documento_c=c.id_tipo_documento_c,
                documento_cliente=c.documento_cliente,
                telefono_cliente=c.telefono_cliente,
                email=c.email,
                address=c.address,
                is_active=c.is_active,
            ).model_dump(),
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "pedidos_count": pedidos_por_cliente.get(c.id_cliente, 0),
            "citas_count": citas_por_cliente.get(c.id_cliente, 0),
        }
        for c in clientes
    ]


@router.get("/me", response_model=ClientResponse)
def get_my_profile(current_client: Cliente = Depends(get_current_client)):
    return current_client

@router.get("/me/cuenta-solicitud", response_model=SolicitudResponse)
def get_mi_solicitud(
    current_client: Cliente = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Devuelve la solicitud más reciente del cliente (inhabilitar/habilitar)"""
    solicitud = (
        db.query(SolicitudCuenta)
        .filter(SolicitudCuenta.id_cliente == current_client.id_cliente)
        .order_by(SolicitudCuenta.created_at.desc())
        .first()
    )
    if not solicitud:
        raise HTTPException(status_code=404, detail="No hay solicitudes")
    return solicitud

@router.post("/me/cuenta-solicitud", response_model=SolicitudResponse)
async def crear_solicitud(
    data: SolicitudCreate,
    current_client: Cliente = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Crea una solicitud de inhabilitación de cuenta para que el administrador la apruebe.
    La cuenta no se deshabilita automáticamente."""
    if data.tipo == "habilitar" and current_client.is_active:
        raise HTTPException(status_code=400, detail="Tu cuenta ya está activa")
    pendiente = (
        db.query(SolicitudCuenta)
        .filter(
            SolicitudCuenta.id_cliente == current_client.id_cliente,
            SolicitudCuenta.estado == "pendiente",
        )
        .first()
    )
    if pendiente:
        raise HTTPException(status_code=400, detail="Ya tienes una solicitud pendiente de revisión")
    solicitud = SolicitudCuenta(
        id_cliente=current_client.id_cliente,
        tipo=data.tipo,
        motivo=data.motivo,
        estado="pendiente",
    )
    db.add(solicitud)
    db.commit()
    db.refresh(solicitud)

    from app.routers.solicitudes import _alertar_admin_nueva_solicitud

    _alertar_admin_nueva_solicitud(db, current_client, data.tipo, data.motivo)
    return solicitud

@router.put("/{id_cliente}/habilitar", response_model=ClientResponse)
async def habilitar_cliente(
    id_cliente: int,
    current_admin: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Habilita la cuenta de un cliente de inmediato (solo admin)"""
    cliente = db.query(Cliente).get(id_cliente)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if cliente.is_active:
        raise HTTPException(status_code=400, detail="La cuenta del cliente ya está activa")

    cliente.is_active = True
    db.commit()
    db.refresh(cliente)

    from app.routers.solicitudes import _notificar_cliente

    await _notificar_cliente(cliente, aprobada=True, tipo="habilitar")
    return cliente


@router.put("/me", response_model=ClientResponse)
def update_my_profile(
    data: ClientUpdate,
    current_client: Cliente = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Actualiza el perfil del cliente autenticado. El cambio de correo no
    invalida la sesión (los tokens referencian al id_cliente)."""
    update_data = data.model_dump(exclude_unset=True)
    if "email" in update_data:
        email = update_data["email"].lower().strip()
        if email != current_client.email:
            raise HTTPException(
                status_code=400,
                detail="Para cambiar tu correo debes verificar el código enviado a tu correo actual",
            )
        update_data["email"] = email
    for field, value in update_data.items():
        setattr(current_client, field, value)
    db.commit()
    db.refresh(current_client)
    return current_client