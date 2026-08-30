import os
from fastapi.middleware.cors import CORSMiddleware

def setup_cors(app):
    raw = os.getenv("CORS_ORIGINS", "")
    env = os.getenv("ENVIRONMENT", "development")
    if env == "development":
        # Desarrollo: orígenes explícitos + regex para Expo Go en LAN (10.x / 192.168.x / 172.16-31.x)
        # sin usar "*" para evitar exposición accidental en producción si ENVIRONMENT falta.
        if raw:
            origins = [o.strip() for o in raw.split(",") if o.strip()]
        else:
            origins = [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:8000",
                "http://localhost:5174",
            ]
        # Regex cubre localhost, LAN 10/192.168/172.16-31 y esquema exp:// de Expo
        lan_regex = r"https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?|exp://.*"
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_origin_regex=lan_regex,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        return
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