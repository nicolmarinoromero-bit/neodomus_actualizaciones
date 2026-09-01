"""
Configuración de CORS (Cross-Origin Resource Sharing) para la API.

¿Qué es CORS?
  Es un mecanismo de seguridad del navegador que BLOQUEA peticiones HTTP
  entre orígenes diferentes (ej: frontend en localhost:5173 → API en
  localhost:8000) a menos que el servidor responda explícitamente con
  las cabeceras Access-Control-Allow-*.

¿Para qué sirve este módulo?
  Configura el CORSMiddleware de FastAPI para permitir peticiones
  cross-origin desde el frontend (y dispositivos móviles Expo en LAN).

¿Por qué es obligatorio?
  Sin CORS configurado, el navegador bloquea TODAS las respuestas de
  la API para peticiones cross-origin. El frontend vería errores de
  red (ERR_FAILED) o "CORS policy blocked" en la consola, y NUNCA
  podría leer los datos de la API.

Impacto:
  - Permite al frontend (localhost:5173) comunicarse con la API (localhost:8000).
  - Permite a Expo Go en LAN (10.x.x.x, 192.168.x.x) acceder a la API.
  - Sin este middleware, la aplicación es completamente inoperativa.

¿Cómo funciona internamente?
  1. Para peticiones normales (GET, POST, etc.): el middleware añade
     las cabeceras Access-Control-Allow-Origin, Allow-Methods, etc.
     a la respuesta del servidor ANTES de enviarla al navegador.
  2. Para preflights OPTIONS: el middleware responde DIRECTAMENTE sin
     pasar la petición al router. Esto es más eficiente y evita
     que endpoints pesados se ejecuten innecesariamente.
"""
import os
from fastapi.middleware.cors import CORSMiddleware


def setup_cors(app):
    """Configura el middleware CORS en la aplicación FastAPI.

    ¿Cómo decide los orígenes permitidos?
      1. Si existe la variable CORS_ORIGINS en .env → la usa (formato CSV).
      2. Si no existe → usa una lista predeterminada de orígenes de desarrollo.
      3. Si ENVIRONMENT=development → además aplica un regex que permite
         orígenes de red local (LAN) para Expo Go.

    ¿Por qué usar regex para LAN?
      En desarrollo, Expo Go se ejecuta en dispositivos móviles que acceden
      a la API por IP de red local (10.x.x.x, 192.168.x.x, 172.16-31.x).
      El regex permite estos orígenes SIN tener que listarlos todos en
      CORS_ORIGINS.

    ¿Por qué no usar "*" (wildcard)?
      Cuando allow_credentials=True (cookies, auth headers), el navegador
      RECHAZA Access-Control-Allow-Origin: *. Debe ser un origen específico.
      Además, usar "*" en producción expondría la API a cualquier sitio web.

    ¿Qué pasa en producción?
      Se usa la lista de CORS_ORIGINS del .env (o la predeterminada).
      NO se aplica el regex de LAN (solo desarrollo). Esto es más seguro.

    Impacto:
      - Desarrollo: permite localhost + LAN (flexible para móvil y desktop).
      - Producción: solo orígenes explícitos del .env (seguro).
    """
    raw = os.getenv("CORS_ORIGINS", "")
    env = os.getenv("ENVIRONMENT", "development")

    if env == "development":
        # ─── Modo desarrollo ──────────────────────────────────────────
        # Orígenes explícitos para desarrollo local + regex para Expo Go
        # en LAN. El regex cubre todas las redes privadas comunes.
        if raw:
            origins = [o.strip() for o in raw.split(",") if o.strip()]
        else:
            origins = [
                "http://localhost:5173",   # Frontend Vite en desarrollo
                "http://127.0.0.1:5173",  # Variante loopback
                "http://localhost:8000",   # Swagger/ReDoc (auto-referencia)
                "http://localhost:5174",   # Puerto alternativo de Vite
            ]
        # Regex para IPs de red local (10.x, 192.168.x, 172.16-31.x)
        # y esquema exp:// de Expo Go. Permite acceso desde cualquier
        # dispositivo en la LAN sin configurar CORS_ORIGINS manualmente.
        lan_regex = r"https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?|exp://.*"
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,          # Orígenes explícitos
            allow_origin_regex=lan_regex,   # Regex para LAN/Expo
            allow_credentials=True,         # Permite cookies y Authorization header
            allow_methods=["*"],            # Permite GET, POST, PUT, DELETE, OPTIONS...
            allow_headers=["*"],            # Permite Content-Type, Authorization, etc.
        )
        return

    # ─── Modo producción ──────────────────────────────────────────────
    # Sin regex de LAN: solo orígenes explícitos del .env o predeterminados.
    # Más seguro: no permite cualquier IP de red local.
    if raw:
        origins = [o.strip() for o in raw.split(",") if o.strip()]
    else:
        origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8000",
            "http://localhost:5174",
        ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )