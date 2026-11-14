"""Semana 5 del bootcamp — Gmail API con dobles de red.

Ninguna prueba sale a Internet: `urllib.request.urlopen` se sustituye por un
doble que devuelve JSON. Se verifica el refresco del token OAuth, el armado
MIME (cuerpo HTML + adjuntos) y los errores de configuración.
"""
import base64
import json
from email import message_from_bytes
from email.header import decode_header, make_header

import pytest

from app.config import settings
from app.utils import gmail_api


class _Respuesta:
    def __init__(self, payload):
        self._payload = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_post_json_envia_cuerpo_y_headers(monkeypatch):
    # Arrange
    capturado = {}

    def urlopen(req, timeout):
        capturado["url"] = req.full_url
        capturado["method"] = req.get_method()
        capturado["content_type"] = req.get_header("Content-type")
        capturado["auth"] = req.get_header("Authorization")
        capturado["body"] = json.loads(req.data)
        capturado["timeout"] = timeout
        return _Respuesta({"ok": True})

    monkeypatch.setattr(gmail_api.urllib.request, "urlopen", urlopen)
    # Act
    r = gmail_api._post_json("https://x/y", {"a": 1}, headers={"Authorization": "Bearer t"})
    # Assert
    assert r == {"ok": True}
    assert capturado == {
        "url": "https://x/y", "method": "POST",
        "content_type": "application/json", "auth": "Bearer t",
        "body": {"a": 1}, "timeout": 15,
    }


def test_access_token_exige_configuracion(monkeypatch):
    # Arrange: falta el refresh token.
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secreto")
    monkeypatch.setattr(settings, "GOOGLE_REFRESH_TOKEN", "")
    # Act / Assert
    with pytest.raises(RuntimeError, match="GOOGLE_REFRESH_TOKEN"):
        gmail_api._access_token()


def test_access_token_refresca_y_valida_respuesta(monkeypatch):
    # Arrange
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secreto")
    monkeypatch.setattr(settings, "GOOGLE_REFRESH_TOKEN", "refresh")
    capturado = {}

    def urlopen(req, timeout):
        capturado["body"] = req.data.decode()
        capturado["content_type"] = req.get_header("Content-type")
        capturado["timeout"] = timeout
        return _Respuesta({"access_token": "tok-1"})

    monkeypatch.setattr(gmail_api.urllib.request, "urlopen", urlopen)
    # Act
    assert gmail_api._access_token() == "tok-1"
    # Assert
    assert "grant_type=refresh_token" in capturado["body"]
    assert "refresh_token=refresh" in capturado["body"]
    assert capturado["content_type"] == "application/x-www-form-urlencoded"
    # Arrange 2: Google responde sin token.
    monkeypatch.setattr(
        gmail_api.urllib.request, "urlopen",
        lambda req, timeout: _Respuesta({"error": "invalid_grant"}),
    )
    # Act / Assert
    with pytest.raises(RuntimeError, match="invalid_grant"):
        gmail_api._access_token()


def _partes(raw: str):
    mensaje = message_from_bytes(base64.urlsafe_b64decode(raw))
    return mensaje


def test_send_gmail_api_arma_mime_y_adjunto_en_bytes(monkeypatch):
    # Arrange
    monkeypatch.setattr(settings, "SMTP_USERNAME", "remitente@example.com")
    monkeypatch.setattr(gmail_api, "_access_token", lambda: "tok")
    capturado = {}
    monkeypatch.setattr(
        gmail_api, "_post_json",
        lambda url, payload, headers=None: capturado.update(url=url, payload=payload, headers=headers),
    )
    # Act
    assert gmail_api.send_gmail_api(
        "cliente@example.com", "Factura", "<b>Hola</b>",
        attachment_bytes=b"%PDF-1", attachment_filename="factura_9.pdf",
    ) is True
    # Assert
    assert capturado["url"] == gmail_api._GMAIL_SEND_URL
    assert capturado["headers"] == {"Authorization": "Bearer tok"}
    mensaje = _partes(capturado["payload"]["raw"])
    assert mensaje["To"] == "cliente@example.com"
    assert mensaje["Subject"] == "Factura"
    assert mensaje["From"] == "remitente@example.com"
    adjuntos = [p for p in mensaje.walk() if p.get_filename()]
    assert adjuntos and adjuntos[0].get_payload(decode=True) == b"%PDF-1"


def test_send_gmail_api_usa_adjunto_desde_ruta_y_from_de_respaldo(monkeypatch, tmp_path):
    # Arrange
    monkeypatch.setattr(settings, "SMTP_USERNAME", "")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "cuenta@example.com")
    monkeypatch.setattr(gmail_api, "_access_token", lambda: "tok")
    capturado = {}
    monkeypatch.setattr(
        gmail_api, "_post_json",
        lambda url, payload, headers=None: capturado.update(payload=payload),
    )
    archivo = tmp_path / "factura_88.pdf"
    archivo.write_bytes(b"%PDF-2")
    # Act
    gmail_api.send_gmail_api("cliente@example.com", "Factura", "<p>x</p>", attachment_path=str(archivo))
    # Assert: el nombre se normaliza a factura_<stem>.pdf.
    mensaje = _partes(capturado["payload"]["raw"])
    assert mensaje["From"] == "cuenta@example.com"
    adjunto = next(p for p in mensaje.walk() if p.get_filename())
    assert make_header(decode_header(adjunto.get_filename())).__str__() == "factura_factura_88.pdf"
    assert adjunto.get_payload(decode=True) == b"%PDF-2"


def test_send_gmail_api_sin_adjunto(monkeypatch):
    # Arrange
    monkeypatch.setattr(settings, "SMTP_USERNAME", "r@example.com")
    monkeypatch.setattr(gmail_api, "_access_token", lambda: "tok")
    capturado = {}
    monkeypatch.setattr(
        gmail_api, "_post_json",
        lambda url, payload, headers=None: capturado.update(payload=payload),
    )
    # Act
    gmail_api.send_gmail_api("cliente@example.com", "Sin adjunto", "<p>solo cuerpo</p>")
    # Assert
    mensaje = _partes(capturado["payload"]["raw"])
    assert not [p for p in mensaje.walk() if p.get_filename()]
    assert "solo cuerpo" in mensaje.get_payload()[0].get_payload(decode=True).decode()
