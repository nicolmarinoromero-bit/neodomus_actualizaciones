"""
Rate limiting (limitación de peticiones) para la API.

¿Para qué?
  Limita cuántas peticiones puede hacer una misma IP en un período
  de tiempo. Protege la API contra abuso, scraping y ataques DDoS
  básicos.

¿Por qué?
  Sin rate limiting, un cliente malicioso (o con un bug) podría
  enviar miles de peticiones por segundo, saturando la base de datos
  y dejando la app inutilizable para otros usuarios.

¿Cómo funciona?
  slowapi es una librería que usa el algoritmo "sliding window" para
  contar peticiones por IP. Si una IP supera el límite, devuelve 429
  (Too Many Requests).

  Este módulo SOLO configura el handler de excepciones. Los decoradores
  @limiter.limit("10/minute") en los endpoints definen los límites
  específicos. Si no hay decorador, NO hay rate limit en ese endpoint.

¿Qué es get_remote_address?
  Extrae la IP real del cliente, incluso si hay proxies/load balancers
  delante (X-Forwarded-For). Si no hay proxy, usa la IP directa.

Impacto:
  - Sin rate limiting: la API es vulnerable a DDoS y abuso.
  - Con rate limiting: cada IP tiene un tope de peticiones razonable.
  - El handler convierte la excepción RateLimitExceeded en una
    respuesta HTTP 429 estándar que el frontend puede manejar.
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Limiter global: comparte estado entre todos los endpoints.
# Se usa con decoradores: @limiter.limit("10/minute") en cada endpoint.
limiter = Limiter(key_func=get_remote_address)


def setup_rate_limit(app):
    """Registra el rate limiter y su handler de excepciones en la app.

    ¿Por qué app.state?
      Permite acceder al limiter desde cualquier endpoint:
      request.app.state.limiter

    ¿Por qué add_exception_handler?
      Cuando se supera el límite, slowapi lanza RateLimitExceeded.
      Sin este handler, FastAPI devolvería un 500 genérico.
      Con él, devuelve un 429 con mensaje descriptivo.

    Nota: este módulo NO añade middleware real al pipeline de peticiones.
    Solo configura el handler y el estado. El rate limiting se activa
    individualmente en cada endpoint con el decorador @limiter.limit().
    """
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)