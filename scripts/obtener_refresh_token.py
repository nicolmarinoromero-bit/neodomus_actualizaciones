"""Obtiene el refresh token de Gmail API para el envío de correos (OAuth 2.0,
cliente tipo "App de escritorio") y guarda GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
GOOGLE_REFRESH_TOKEN en el .env local. NO imprime secretos.

Requisitos previos (una vez, en Google Cloud Console, con la cuenta Gmail
remitente):
  1. APIs & Services → Library → "Gmail API" → Enable.
  2. APIs & Services → OAuth consent screen → External → añade tu correo como Test user.
  3. Credentials → Create Credentials → OAuth client ID → **Desktop app**.

Uso:
  python scripts/obtener_refresh_token.py
  (si GOOGLE_CLIENT_ID/SECRET no están en el .env, los pide por teclado;
  el secreto se teclea oculto y JAMÁS debe pegarse en el chat)

Scope pedido: https://mail.google.com/ (envío con adjuntos, facturas).
"""
import base64
import getpass
import hashlib
import http.server
import json
import os
import secrets
import threading
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

REDIRECCION = "http://localhost:8765/callback"
# PERMISO MÍNIMO: gmail.send (envío con adjuntos) + openid/email (identificar
# UNA vez la cuenta remitente). NO se pide mail.google.com/ (acceso completo
# al buzón) porque el backend solo usa users.messages.send y el refresh de
# token (be/app/utils/gmail_api.py).
SCOPE = "https://www.googleapis.com/auth/gmail.send openid email"
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def leer_env() -> dict:
    valores = {}
    if ENV_PATH.exists():
        for ln in ENV_PATH.read_text(encoding="utf-8").splitlines():
            if "=" in ln and not ln.strip().startswith("#"):
                k, v = ln.split("=", 1)
                valores[k.strip()] = v.strip()
    return valores


def guardar_env(clave: str, valor: str) -> None:
    """Reemplaza/crea la línea `clave=valor` en .env (sin imprimir el valor)."""
    lineas = (
        ENV_PATH.read_text(encoding="utf-8").splitlines()
        if ENV_PATH.exists()
        else []
    )
    encontrada = False
    for i, ln in enumerate(lineas):
        if ln.split("=", 1)[0].strip() == clave:
            lineas[i] = f"{clave}={valor}"
            encontrada = True
            break
    if not encontrada:
        lineas.append(f"{clave}={valor}")
    ENV_PATH.write_text("\n".join(lineas) + "\n", encoding="utf-8")


class Receptor(http.server.BaseHTTPRequestHandler):
    codigo = None

    def do_GET(self):  # noqa: N802
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        Receptor.codigo = (qs.get("code") or [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(
            "<h2>NeoDomus: autorización recibida. Puedes cerrar esta pestaña.</h2>".encode()
        )

    def log_message(self, *a):  # silencio en consola
        pass


def main() -> int:
    env = leer_env()
    cid = env.get("GOOGLE_CLIENT_ID", "")
    csec = env.get("GOOGLE_CLIENT_SECRET", "")
    if not cid:
        cid = input("Pega el Client ID (Desktop app): ").strip()
        guardar_env("GOOGLE_CLIENT_ID", cid)
    if not csec:
        csec = getpass.getpass("Pega el Client Secret (oculto): ").strip()
        guardar_env("GOOGLE_CLIENT_SECRET", csec)

    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).decode().rstrip("=")
    estado = secrets.token_urlsafe(16)

    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={cid}&redirect_uri={urllib.parse.quote(REDIRECCION)}"
        f"&response_type=code&scope={urllib.parse.quote(SCOPE)}"
        "&access_type=offline&prompt=consent"
        f"&code_challenge={challenge}&code_challenge_method=S256&state={estado}"
    )

    servidor = http.server.HTTPServer(("localhost", 8765), Receptor)
    threading.Thread(target=servidor.handle_request, daemon=True).start()
    print("Abriendo navegador para autorizar… (si no abre, pega esta URL en el navegador):")
    print(auth_url)
    webbrowser.open(auth_url)

    servidor.timeout = 300
    while Receptor.codigo is None:
        servidor.handle_request()  # espera el callback

    servidor.server_close()
    code = Receptor.codigo
    if not code:
        print("ERROR: no llegó el código de autorización")
        return 1

    data = json.dumps(
        {
            "client_id": cid,
            "client_secret": csec,
            "code": code,
            "code_verifier": verifier,
            "grant_type": "authorization_code",
            "redirect_uri": REDIRECCION,
        }
    ).encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token", data=data, method="POST"
    )
    d = json.load(urllib.request.urlopen(req, timeout=30))
    rtk = d.get("refresh_token")
    if not rtk:
        print(
            "ERROR: Google no devolvió refresh_token (quita el permiso de la app en "
            "myaccount.google.com/permissions y vuelve a ejecutar para forzar 'consent')."
        )
        return 1

    guardar_env("GOOGLE_REFRESH_TOKEN", rtk)

    # Verificación de cuenta remitente (solo identidad con scope openid/email;
    # se pide el correo, no acceso al buzón).
    req2 = urllib.request.Request(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": "Bearer " + d["access_token"]},
    )
    perfil = json.load(urllib.request.urlopen(req2, timeout=30))
    correo = perfil.get("email")
    print("CREDENCIALES_GUARDADAS en .env ✓")
    print("CUENTA_REMITENTE_GMAIL:", correo)
    print("SCOPE:", d.get("scope", SCOPE))
    print(
        "AVISO: si la app OAuth está en modo Testing, el refresh token CADUCA en "
        "7 días (Google lo revierte); publica la app (In production) o renueva "
        "semanalmente. Copia al dashboard de Railway (API → Variables): "
        "EMAIL_PROVIDER=gmail_api, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, "
        f"GOOGLE_REFRESH_TOKEN y SMTP_USERNAME={correo} (remitente From)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
