# Rutas de tarifas. Las dependencias declaradas en cada endpoint determinan sus permisos de acceso.
from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.utils.texto import limpiar_texto
from app.models.tarifa_servicio import TarifaServicio
from app.models.user import User
from app.models.roles_usuario import RolesUsuario
from app.schemas.tarifa import TarifaResponse, TarifaUpdate
from app.utils.security import get_current_employee

router = APIRouter(prefix="/tarifas", tags=["Tarifas de servicio"])


# Valida las condiciones de esta operación y devuelve un error HTTP si no se cumplen.
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


@router.get("", response_model=List[TarifaResponse])
def listar_tarifas(db: Session = Depends(get_db)):
    """Lista las tarifas por tipo de servicio (acceso público para que el
    cliente vea el costo antes de agendar)."""
    tarifas = db.query(TarifaServicio).order_by(TarifaServicio.tipo_servicio.asc()).all()
    return tarifas


@router.put("/{tipo_servicio}", response_model=TarifaResponse)
def actualizar_tarifa(
    data: TarifaUpdate,
    tipo_servicio: str = Path(
        ...,
        min_length=3,
        max_length=30,  # coincide con tarifas_servicio.tipo_servicio String(30)
        description="Tipo de servicio (p. ej. instalacion, mantenimiento)",
    ),
    _admin_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Actualiza el costo (y descripción) de una tarifa de servicio (solo admin).

    OWASP A05 (validación estricta y temprana de entradas):
    - la URL ya no acepta texto libre gigantesco: ``Path(max_length=30)``
      coincide con el ancho de la columna y devuelve 422 limpio ANTES de
      tocar la BD (era una cadena sin límite tamaño).
    - el costo ya no se valida tarde con un ``if`` manual del router: el
      schema ``TarifaUpdate`` lo rechaza de entrada si es 0, negativo o
      excede el tope máximo lógico (422 del manejador central de main.py).
    """
    # Saneamiento del parámetro de ruta: fuera caracteres de control y
    # bytes raros antes de construir la consulta (defensa en profundidad).
    servicio_buscar = (limpiar_texto(tipo_servicio, max_largo=30) or "").lower()
    tarifa = (
        db.query(TarifaServicio)
        .filter(TarifaServicio.tipo_servicio == servicio_buscar)
        .first()
    )
    if not tarifa:
        raise HTTPException(status_code=404, detail="Tarifa no encontrada para ese servicio")
    tarifa.costo = data.costo
    if data.descripcion is not None:
        tarifa.descripcion = data.descripcion.strip() or None
    db.commit()
    db.refresh(tarifa)
    return tarifa
