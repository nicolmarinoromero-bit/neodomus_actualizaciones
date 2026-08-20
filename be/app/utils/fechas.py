"""
Módulo: utils/fechas.py
Utilidades de fecha/hora.

El contenedor del API corre en UTC; Colombia (America/Bogota) es UTC-5 y no
usa horario de verano. Las fechas de negocio (facturas, etc.) deben guardarse
en hora local de Bogotá, naive (sin tzinfo) para la columna DateTime.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

BOGOTA_TZ = ZoneInfo("America/Bogota")


def fecha_bogota() -> datetime:
    """Fecha/hora actual de Bogotá como datetime naive (sin tzinfo)."""
    return datetime.now(BOGOTA_TZ).replace(tzinfo=None)
