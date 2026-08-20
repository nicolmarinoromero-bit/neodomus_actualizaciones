from fastapi import APIRouter, Depends, Query, HTTPException, File, UploadFile, Request
from sqlalchemy import select, and_, or_, exists
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, date
from pathlib import Path
import uuid
from pydantic import BaseModel

from app.database import get_db
from app.models.producto import Producto
from app.models.producto_variante import ProductoVariante
from app.models.categoria import Categoria
from app.models.proveedor import Proveedor
from app.models.roles_usuario import RolesUsuario
from app.models.user import User
from app.utils.security import get_current_employee, get_current_user, oauth2_scheme

# Umbral de stock bajo (configurable). Productos con stock >= STOCK_MINIMO
# se consideran "disponible"; entre 1 y STOCK_MINIMO-1 "bajo"; 0 => "agotado".
STOCK_MINIMO = 5

# Directorio donde se guardan las imágenes de productos (sirve /uploads).
PRODUCTOS_IMG_DIR = Path(__file__).resolve().parent.parent / "static" / "productos"
PRODUCTOS_IMG_DIR.mkdir(parents=True, exist_ok=True)

EXTENSIONES_IMAGEN = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def _estado_stock(stock: int) -> str:
    if stock <= 0:
        return "agotado"
    if stock < STOCK_MINIMO:
        return "bajo"
    return "disponible"


def normalizar_nombre_producto(nombre: str | None) -> str:
    """Normaliza la presentación del nombre: primera letra en MAYÚSCULA y el
    resto en minúsculas. Ej: 'cable thhn' -> 'Cable thhn'."""
    if not nombre:
        return ""
    texto = str(nombre).strip()
    return texto[:1].upper() + texto[1:].lower() if texto else ""


# ── Esquemas ─────────────────────────────────────────────
class VarianteResponse(BaseModel):
    id: int
    nombre: str
    hex: Optional[str] = None
    imagen_url: Optional[str] = None
    stock: int = 0


class ProductoResponse(BaseModel):
    id_producto: int
    nombre_producto: str
    marca: Optional[str] = None
    venta_por_metros: bool = False
    referencia_producto: Optional[str] = None
    precio_compra_producto: Optional[float] = None
    precio_venta_producto: float
    fecha_registro_producto: Optional[datetime] = None
    imagen_url: Optional[str] = None
    id_cate_pr: Optional[int] = None
    nombre_categoria: Optional[str] = None
    id_proveedor_pr: Optional[int] = None
    nombre_proveedor: Optional[str] = None
    descripcion_producto: Optional[str] = None
    caracteristicas_producto: Optional[str] = None
    colores_producto: Optional[str] = None
    estado_producto: str = "activo"
    stock_producto: int = 0
    stock_estado: str = "disponible"
    stock_minimo: int = STOCK_MINIMO
    descuento_activo: Optional[float] = None
    precio_final: Optional[float] = None
    promocion_hasta: Optional[str] = None
    es_nuevo: bool = False
    tecnicos_requeridos: int = 1
    variantes: List[VarianteResponse] = []


class ProductoCreate(BaseModel):
    nombre_producto: str
    marca: Optional[str] = None
    venta_por_metros: bool = False
    referencia_producto: Optional[str] = None
    id_proveedor_pr: Optional[int] = None
    precio_compra_producto: Optional[float] = None
    precio_venta_producto: float
    imagen_url: Optional[str] = None
    id_cate_pr: Optional[int] = None
    descripcion_producto: Optional[str] = None
    caracteristicas_producto: Optional[str] = None
    colores_producto: Optional[str] = None
    estado_producto: Optional[str] = "activo"
    stock_producto: int = 0
    descuento_activo: Optional[float] = None
    promocion_hasta: Optional[str] = None
    es_nuevo_producto: Optional[bool] = True
    tecnicos_requeridos: int = 1


class CategoriaResponse(BaseModel):
    id_categoria: int
    nombre_categoria: str
    descripcion: Optional[str] = None


