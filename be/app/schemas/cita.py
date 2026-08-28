from datetime import date, datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict


class CitaBase(BaseModel):
    id_tecnico: Optional[int] = None
    nombre_tecnico: Optional[str] = None
    id_tecnico_2: Optional[int] = None
    nombre_tecnico_2: Optional[str] = None
    tipo_servicio: str
    fecha: date
    hora: str
    direccion: str
    descripcion: Optional[str] = None
    costo_cita: Optional[float] = None
    metodo_pago: Optional[str] = None
    estado_pago: Optional[str] = None
    numero_transaccion: Optional[str] = None


class CitaCreate(CitaBase):
    id_tecnico: int
    metodo_pago: str
    datos_pago: Optional[dict[str, Any]] = None


class CitaUpdate(BaseModel):
    tipo_servicio: Optional[str] = None
    fecha: Optional[date] = None
    hora: Optional[str] = None
    direccion: Optional[str] = None
    descripcion: Optional[str] = None


class CitaResponse(CitaBase):
    id_cita: int
    id_cliente: int
    estado: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CrearCitaResponse(CitaResponse):
    redirect_url: Optional[str] = None
