from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.cliente import Cliente
from app.models.pedido import DetallePedido, Pedido
from app.models.roles_usuario import RolesUsuario
from app.models.user import User
from app.services.pagos_service import BANCOS_COLOMBIANOS, METODOS_PAGO
from app.services import pedidos_service
from app.utils.security import get_current_client, get_current_employee

router = APIRouter(prefix="/pedidos", tags=["Pedidos"])


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


# ── Esquemas de entrada ─────────────────────────────────────────

class ItemCarrito(BaseModel):
    id_producto: int
    cantidad: int = 1
    metros: Optional[float] = None
    color: Optional[str] = None


class ServicioCheckout(BaseModel):
    nombre: str
    tipo_servicio: Optional[str] = None
    descripcion: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None
    direccion: Optional[str] = None
    precio: Optional[float] = None
    id_tecnico: Optional[int] = None
    id_tecnico_2: Optional[int] = None


class DatosPago(BaseModel):
    metodo: str
    numero: Optional[str] = None
    titular: Optional[str] = None
    expiracion: Optional[str] = None
    cvv: Optional[str] = None
    banco: Optional[str] = None
    correo_paypal: Optional[str] = None
    resultado_simulacion: Optional[str] = None
    punto_pago: Optional[str] = None


class CheckoutRequest(BaseModel):
    items: List[ItemCarrito]
    servicios: List[ServicioCheckout] = []
    pago: DatosPago


# ── Helpers de serialización ────────────────────────────────────

def _serializar_pago(pago):
    return {
        "id_pago": pago.id_pago,
        "metodo_pago": METODOS_PAGO.get(pago.metodo_pago, pago.metodo_pago),
        "metodo_pago_codigo": pago.metodo_pago,
        "estado": pago.estado,
        "numero_transaccion": pago.numero_transaccion,
        "monto": pago.monto,
        "banco": pago.banco,
        "titular": pago.titular,
        "ultimos_digitos": pago.ultimos_digitos,
        "correo_paypal": pago.correo_paypal,
        "codigo_punto_pago": pago.codigo_punto_pago,
        "punto_pago": pago.punto_pago,
        "referencia_pago": pago.referencia_pago,
        "fecha_limite": pago.fecha_limite_pago.isoformat() if pago.fecha_limite_pago else None,
    }


def _serializar_detalle(det):
    return {
        "id_detalle": det.id_detalle,
        "id_producto_d": det.id_producto_d,
        "nombre": (det.descripcion_detalle or (det.producto.nombre_producto if det.producto else "Producto")),
        "cantidad": det.cantidad_detalle,
        "metros": det.cantidad_metros,
        "precio_unitario": det.precio_unitario_detalle,
        "subtotal": det.subtotal_detalle,
        "es_servicio": det.id_producto_d is None,
        "fecha_servicio": det.fecha_servicio.isoformat() if det.fecha_servicio else None,
        "hora_servicio": det.hora_servicio,
        "direccion_servicio": det.direccion_servicio,
    }


def _serializar_pedido(pedido, con_detalles=False):
    data = {
        "id_pedido": pedido.id_pedido,
        "fecha": pedido.fecha_peedido.isoformat() if pedido.fecha_peedido else None,
        "total": pedido.total_pedido,
        "estado": pedido.estado_pedido,
        "fecha_entrega": pedido.fecha_entrega.isoformat() if pedido.fecha_entrega else None,
        "hora_entrega": pedido.hora_entrega,
        "id_tecnico_entrega": pedido.id_tecnico_entrega,
        "nombre_tecnico_entrega": pedido.nombre_tecnico_entrega,
        "estado_entrega": pedido.estado_entrega,
        "telefono_tecnico_entrega": (
            pedido.tecnico_entrega.usuario.telefono_usuario if pedido.tecnico_entrega and pedido.tecnico_entrega.usuario else None
        ),
        "foto_tecnico_entrega": (
            pedido.tecnico_entrega.usuario.foto_url if pedido.tecnico_entrega and pedido.tecnico_entrega.usuario else None
        ),
    }
    if con_detalles:
        data["detalles"] = [_serializar_detalle(d) for d in pedido.detalles]
    return data


# ── Endpoints ───────────────────────────────────────────────────

@router.get("/metodos-pago")
def metodos_pago():
    """Lista los métodos de pago del simulador académico."""
    return {
        "metodos": METODOS_PAGO,
        "bancos": BANCOS_COLOMBIANOS,
        "modo": "simulador",
        "pasarela": None,
        "prueba": True,
    }


