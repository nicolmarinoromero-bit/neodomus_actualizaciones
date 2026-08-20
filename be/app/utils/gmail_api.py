"""
Módulo: utils/gmail_api.py
Envío de correos mediante la Gmail API (OAuth 2.0) sin SMTP.

Requiere un proyecto en Google Cloud con la Gmail API habilitada y un
cliente OAuth de tipo "App de escritorio". El refresh token se obtiene
ejecutando scripts/gmail_oauth.py. No usa contraseñas de aplicación.
"""

import base64
import json
import urllib.parse
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


def _post_json(url: str, payload: dict, headers: dict | None = None) -> dict:
    """POST JSON sencillo con la librería estándar (sin dependencias extra)."""
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            **(headers or {}),
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _access_token() -> str:
    """Renueva el access token a partir del refresh token."""
    if not (settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_REFRESH_TOKEN):
        raise RuntimeError(
            "Faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REFRESH_TOKEN "
            "en el .env. Ejecuta scripts/gmail_oauth.py para obtenerlos."
        )
    payload = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": settings.GOOGLE_REFRESH_TOKEN,
        "grant_type": "refresh_token",
    }
    data = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(
        _TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        token_data = json.loads(resp.read().decode("utf-8"))
    token = token_data.get("access_token")
    if not token:
        raise RuntimeError(f"Google rechazó el refresh token: {token_data}")
    return token


def send_gmail_api(
    to_email: str,
    subject: str,
    body: str,
    attachment_path: str | None = None,
) -> bool:
    """Envía un correo por la Gmail API usando la cuenta autenticada."""
    msg = MIMEMultipart()
    msg["From"] = settings.SMTP_USERNAME or settings.GOOGLE_CLIENT_ID
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "html"))

    if attachment_path:
        from email.mime.application import MIMEApplication
        from pathlib import Path

        with open(attachment_path, "rb") as f:
            adjunto = MIMEApplication(f.read(), _subtype="pdf")
            adjunto.add_header(
                "Content-Disposition",
                "attachment",
                filename=f"factura_{Path(attachment_path).stem}.pdf",
            )
            msg.attach(adjunto)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")
    _post_json(
        _GMAIL_SEND_URL,
        {"raw": raw},
        headers={"Authorization": f"Bearer {_access_token()}"},
    )
    return True