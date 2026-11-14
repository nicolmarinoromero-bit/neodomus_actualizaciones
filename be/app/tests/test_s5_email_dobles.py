"""Semana 5 del bootcamp — dobles de prueba para correo (SMTP/Resend/Gmail).

Ningún test abre una conexión real: SMTP, Resend, Gmail y el reloj de espera
se sustituyen por dobles. Se verifican asuntos, adjuntos, traducción de
errores y los códigos HTTP del contrato.
"""
import asyncio
import io
import json
import smtplib

import pytest
from fastapi import HTTPException

from app.config import settings
from app.utils import email as email_utils

# `testdb` neutraliza el transporte para TODA la suite. Estas son las
# implementaciones reales conservadas por esa barrera; los casos que prueban
# el armado del mensaje las restauran solo durante su ejecución.
_SYNC_REAL = getattr(email_utils, "_send_email_sync_original", email_utils._send_email_sync)
_ADJUNTO_REAL = getattr(email_utils, "_adjunto_original", email_utils.send_email_with_attachment)
_SEND_REAL = getattr(email_utils, "_send_email_original", email_utils.send_email)


class _RespuestaHttp:
    def __init__(self, payload=None):
        self._payload = json.dumps(payload or {"id": "ok"}).encode()

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class _SMTPFalso:
    fallar_login = False
    fallar_quit = False
    fallar_close = False

    def __init__(self, host, puerto, timeout):
        self.host = host
        self.puerto = puerto
        self.timeout = timeout
        self.iniciado = False
        self.autenticado = None
        self.mensajes = []
        self.cerrado = False
        self.quit_llamado = False

    def starttls(self):
        self.iniciado = True

    def login(self, usuario, password):
        if type(self).fallar_login:
            raise smtplib.SMTPAuthenticationError(535, b"credenciales")
        self.autenticado = (usuario, password)

    def send_message(self, msg):
        self.mensajes.append(msg)

    def quit(self):
        self.quit_llamado = True
        if type(self).fallar_quit:
            raise RuntimeError("quit falló")

    def close(self):
        self.cerrado = True
        if type(self).fallar_close:
            raise RuntimeError("close falló")


def _smtp_falso(monkeypatch, **kwargs):
    for clave, valor in kwargs.items():
        setattr(_SMTPFalso, clave, valor)
    creados = []

    def constructor(host, puerto, timeout):
        s = _SMTPFalso(host, puerto, timeout)
        creados.append(s)
        return s

    monkeypatch.setattr("smtplib.SMTP", constructor)
    return creados