@router.post("")
async def checkout(
    data: CheckoutRequest,
    cliente: Cliente = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Procesa el checkout: crea pedido, procesa pago con el simulador
    y genera factura."""
    result = await pedidos_service.crear_pedido(
        db,
        cliente,
        [i.model_dump() for i in data.items],
        [s.model_dump() for s in data.servicios],
        data.pago.metodo,
        data.pago.model_dump(exclude={"metodo"}),
    )
    pedido = result["pedido"]
    pago = result["pago"]
    factura = result["factura"]

    return {
        "pedido": _serializar_pedido(pedido, con_detalles=True),
        "pago": _serializar_pago(pago),
        "factura": (
            {
                "id_factura": factura.id_factura,
                "numero_factura": factura.numero_factura,
                "monto_total": factura.monto_total,
                "enviada_por_correo": factura.enviada_por_correo,
            }
            if factura
            else None
        ),
        "carrito_mantener": result["carrito_mantener"],
        "pdf_url": (
            f"/api/v1/pedidos/{pedido.id_pedido}/factura"
            if factura
            else None
        ),
        "ordenes_instalacion": result.get("ordenes_instalacion", []),
        "redirect_url": result.get("redirect_url"),
        "entrega": result.get("entrega"),
    }


@router.get("/mis-pedidos")
def mis_pedidos(
    cliente: Cliente = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Lista los pedidos del cliente autenticado."""
    from app.models.factura import Factura
    from app.models.pago import Pago

    pedidos = (
        db.query(Pedido)
        .filter(Pedido.id_cliente_pe == cliente.id_cliente)
        .order_by(Pedido.id_pedido.desc())
        .all()
    )
    pagos = {p.id_pedido: p for p in db.query(Pago).filter(Pago.id_pedido.isnot(None)).all()}
    facturas = {f.id_pedido: f for f in db.query(Factura).filter(Factura.id_pedido.isnot(None)).all()}

    resultado = []
    for p in pedidos:
        data = _serializar_pedido(p, con_detalles=True)
        pago = pagos.get(p.id_pedido)
        factura = facturas.get(p.id_pedido)
        data["pago"] = _serializar_pago(pago) if pago else None
        data["factura"] = (
            {
                "id_factura": factura.id_factura,
                "numero_factura": factura.numero_factura,
                "monto_total": factura.monto_total,
                "enviada_por_correo": factura.enviada_por_correo,
                "pdf_url": (
                    f"/api/v1/pedidos/{p.id_pedido}/factura"
                    if factura.pdf_path
                    else None
                ),
            }
            if factura
            else None
        )
        resultado.append(data)
    return resultado


@router.get("/all-admin")
def listar_pedidos_admin(
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Lista todos los pedidos del sistema con datos del cliente (solo empleados/admin)."""
    pedidos = db.query(Pedido).order_by(Pedido.id_pedido.desc()).limit(100).all()
    clientes = {c.id_cliente: c for c in db.query(Cliente).all()}
    resultado = []
    for p in pedidos:
        cliente = clientes.get(p.id_cliente_pe)
        resultado.append({
            "id_pedido": p.id_pedido,
            "fecha_pedido": p.fecha_peedido.isoformat() if p.fecha_peedido else None,
            "total": p.total_pedido,
            "estado": p.estado_pedido,
            "cliente_nombre": (
                f"{cliente.first_name} {cliente.last_name}".strip()
                if cliente else None
            ),
            "cliente_email": cliente.email if cliente else None,
        })
    return resultado


@router.get("/{pedido_id}")
def detalle_pedido(
    pedido_id: int,
    cliente: Cliente = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Detalle de un pedido propio del cliente."""
    pedido = (
        db.query(Pedido)
        .filter(Pedido.id_pedido == pedido_id, Pedido.id_cliente_pe == cliente.id_cliente)
        .first()
    )
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return _serializar_pedido(pedido, con_detalles=True)


@router.get("/{pedido_id}/factura")
def descargar_factura(
    pedido_id: int,
    cliente: Cliente = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Descarga el PDF de la factura de un pedido aprobado."""
    pedido = (
        db.query(Pedido)
        .filter(Pedido.id_pedido == pedido_id, Pedido.id_cliente_pe == cliente.id_cliente)
        .first()
    )
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    from app.models.factura import Factura

    factura = db.query(Factura).filter(Factura.id_pedido == pedido.id_pedido).first()
    if not factura or not factura.pdf_path:
        raise HTTPException(status_code=404, detail="La factura aún no está disponible")

    import os

    if not os.path.exists(factura.pdf_path):
        raise HTTPException(status_code=404, detail="El archivo de la factura no existe")

    return FileResponse(
        factura.pdf_path,
        media_type="application/pdf",
        filename=f"factura_{factura.numero_factura}.pdf",
    )


@router.post("/{pedido_id}/confirmar-pago")
async def confirmar_pago(
    pedido_id: int,
    cliente: Cliente = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Confirma un pago pendiente (ej. punto de pago Efecty) y genera la factura."""
    result = await pedidos_service.confirmar_pago_pendiente(db, pedido_id, cliente)
    pedido = result["pedido"]
    pago = result["pago"]
    factura = result["factura"]
    return {
        "pedido": _serializar_pedido(pedido),
        "pago": _serializar_pago(pago),
        "factura": (
            {
                "id_factura": factura.id_factura,
                "numero_factura": factura.numero_factura,
                "monto_total": factura.monto_total,
                "enviada_por_correo": factura.enviada_por_correo,
            }
            if factura
            else None
        ),
        "pdf_url": f"/api/v1/pedidos/{pedido.id_pedido}/factura" if factura else None,
        "ordenes_instalacion": result.get("ordenes_instalacion", []),
        "entrega": result.get("entrega"),
    }
