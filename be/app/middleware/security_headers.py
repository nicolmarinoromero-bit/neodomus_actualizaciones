"""
Middleware de cabeceras de seguridad HTTP.

¿Para qué?
  Añade cabeceras de seguridad a TODAS las respuestas del servidor,
  protegiendo contra ataques comunes sin necesidad de modificar cada
  endpoint individualmente.

¿Por qué?
  Las cabeceras de seguridad son la primera línea de defensa contra:
  - Clickjacking: el atacante incrusta tu sitio en un iframe oculto
    para que el usuario haga clic en algo sin querer.
  - MIME sniffing: el navegador "adivina" el tipo de contenido y puede
    interpretar un archivo como ejecutable si no se especifica.
  - Fuga de referidos: el navegador envía la URL completa del sitio
    anterior, que puede contener tokens o datos sensibles.

Impacto:
  - X-Frame-Options: DENY impide que cualquier sitio incruste tu app
    en un iframe. Sin esto, podrían hacer clickjacking.
  - X-Content-Type-Options: nosniff impide que el navegador interprete
    archivos como scripts. Sin esto, un archivo subido podría ejecutarse.
  - Referrer-Policy: strict-origin-when-cross-origin solo envía el
    dominio (no la ruta completa) en peticiones cross-origin.
  - Permissions-Policy: desactiva cámara, micrófono y geolocalización
    para prevenir que scripts maliciosos accedan a hardware sensible.

Cómo funciona:
  Usa @app.middleware("http") que internamente crea un BaseHTTPMiddleware.
  Cada petición pasa por este middleware: después de que la app genera
  la respuesta, se añaden las cabeceras con setdefault (no sobreescribe
  si ya existen).
"""

from fastapi import FastAPI, Request, Response


def setup_security_headers(app: FastAPI) -> None:
    """Registra el middleware de cabeceras de seguridad en la app.

    ¿Por qué usar @app.middleware("http") en vez de add_middleware?
      Porque es la forma declarativa de FastAPI. Internamente hace lo
      mismo: add_middleware(BaseHTTPMiddleware, dispatch=...).

    ¿Por qué setdefault en vez de []= ?
      setdefault solo establece el valor SI la cabecera no existe.
      Esto permite que otros middlewares (como CORS) establezcan sus
      propias cabeceras sin ser sobreescritas.
    """
    @app.middleware("http")
    async def _add_security_headers(request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
        )
        return response