def test_avisar_smtp_sin_credenciales_solo_avisa_si_faltan(monkeypatch, capsys):
    # Arrange
    monkeypatch.setattr(settings, "SMTP_USERNAME", "")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "")
    # Act
    email_utils._avisar_smtp_sin_credenciales()
    # Assert
    assert "SMTP sin credenciales" in capsys.readouterr().out
    # Arrange 2: con credenciales no imprime nada.
    monkeypatch.setattr(settings, "SMTP_USERNAME", "usuario@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "secreto")
    email_utils._avisar_smtp_sin_credenciales()
    assert capsys.readouterr().out == ""


@pytest.mark.parametrize(
    "error,esperado",
    [
        (smtplib.SMTPAuthenticationError(535, b"x"), "credenciales rechazadas"),
        (smtplib.SMTPServerDisconnected("Connection unexpectedly closed"), "el servidor cerró la conexión"),
        (smtplib.SMTPServerDisconnected("otra causa"), "el servidor cerró la conexión: otra causa"),
        (TimeoutError(), "tiempo de espera agotado"),
        (RuntimeError("boom"), "RuntimeError: boom"),
    ],
)
def test_causa_fallo_smtp_traduce_sin_exponer_secretos(error, esperado):
    assert esperado in email_utils._causa_fallo_smtp(error)


def test_send_email_resend_usa_api_y_devuelve_true(monkeypatch):
    # Arrange
    monkeypatch.setattr(settings, "RESEND_FROM_EMAIL", "no-reply@example.com")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test")
    capturado = {}

    def urlopen(req, timeout):
        capturado["url"] = req.full_url
        capturado["auth"] = req.get_header("Authorization")
        capturado["body"] = json.loads(req.data)
        return _RespuestaHttp({"id": "correo-1"})

    monkeypatch.setattr("urllib.request.urlopen", urlopen)
    # Act
    assert email_utils._send_email_resend("cliente@example.com", "Asunto", "<b>Hola</b>") is True
    # Assert
    assert capturado["url"] == "https://api.resend.com/emails"
    assert capturado["auth"] == "Bearer re_test"
    assert capturado["body"]["to"] == ["cliente@example.com"]
    assert capturado["body"]["html"] == "<b>Hola</b>"


def test_send_email_sync_smtp_exitoso_y_fallo(monkeypatch):
    # Arrange: se restaura el transporte real (solo smtplib será un doble).
    monkeypatch.setattr(email_utils, "_send_email_sync", _SYNC_REAL)
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "smtp")
    monkeypatch.setattr(settings, "SMTP_USERNAME", "usuario@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "secreto")
    servidores = _smtp_falso(monkeypatch, fallar_login=False, fallar_quit=False, fallar_close=False)
    # Act
    assert email_utils._send_email_sync("cliente@example.com", "Hola", "<p>ok</p>") is True
    # Assert
    servidor = servidores[0]
    assert servidor.iniciado and servidor.autenticado == ("usuario@example.com", "secreto")
    assert len(servidor.mensajes) == 1 and servidor.quit_llamado
    # Arrange 2: login falla y quit/close también: se conserva el error original.
    servidores = _smtp_falso(monkeypatch, fallar_login=True, fallar_quit=True, fallar_close=True)
    with pytest.raises(smtplib.SMTPAuthenticationError):
        email_utils._send_email_sync("cliente@example.com", "Hola", "<p>ok</p>")
    assert servidores[0].cerrado


def test_send_email_sync_delega_en_resend_y_gmail(monkeypatch):
    # Arrange
    monkeypatch.setattr(email_utils, "_send_email_sync", _SYNC_REAL)
    llamadas = []
    monkeypatch.setattr(email_utils, "_send_email_resend", lambda *a: llamadas.append(("resend", a)) or True)
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "resend")
    # Act
    assert email_utils._send_email_sync("a@example.com", "s", "b") is True
    # Assert
    assert llamadas[0][0] == "resend"
    # Arrange 2: Gmail API se importa dentro de la función.
    gmail = pytest.importorskip("app.utils.gmail_api")
    monkeypatch.setattr(gmail, "send_gmail_api", lambda *a, **kw: llamadas.append(("gmail", a)) or True)
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "gmail_api")
    # Act
    assert email_utils._send_email_sync("a@example.com", "s", "b") is True
    assert llamadas[-1][0] == "gmail"


def test_send_email_exito_timeout_y_error_generico(monkeypatch):
    # Arrange: éxito a través del hilo (con la corrutina real restaurada).
    monkeypatch.setattr(email_utils, "send_email", _SEND_REAL)
    monkeypatch.setattr(email_utils, "_send_email_sync", lambda *a: True)
    assert asyncio.run(email_utils.send_email("a@example.com", "s", "b")) is True
    # Arrange 2: timeout del proveedor → 504 (contexto aislado por rama).
    with monkeypatch.context() as m:
        m.setattr(
            email_utils.asyncio, "wait_for",
            lambda *a, **kw: (_ for _ in ()).throw(asyncio.TimeoutError()),
        )
        with pytest.raises(HTTPException) as exc:
            asyncio.run(email_utils.send_email("a@example.com", "s", "b"))
        assert exc.value.status_code == 504
    # Arrange 3: error genérico → 500; HTTPException propia se propaga.
    with monkeypatch.context() as m:
        m.setattr(
            email_utils, "_send_email_sync",
            lambda *a: (_ for _ in ()).throw(RuntimeError("boom")),
        )
        with pytest.raises(HTTPException) as exc:
            asyncio.run(email_utils.send_email("a@example.com", "s", "b"))
        assert exc.value.status_code == 500
    with monkeypatch.context() as m:
        m.setattr(
            email_utils, "_send_email_sync",
            lambda *a: (_ for _ in ()).throw(HTTPException(status_code=418, detail="tetera")),
        )
        with pytest.raises(HTTPException) as exc:
            asyncio.run(email_utils.send_email("a@example.com", "s", "b"))
        assert exc.value.status_code == 418


