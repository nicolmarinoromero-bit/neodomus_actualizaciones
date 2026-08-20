"""
Obtiene un refresh token de Google para la Gmail API (sin SMTP).

Pasos previos (una sola vez):
1. Ve a https://console.cloud.google.com y crea un proyecto.
2. Activa la "Gmail API" (APIs y servicios > Biblioteca).
3. Crea credenciales OAuth tipo "App de escritorio" (APIs y servicios > Credenciales).
   Anota el Client ID y el Client Secret.

Uso:
    uv run python scripts/gmail_oauth.py --client-id XXXX --client-secret YYYY

El script abre un navegador, autorizas con la cuenta de Gmail (neodomus29@gmail.com),
y al final imprime el GOOGLE_REFRESH_TOKEN para copiar al .env.

Requiere python-dotenv (ya incluido) y no agrega dependencias.
"""

import argparse
import json
import sys
import threading
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

SCOPES = "https://www.googleapis.com/auth/gmail.send"
REDIRECT_PORT = 8765
REDIRECT_URI = f"http://localhost:{REDIRECT_PORT}/"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"

_codigo_recibido: dict = {}


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        if "code" in query:
            _codigo_recibido["code"] = query["code"][0]
            mensaje = "Autorizacion completada. Ya puedes cerrar esta pestana."
            status = 200
        else:
            _codigo_recibido["error"] = query.get("error", ["error"])[0]
            mensaje = "Autorizacion cancelada o fallida. Cierra esta pestana."
            status = 400
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(mensaje.encode("utf-8"))

    def log_message(self, *args):
        pass


def _servidor_local() -> str:
    server = HTTPServer(("localhost", REDIRECT_PORT), _Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def main() -> None:
    parser = argparse.ArgumentParser(description="Obtener refresh token para la Gmail API")
    parser.add_argument("--client-id", required=True, help="OAuth Client ID (App de escritorio)")
    parser.add_argument("--client-secret", required=True, help="OAuth Client Secret")
    args = parser.parse_args()

    server = _servidor_local()
    params = urllib.parse.urlencode(
        {
            "client_id": args.client_id,
            "redirect_uri": REDIRECT_URI,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",
            "prompt": "consent",
        }
    )
    url = f"{AUTH_URL}?{params}"
    print("Abriendo el navegador para autorizar...")
    print(f"Si no se abre, visita: {url}")
    webbrowser.open(url)

    while not _codigo_recibido:
        import time

        time.sleep(1)

    if "error" in _codigo_recibido:
        print(f"Error de autorizacion: {_codigo_recibido['error']}")
        sys.exit(1)

    payload = {
        "client_id": args.client_id,
        "client_secret": args.client_secret,
        "code": _codigo_recibido["code"],
        "grant_type": "authorization_code",
        "redirect_uri": REDIRECT_URI,
    }
    data = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(
        TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        token_data = json.loads(resp.read().decode("utf-8"))

    server.shutdown()
    refresh = token_data.get("refresh_token")
    if not refresh:
        print("No se recibio refresh_token:", token_data)
        sys.exit(1)

    print("\n" + "=" * 60)
    print("Agrega esto a tu .env (y pon EMAIL_PROVIDER=gmail_api):")
    print("GOOGLE_CLIENT_ID=" + args.client_id)
    print("GOOGLE_CLIENT_SECRET=" + args.client_secret)
    print("GOOGLE_REFRESH_TOKEN=" + refresh)
    print("=" * 60)


if __name__ == "__main__":
    main()