class VarianteCreate(BaseModel):
    nombre: str
    hex: Optional[str] = None
    imagen_url: Optional[str] = None
    stock: int = 0


class ProveedorResponse(BaseModel):
    id_proveedor: int
    nombre_proveedor: str
    contacto_proveedor: Optional[str] = None
    telefono_proveedor: Optional[str] = None
    correo_proveedor: Optional[str] = None
    direccion_proveedor: Optional[str] = None


class ProveedorCreate(BaseModel):
    nombre_proveedor: str
    contacto_proveedor: Optional[str] = None
    telefono_proveedor: Optional[str] = None
    correo_proveedor: Optional[str] = None
    direccion_proveedor: Optional[str] = None


class SolicitudReabastecimientoItem(BaseModel):
    id_producto: int
    cantidad: int = 1


def _admin(
    current_user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> User:
    role = db.execute(select(RolesUsuario.nombre_rol).where(RolesUsuario.id_rol == current_user.id_rol_u)).scalar_one_or_none()
    if role not in ("admin", "administrador"):
        raise HTTPException(status_code=403, detail="Permisos insuficientes")
    return current_user


def _serializar_variante(v: ProductoVariante) -> VarianteResponse:
    return VarianteResponse(
        id=v.id,
        nombre=v.nombre,
        hex=v.hex,
        imagen_url=v.imagen_url,
        stock=v.stock or 0,
    )


async def _empleado_opcional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Devuelve el empleado autenticado o None si no hay sesión válida."""
    if not token:
        return None
    try:
        user = await get_current_user(token, db)
    except HTTPException:
        return None
    return user if isinstance(user, User) else None


def _serializar(p: Producto) -> ProductoResponse:
    precio_venta = p.precio_venta_producto or 0
    descuento = p.descuento_activo if (p.descuento_activo or 0) > 0 else None
    promo_vigente = descuento and (p.promocion_hasta is None or p.promocion_hasta >= date.today())
    precio_final = round(precio_venta * (1 - descuento / 100), 2) if promo_vigente else None
    es_nuevo = bool(p.es_nuevo_producto)
    return ProductoResponse(
        id_producto=p.id_producto,
        nombre_producto=normalizar_nombre_producto(p.nombre_producto),
        marca=p.marca,
        venta_por_metros=bool(p.venta_por_metros),
        referencia_producto=p.referencia_producto,
        precio_compra_producto=p.precio_compra_producto,
        precio_venta_producto=p.precio_venta_producto,
        fecha_registro_producto=p.fecha_registro_producto,
        imagen_url=p.imagen_url,
        id_cate_pr=p.id_cate_pr,
        nombre_categoria=p.categoria.nombre_categoria if p.categoria else None,
        id_proveedor_pr=p.id_proveedor_pr,
        nombre_proveedor=p.proveedor.nombre_proveedor if p.proveedor else None,
        descripcion_producto=p.descripcion_producto,
        caracteristicas_producto=p.caracteristicas_producto,
        colores_producto=p.colores_producto,
        estado_producto=p.estado_producto or "activo",
        stock_producto=p.stock_producto or 0,
        stock_estado=_estado_stock(p.stock_producto or 0),
        stock_minimo=STOCK_MINIMO,
        descuento_activo=descuento,
        precio_final=precio_final,
        promocion_hasta=p.promocion_hasta.isoformat() if p.promocion_hasta else None,
        es_nuevo=es_nuevo,
        tecnicos_requeridos=max(1, p.tecnicos_requeridos or 1),
        variantes=[_serializar_variante(v) for v in p.variantes],
    )


def _parsear_fecha_promo(valor: Optional[str]):
    if not valor:
        return None
    try:
        return datetime.strptime(valor[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


router = APIRouter(prefix="/productos", tags=["productos"])


@router.get("/", response_model=dict)
def listar_productos(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None),
    categoria: Optional[int] = Query(None),
    proveedor: Optional[int] = Query(None),
    estado: Optional[str] = Query("activo"),
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    current_user: Optional[User] = Depends(_empleado_opcional),
):
    query = db.query(Producto).outerjoin(Categoria, Producto.id_cate_pr == Categoria.id_categoria)
    if estado == "activo":
        query = query.filter(Producto.estado_producto == "activo")
    elif estado == "inactivo":
        query = query.filter(Producto.estado_producto == "inactivo")
    if current_user is None:
        # El público solo ve productos con stock disponible (o con variantes en stock).
        query = query.filter(
            or_(
                Producto.stock_producto > 0,
                exists().where(
                    and_(
                        ProductoVariante.id_producto == Producto.id_producto,
                        ProductoVariante.stock > 0,
                    )
                ),
            )
        )
    if search:
        query = query.filter(Producto.nombre_producto.ilike(f"%{search}%"))
    if categoria:
        query = query.filter(Producto.id_cate_pr == categoria)
    if proveedor:
        query = query.filter(Producto.id_proveedor_pr == proveedor)
    total = query.count()
    productos = query.order_by(Producto.id_producto.desc()).offset((page - 1) * limit).limit(limit).all()
    data = [_serializar(p).dict() for p in productos]
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "data": data,
        "total_pages": (total + limit - 1) // limit,
    }


@router.get("/categorias", response_model=List[CategoriaResponse])
def listar_categorias(db: Session = Depends(get_db)):
    return db.query(Categoria).order_by(Categoria.id_categoria.asc()).all()


@router.get("/proveedores", response_model=List[ProveedorResponse])
def listar_proveedores(_admin_user: User = Depends(_admin), db: Session = Depends(get_db)):
    return db.query(Proveedor).order_by(Proveedor.nombre_proveedor.asc()).all()


@router.post("/proveedores", response_model=ProveedorResponse, status_code=201)
def crear_proveedor(
    data: ProveedorCreate,
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Crea un proveedor nuevo (solo administrador)"""
    nombre = data.nombre_proveedor.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre del proveedor es obligatorio")
    correo = (data.correo_proveedor or "").strip() or None
    if correo:
        existe = db.query(Proveedor).filter(Proveedor.correo_proveedor == correo).first()
        if existe:
            raise HTTPException(status_code=400, detail="Ya existe un proveedor con ese correo")
    proveedor = Proveedor(
        nombre_proveedor=nombre,
        contacto_proveedor=(data.contacto_proveedor or "").strip() or None,
        telefono_proveedor=(data.telefono_proveedor or "").strip() or None,
        correo_proveedor=correo,
        direccion_proveedor=(data.direccion_proveedor or "").strip() or None,
    )
    db.add(proveedor)
    db.commit()
    db.refresh(proveedor)
    return proveedor


@router.put("/proveedores/{proveedor_id}", response_model=ProveedorResponse)
def actualizar_proveedor(
    proveedor_id: int,
    data: ProveedorCreate,
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Actualiza los datos de un proveedor (solo administrador)"""
    proveedor = db.query(Proveedor).filter(Proveedor.id_proveedor == proveedor_id).first()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    nombre = data.nombre_proveedor.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre del proveedor es obligatorio")
    correo = (data.correo_proveedor or "").strip() or None
    if correo:
        existe = (
            db.query(Proveedor)
            .filter(Proveedor.correo_proveedor == correo, Proveedor.id_proveedor != proveedor_id)
            .first()
        )
        if existe:
            raise HTTPException(status_code=400, detail="Ya existe un proveedor con ese correo")
    proveedor.nombre_proveedor = nombre
    proveedor.contacto_proveedor = (data.contacto_proveedor or "").strip() or None
    proveedor.telefono_proveedor = (data.telefono_proveedor or "").strip() or None
    proveedor.correo_proveedor = correo
    proveedor.direccion_proveedor = (data.direccion_proveedor or "").strip() or None
    db.commit()
    db.refresh(proveedor)
    return proveedor


@router.post("/proveedores/{proveedor_id}/solicitar-reabastecimiento", response_model=dict)
async def solicitar_reabastecimiento(
    proveedor_id: int,
    items: List[SolicitudReabastecimientoItem],
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Envía un correo al proveedor solicitando más unidades de los productos indicados."""
    from app.utils.email import send_email

    proveedor = db.query(Proveedor).filter(Proveedor.id_proveedor == proveedor_id).first()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    if not proveedor.correo_proveedor:
        raise HTTPException(status_code=400, detail="El proveedor no tiene correo configurado")

    filas = []
    for item in items:
        if not item.cantidad or item.cantidad <= 0:
            continue
        p = db.query(Producto).filter(Producto.id_producto == item.id_producto).first()
        if p and p.id_proveedor_pr == proveedor_id:
            filas.append((p, item.cantidad))
    if not filas:
        raise HTTPException(status_code=400, detail="Selecciona al menos un producto con cantidad mayor a 0")

    filas_html = "".join(
        f"<tr style='background:{'#ffffff' if i % 2 == 0 else '#faf7f0'}'>"
        f"<td style='padding:10px 12px;border:1px solid #eee;font-size:13px;color:#333'><strong>{p.nombre_producto}</strong></td>"
        f"<td style='padding:10px 12px;border:1px solid #eee;font-size:13px;color:#666'>{p.referencia_producto or '-'}</td>"
        f"<td style='padding:10px 12px;border:1px solid #eee;font-size:13px;color:#666;text-align:center'>{p.stock_producto or 0}</td>"
        f"<td style='padding:10px 12px;border:1px solid #eee;font-size:14px;color:#b8860b;font-weight:700;text-align:center'>{item_cantidad}</td>"
        f"</tr>"
        for i, (p, item_cantidad) in enumerate(filas)
    )
    subject = f"Solicitud de reabastecimiento para {proveedor.nombre_proveedor}"
    body = (
        "<div style='background:#f6f4ef;padding:24px;font-family:Arial,Helvetica,sans-serif'>"
        "<div style='max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8e2d6'>"
        "<div style='background:#1f1a12;padding:22px 26px;border-bottom:4px solid #d4a54b'>"
        "<h2 style='margin:0;color:#ffffff;font-size:20px'>Neodomus</h2>"
        "<p style='margin:4px 0 0;color:#d4a54b;font-size:13px;font-weight:600;letter-spacing:1px'>SOLICITUD DE REABASTECIMIENTO</p>"
        "</div>"
        "<div style='padding:26px'>"
        f"<p style='margin:0 0 6px;color:#333;font-size:14px'>Hola <strong>{proveedor.contacto_proveedor or proveedor.nombre_proveedor}</strong>,</p>"
        "<p style='margin:0 0 18px;color:#666;font-size:14px'>Necesitamos reponer las siguientes unidades. Por favor confírmenos disponibilidad y tiempo de entrega:</p>"
        "<table style='border-collapse:collapse;width:100%;font-family:Arial,Helvetica,sans-serif'>"
        "<thead><tr style='background:#1f1a12'>"
        "<th style='padding:10px 12px;border:1px solid #1f1a12;color:#ffffff;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;text-align:left'>Producto</th>"
        "<th style='padding:10px 12px;border:1px solid #1f1a12;color:#ffffff;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;text-align:left'>Referencia</th>"
        "<th style='padding:10px 12px;border:1px solid #1f1a12;color:#ffffff;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;text-align:center'>Stock actual</th>"
        "<th style='padding:10px 12px;border:1px solid #1f1a12;color:#ffd98a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;text-align:center'>Cantidad solicitada</th>"
        "</tr></thead><tbody>"
        f"{filas_html}"
        "</tbody></table>"
        "<p style='margin:18px 0 0;padding:12px 14px;background:#fdf6e7;border:1px solid #eed7a8;border-radius:8px;color:#7a5a14;font-size:13px'>"
        "Responda este correo o llámenos para coordinar el despacho. ¡Gracias por su atención!</p>"
        "<p style='margin:22px 0 0;color:#333;font-size:14px'>Quedamos atentos. <strong>Saludos cordiales.</strong></p>"
        "</div>"
        "<div style='background:#f6f4ef;padding:14px 26px;border-top:1px solid #e8e2d6'>"
        "<p style='margin:0;color:#999;font-size:12px'>Este mensaje fue generado automáticamente desde el panel administrativo de Neodomus.</p>"
        "</div>"
        "</div>"
        "</div>"
    )
    enviado = await send_email(proveedor.correo_proveedor, subject, body)
    if not enviado:
        raise HTTPException(status_code=500, detail="No se pudo enviar el correo de solicitud")
    return {
        "msg": "Solicitud enviada al proveedor",
        "enviado": enviado,
        "productos": len(filas),
        "destinatario": proveedor.correo_proveedor,
    }


@router.get("/{producto_id}", response_model=ProductoResponse)
def obtener_producto(
    producto_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(_empleado_opcional),
):
    p = db.query(Producto).filter(Producto.id_producto == producto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if current_user is None:
        if p.estado_producto == "inactivo":
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        con_stock = (p.stock_producto or 0) > 0 or any(v.stock > 0 for v in p.variantes)
        if not con_stock:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
    return _serializar(p)


@router.get("/{producto_id}/variantes", response_model=List[VarianteResponse])
def listar_variantes(producto_id: int, db: Session = Depends(get_db)):
    """Lista las variantes de color de un producto (público)."""
    p = db.query(Producto).filter(Producto.id_producto == producto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return [_serializar_variante(v) for v in p.variantes]


@router.post("/{producto_id}/variantes", response_model=VarianteResponse)
def crear_variante(
    producto_id: int,
    data: VarianteCreate,
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Agrega una variante de color a un producto (solo administrador)."""
    p = db.query(Producto).filter(Producto.id_producto == producto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    nombre = data.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre de la variante es obligatorio")
    variante = ProductoVariante(
        id_producto=producto_id,
        nombre=nombre,
        hex=(data.hex or "").strip() or None,
        imagen_url=(data.imagen_url or "").strip() or None,
        stock=data.stock or 0,
    )
    db.add(variante)
    db.commit()
    db.refresh(variante)
    return _serializar_variante(variante)


@router.put("/{producto_id}/variantes/{variante_id}", response_model=VarianteResponse)
def editar_variante(
    producto_id: int,
    variante_id: int,
    data: VarianteCreate,
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Actualiza una variante de color (solo administrador)."""
    variante = (
        db.query(ProductoVariante)
        .filter(
            ProductoVariante.id == variante_id,
            ProductoVariante.id_producto == producto_id,
        )
        .first()
    )
    if not variante:
        raise HTTPException(status_code=404, detail="Variante no encontrada")
    variante.nombre = data.nombre.strip()
    variante.hex = (data.hex or "").strip() or None
    variante.imagen_url = (data.imagen_url or "").strip() or None
    variante.stock = data.stock or 0
    db.commit()
    db.refresh(variante)
    return _serializar_variante(variante)


@router.delete("/{producto_id}/variantes/{variante_id}", response_model=dict)
def eliminar_variante(
    producto_id: int,
    variante_id: int,
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Elimina una variante de color (solo administrador)."""
    variante = (
        db.query(ProductoVariante)
        .filter(
            ProductoVariante.id == variante_id,
            ProductoVariante.id_producto == producto_id,
        )
        .first()
    )
    if not variante:
        raise HTTPException(status_code=404, detail="Variante no encontrada")
    db.delete(variante)
    db.commit()
    return {"msg": "Variante eliminada correctamente"}


@router.post("/upload-imagen", response_model=dict)
async def subir_imagen_producto(
    file: UploadFile = File(...),
    request: Request = None,
    _admin_user: User = Depends(_admin),
):
    """Sube una imagen de producto y devuelve su URL pública (solo administrador)."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Selecciona un archivo de imagen")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in EXTENSIONES_IMAGEN:
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
    nombre = f"{uuid.uuid4().hex}{ext}"
    (PRODUCTOS_IMG_DIR / nombre).write_bytes(contenido)
    base = str(request.base_url).rstrip("/")
    return {"url": f"{base}/uploads/{nombre}", "filename": nombre}


@router.post("", response_model=ProductoResponse)
def crear_producto(
    data: ProductoCreate,
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Crea un producto nuevo (solo administrador)"""
    nombre = data.nombre_producto.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre del producto es obligatorio")
    referencia = (data.referencia_producto or "").strip() or _generar_referencia(nombre)
    existe_ref = db.query(Producto).filter(Producto.referencia_producto == referencia).first()
    if existe_ref:
        raise HTTPException(status_code=400, detail="La referencia ya está en uso")
    producto = Producto(
        nombre_producto=nombre,
        marca=(data.marca or "").strip() or None,
        venta_por_metros=1 if data.venta_por_metros else 0,
        referencia_producto=referencia,
        id_proveedor_pr=data.id_proveedor_pr,
        precio_compra_producto=data.precio_compra_producto,
        precio_venta_producto=data.precio_venta_producto,
        fecha_registro_producto=datetime.now(),
        imagen_url=data.imagen_url,
        id_cate_pr=data.id_cate_pr,
        descripcion_producto=data.descripcion_producto,
        caracteristicas_producto=data.caracteristicas_producto,
        colores_producto=data.colores_producto,
        estado_producto=data.estado_producto or "activo",
        stock_producto=data.stock_producto or 0,
        descuento_activo=data.descuento_activo,
        promocion_hasta=_parsear_fecha_promo(data.promocion_hasta),
        es_nuevo_producto=True if data.es_nuevo_producto is None else bool(data.es_nuevo_producto),
        tecnicos_requeridos=max(1, data.tecnicos_requeridos or 1),
    )
    db.add(producto)
    db.commit()
    db.refresh(producto)
    return _serializar(producto)


@router.put("/{producto_id}", response_model=ProductoResponse)
def editar_producto(
    producto_id: int,
    data: ProductoCreate,
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Actualiza un producto (solo administrador)"""
    producto = db.query(Producto).filter(Producto.id_producto == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    campos = {
        "nombre_producto": data.nombre_producto.strip(),
        "marca": (data.marca or "").strip() or None,
        "venta_por_metros": 1 if data.venta_por_metros else 0,
        "id_proveedor_pr": data.id_proveedor_pr,
        "precio_compra_producto": data.precio_compra_producto,
        "precio_venta_producto": data.precio_venta_producto,
        "imagen_url": data.imagen_url,
        "id_cate_pr": data.id_cate_pr,
        "descripcion_producto": data.descripcion_producto,
        "caracteristicas_producto": data.caracteristicas_producto,
        "colores_producto": data.colores_producto,
        "estado_producto": data.estado_producto or "activo",
        "stock_producto": data.stock_producto or 0,
        "descuento_activo": data.descuento_activo,
        "promocion_hasta": _parsear_fecha_promo(data.promocion_hasta),
        "es_nuevo_producto": True if data.es_nuevo_producto is None else bool(data.es_nuevo_producto),
        "tecnicos_requeridos": max(1, data.tecnicos_requeridos or 1),
    }
    for campo, valor in campos.items():
        setattr(producto, campo, valor)
    db.commit()
    db.refresh(producto)
    return _serializar(producto)


@router.delete("/{producto_id}", response_model=dict)
def eliminar_producto(
    producto_id: int,
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Elimina un producto (solo administrador). Si tiene historial de pedidos, lo desactiva."""
    producto = db.query(Producto).filter(Producto.id_producto == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    try:
        db.delete(producto)
        db.commit()
        return {"msg": "Producto eliminado correctamente", "eliminado": True}
    except IntegrityError:
        db.rollback()
        producto.estado_producto = "inactivo"
        db.commit()
        return {"msg": "Producto desactivado (tiene historial asociado)", "eliminado": False}


def _generar_referencia(nombre: str) -> str:
    import time

    base = "".join(c for c in nombre.lower() if c.isalnum() or c in " -_")[:20].strip().replace(" ", "-")
    return f"ref-{base or 'producto'}-{int(time.time() * 1000) % 100000}"