def test_send_email_with_attachment_bytes_en_resend(monkeypatch):
    # Arrange: se restaura la implementación real del adjunto.
    monkeypatch.setattr(email_utils, "send_email_with_attachment", _ADJUNTO_REAL)
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "resend")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(settings, "RESEND_FROM_EMAIL", "no-reply@example.com")
    capturado = {}

    def urlopen(req, timeout):
        capturado["body"] = json.loads(req.data)
        return _RespuestaHttp({"id": "adjunto"})

    monkeypatch.setattr("urllib.request.urlopen", urlopen)
    # Act
    ok = asyncio.run(email_utils.send_email_with_attachment(
        "cliente@example.com", "Factura", "<p>Adjunta</p>", io.BytesIO(b"%PDF-1"),
    ))
    # Assert
    assert ok is True
    adjunto = capturado["body"]["attachments"][0]
    assert adjunto["filename"] == "factura.pdf"
    assert adjunto["content"] == "JVBERi0x"  # base64 de %PDF-1


def test_send_email_with_attachment_ruta_gmail_y_smtp(monkeypatch, tmp_path):
    # Arrange: Gmail con ruta de archivo (adjunto real restaurado).
    monkeypatch.setattr(email_utils, "send_email_with_attachment", _ADJUNTO_REAL)
    monkeypatch.setattr(email_utils, "_send_email_sync", _SYNC_REAL)
    archivo = tmp_path / "factura_88.pdf"
    archivo.write_bytes(b"%PDF-2")
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "gmail_api")
    gmail = pytest.importorskip("app.utils.gmail_api")
    llamadas = []
    monkeypatch.setattr(gmail, "send_gmail_api", lambda *a, **kw: llamadas.append(kw) or True)
    # Act
    assert asyncio.run(email_utils.send_email_with_attachment(
        "a@example.com", "Factura", "<p>x</p>", str(archivo),
    )) is True
    # Assert
    assert llamadas[0]["attachment_path"] == str(archivo)
    # Arrange 2: SMTP con BytesIO.
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "smtp")
    servidores = _smtp_falso(monkeypatch, fallar_login=False, fallar_quit=False, fallar_close=False)
    assert asyncio.run(email_utils.send_email_with_attachment(
        "a@example.com", "Factura", "<p>x</p>", io.BytesIO(b"%PDF-3"),
    )) is True
    assert servidores[-1].mensajes
    # Arrange 3: timeout del envío con adjunto.
    monkeypatch.setattr(
        email_utils.asyncio, "wait_for",
        lambda *a, **kw: (_ for _ in ()).throw(asyncio.TimeoutError()),
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(email_utils.send_email_with_attachment(
            "a@example.com", "Factura", "<p>x</p>", io.BytesIO(b"%PDF-4"),
        ))
    assert exc.value.status_code == 504


def test_plantillas_de_verificacion_incluyen_codigo_y_asunto(monkeypatch):
    # Arrange
    enviados = []

    async def falso(correo, asunto, cuerpo):
        enviados.append((correo, asunto, cuerpo))
        return True

    monkeypatch.setattr(email_utils, "send_email", falso)
    # Act
    assert asyncio.run(email_utils.send_verification_email("a@example.com", "123456")) is True
    assert asyncio.run(email_utils.send_email_change_code("a@example.com", "654321")) is True
    assert asyncio.run(email_utils.send_password_reset_code("a@example.com", "112233", "cliente")) is True
    # Assert
    assert "Verifica tu cuenta" in enviados[0][1] and "123456" in enviados[0][2]
    assert "cambiar tu correo" in enviados[1][1] and "654321" in enviados[1][2]
    assert "restablecer tu contraseña" in enviados[2][1] and "112233" in enviados[2][2]
