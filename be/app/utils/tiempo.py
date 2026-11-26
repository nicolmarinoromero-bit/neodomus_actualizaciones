# Tiempo local del negocio (Colombia), independiente de la zona del servidor.
from datetime import datetime, timedelta

try:
    from zoneinfo import ZoneInfo

    _BOGOTA_TZ = ZoneInfo("America/Bogota")
except Exception:  # pragma: no cover - entorno sin tzdata
    _BOGOTA_TZ = None


def ahora_bogota() -> datetime:
    """Hora actual en America/Bogota, sin depender de la zona del servidor.

    Devuelve un datetime NAIVE (sin tzinfo) con la hora de Bogotá, para poder
    compararlo con ``datetime.combine(fecha, hora)``."""
    if _BOGOTA_TZ is not None:
        return datetime.now(_BOGOTA_TZ).replace(tzinfo=None)
    return datetime.now() - timedelta(hours=5)
