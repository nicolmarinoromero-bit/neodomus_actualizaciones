from typing import Optional
from pydantic import BaseModel, ConfigDict


class TarifaResponse(BaseModel):
    tipo_servicio: str
    costo: float
    descripcion: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TarifaUpdate(BaseModel):
    costo: float
    descripcion: Optional[str] = None
