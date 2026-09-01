"""
Módulo: app/middleware/__init__.py

¿Qué hace?
  Re-exporta los configuradores de middleware: CORS, rate-limiting
  y cabeceras de seguridad para montarlos en la app FastAPI.

Impacto: Sin estos middlewares la API no tendría protección contra
abusos de tasa, ataques CSRF ni políticas de origen cruzado.
"""

from .cors import setup_cors
from .rate_limit import setup_rate_limit
from .security_headers import setup_security_headers
