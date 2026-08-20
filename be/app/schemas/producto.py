from pydantic import BaseModel
from typing import Optional

class ProductoResponse(BaseModel):
    id_producto: int
    nombre_producto: str
    precio_venta_producto: float
    imagen_url: Optional[str] = None
    id_cate_pr: Optional[int] = None
    nombre_categoria: Optional[str] = None
    descuento_activo: Optional[float] = None
    precio_final: Optional[float] = None

    class Config:
        from_attributes = True

class CategoriaResponse(BaseModel):
    id_categoria: int
    nombre_categoria: str
    descripcion: str