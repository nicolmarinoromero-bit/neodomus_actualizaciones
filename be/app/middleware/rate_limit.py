"""Registro del limitador de peticiones en la aplicación FastAPI."""

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.utils.limiter import limiter


def setup_rate_limit(app) -> None:
    """Expone el limitador compartido y su respuesta 429."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
