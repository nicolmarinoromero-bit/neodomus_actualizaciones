# Contratos de datos para tarifa. Pydantic valida los campos de entrada y de respuesta de la API.
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.utils.texto import limpiar_texto


# Agrupa los campos de TarifaResponse: tipo_servicio, costo, descripcion.
class TarifaResponse(BaseModel):
    tipo_servicio: str
    costo: float
    descripcion: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Agrupa los campos de TarifaUpdate: costo, descripcion.
class TarifaUpdate(BaseModel):
    """Actualización de una tarifa (solo admin).

    OWASP A02/A05 (validación TEMPRANA, en el schema, no tardía en el router):
    - ``gt=0`` rechaza ceros y negativos y ``le=10_000_000`` fija el tope
      máximo lógico ANTES de tocar la BD (antes la validación vivía tarde en
      el router con un `if` manual y no había techo superior).
    - límites alineados con las columnas de ``tarifas_servicio``:
      costo Numeric(12,2) → tope de 10 millones con margen de negocio;
      descripcion String(150) → max_length=150.
    - ``sanear_descripcion`` usa la utilidad compartida ``limpiar_texto``:
      fuera caracteres de control/bytes raros (NUL, ANSI ESC...) y si tras el
      saneo queda vacía se guarda como None.
    """

    costo: float = Field(..., gt=0, le=10_000_000)
    descripcion: Optional[str] = Field(None, max_length=150)

    @field_validator("descripcion")
    def sanear_descripcion(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        limpia = limpiar_texto(v, max_largo=150)
        return limpia or None
