"""Filtro SEGURO de variables de Railway: solo muestra lo no secreto.

Entrada (stdin): `railway variables --service <svc> --json`
Salida: SOLO las claves de la lista blanca y, para DATABASE_URL, únicamente
host/base de datos (NUNCA usuario/contraseña). Cualquier otra clave
(p. ej. *_PASSWORD, *SECRET*, *_KEY, *_TOKEN) se omite y se lista solo por
nombre-mascara "[SECRETO_PRESENTE]" sin valor.

Uso (PowerShell o bash):
  npx @railway/cli@latest variables --service neodomus_actualizaciones --json | \
    python deploy/scripts/variables_no_secretas.py
"""
import json
import sys
from urllib.parse import urlparse

BLANCO_EXACTO = {
    "MINIO_ENDPOINT",
    "MINIO_SECURE",
    "MINIO_PUBLIC_ENDPOINT",
    "MINIO_BUCKET",
    "MINIO_PRIVATE_BUCKET",
    "ENVIRONMENT",
    "LOG_LEVEL",
    "FRONTEND_URL",
    "CORS_ORIGINS",
    "FRONTEND_VERIFY_EMAIL_PATH",
    "FRONTEND_RESET_PASSWORD_PATH",
    "PAYMENT_PROVIDER",
    "EMAIL_PROVIDER",
    "API_PORT",
    "MYSQL_DATABASE",
    "RATE_LIMIT_ENABLED",
    "RATE_LIMIT_STORAGE_URI",
    "RATE_LIMIT_HEADERS_ENABLED",
    "TRUSTED_PROXIES",
    "RAILWAY_PUBLIC_DOMAIN",
    "RAILWAY_PRIVATE_DOMAIN",
    "RAILWAY_PROJECT_NAME",
    "RAILWAY_ENVIRONMENT_NAME",
}

BLANCO_PREFIJO = ("VITE_", "GOOGLE_SIGNIN_CLIENT_ID")


def main() -> int:
    try:
        datos = json.load(sys.stdin)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: entrada no es JSON de railway variables: {exc}", file=sys.stderr)
        return 2
    secretos = []
    for clave, valor in sorted(datos.items()):
        if clave in BLANCO_EXACTO or any(clave.startswith(p) for p in BLANCO_PREFIJO):
            print(f"{clave}={valor}")
        elif clave == "DATABASE_URL":
            u = urlparse(str(valor))
            # Solo host/base: NUNCA credenciales.
            print(f"DATABASE_URL_HOST={u.hostname}:{u.port or 3306}/{u.path.lstrip('/')}")
        elif any(
            s in clave.upper() for s in ("PASSWORD", "SECRET", "_KEY", "TOKEN", "CREDENTIAL")
        ):
            secretos.append(clave)
    print(f"[SECRETO_PRESENTE]={len(secretos)} variables secretas ocultas por diseño")
    return 0


if __name__ == "__main__":
    sys.exit(main())
