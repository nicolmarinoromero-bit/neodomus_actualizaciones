"""Limitador de peticiones (slowapi) configurado por entorno.

La clave del límite es la IP real del cliente: ``get_client_ip`` solo acepta
``X-Forwarded-For`` cuando la conexión inmediata es un proxy de confianza.
"""

from slowapi import Limiter

from app.config import settings
from app.utils.client_ip import get_client_ip

limiter = Limiter(
    key_func=get_client_ip,
    enabled=settings.RATE_LIMIT_ENABLED,
    headers_enabled=settings.RATE_LIMIT_HEADERS_ENABLED,
    storage_uri=settings.RATE_LIMIT_STORAGE_URI,
    key_prefix="neodomus",
)
