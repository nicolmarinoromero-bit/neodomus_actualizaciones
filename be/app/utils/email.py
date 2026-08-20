"""
Módulo: utils/email.py
Funciones para envío de correos electrónicos (verificación de registro, recuperación
de contraseña, facturas y notificaciones) mediante SMTP o la Gmail API.
"""

import smtplib
import asyncio
from pathlib import Path

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings
from fastapi import HTTPException


def _from_email() -> str:
    return settings.SMTP_USERNAME


def _send_email_resend(to_email: str, subject: str, body: str) -> bool:
    """Envía email usando la API de Resend (REST, sin SMTP)."""
    import json
    import urllib.request

    payload = json.dumps({
        "from": settings.RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": body,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        print(f"Resend response: {result}")
    return True


def _send_email_sync(to_email: str, subject: str, body: str) -> bool:
    """Parte bloqueante del envío (se ejecuta en un hilo).

    Usa el proveedor configurado en EMAIL_PROVIDER:
      - "resend": Resend API (REST, sin SMTP).
      - "gmail_api": Gmail API con OAuth 2.0 (sin SMTP).
      - cualquier otro: SMTP clásico.
    """
    if settings.EMAIL_PROVIDER == "resend":
        return _send_email_resend(to_email, subject, body)

    if settings.EMAIL_PROVIDER == "gmail_api":
        from app.utils.gmail_api import send_gmail_api

        return send_gmail_api(to_email, subject, body)

    msg = MIMEMultipart()
    msg['From'] = _from_email()
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))

    server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
    server.starttls()
    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
    server.send_message(msg)
    server.quit()
    return True


async def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Envía un correo electrónico por SMTP.
    Retorna True si se envió correctamente, False en caso de error.

    El trabajo bloqueante (conexión y transmisión SMTP) se ejecuta en un hilo de
    trabajo para no bloquear el event loop (crítico cuando muchos usuarios
    compran a la vez).
    """
    try:
        return await asyncio.to_thread(_send_email_sync, to_email, subject, body)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error enviando email a {to_email}: {e}")
        raise HTTPException(
            status_code=500,
            detail="No se pudo enviar el correo. Revisa la configuración SMTP en el archivo .env.",
        ) from e


async def send_email_with_attachment(
    to_email: str,
    subject: str,
    body: str,
    pdf_path: str,
) -> bool:
    """
    Envía un correo con un archivo PDF adjunto (facturas) por SMTP.
    """
    from email.mime.application import MIMEApplication

    def _sync():
        from pathlib import Path as _Path

        if settings.EMAIL_PROVIDER == "resend":
            import json
            import base64
            import urllib.request

            with open(pdf_path, 'rb') as f:
                pdf_b64 = base64.b64encode(f.read()).decode("utf-8")

            payload = json.dumps({
                "from": settings.RESEND_FROM_EMAIL,
                "to": [to_email],
                "subject": subject,
                "html": body,
                "attachments": [{
                    "filename": f"factura_{_Path(pdf_path).stem}.pdf",
                    "content": pdf_b64,
                }],
            }).encode("utf-8")

            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=payload,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                print(f"Resend response: {result}")
            return True

        if settings.EMAIL_PROVIDER == "gmail_api":
            from app.utils.gmail_api import send_gmail_api

            return send_gmail_api(to_email, subject, body, attachment_path=pdf_path)

        msg = MIMEMultipart()
        msg['From'] = _from_email()
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))

        try:
            with open(pdf_path, 'rb') as f:
                adjunto = MIMEApplication(f.read(), _subtype='pdf')
                adjunto.add_header(
                    'Content-Disposition',
                    'attachment',
                    filename=f"factura_{_Path(pdf_path).stem}.pdf",
                )
                msg.attach(adjunto)
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="No se encontró el archivo de la factura para adjuntar")

        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True

    return await asyncio.to_thread(_sync)


# ============================================================
# 1. Verificación de registro (bienvenida a Neodomus)
# ============================================================
async def send_verification_email(to_email: str, code: str) -> bool:
    """
    Envía el código de 6 dígitos para verificar el registro de un nuevo cliente.
    Incluye un mensaje de bienvenida a Neodomus.
    """
    subject = "Bienvenido a Neodomus - Verifica tu cuenta"

    body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Verificación de registro</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <h1 style="color: #2c3e50; text-align: center;">¡Bienvenido a Neodomus!</h1>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">Gracias por registrarte en <strong>Neodomus</strong>, tu plataforma de domótica inteligente.</p>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">Para activar tu cuenta, utiliza el siguiente código de verificación:</p>
            <div style="background-color: #ecf0f1; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
                {code}
            </div>
            <p style="font-size: 14px; color: #7f8c8d;">Este código expira en {settings.VERIFICATION_TOKEN_EXPIRE_HOURS} horas.</p>
            <p style="font-size: 14px; color: #7f8c8d;">Si no solicitaste este registro, ignora este mensaje.</p>
            <hr style="margin: 30px 0;">
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">Neodomus - Innovación para tu hogar</p>
        </div>
    </body>
    </html>
    """

    return await send_email(to_email, subject, body)


# ============================================================
# 3. Cambio de correo electrónico (código de verificación)
# ============================================================
async def send_email_change_code(to_email: str, code: str) -> bool:
    """
    Envía el código de 6 dígitos para verificar el cambio de correo.
    Se envía al correo actual de la cuenta para confirmar la identidad.
    """
    subject = "Neodomus - Código para cambiar tu correo electrónico"

    body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Cambio de correo electrónico</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <h1 style="color: #2c3e50; text-align: center;">Cambio de correo electrónico</h1>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">Hemos recibido una solicitud para cambiar el correo electrónico de tu cuenta en <strong>Neodomus</strong>.</p>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">Utiliza el siguiente código de 6 dígitos para confirmar el cambio:</p>
            <div style="background-color: #ecf0f1; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
                {code}
            </div>
            <p style="font-size: 14px; color: #7f8c8d;">Este código expira en {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutos.</p>
            <p style="font-size: 14px; color: #7f8c8d;">Si no solicitaste este cambio, ignora este mensaje. Tu correo actual seguirá activo.</p>
            <hr style="margin: 30px 0;">
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">Neodomus - Seguridad y confianza</p>
        </div>
    </body>
    </html>
    """

    return await send_email(to_email, subject, body)


# ============================================================
# 2. Recuperación de contraseña (código de restablecimiento)
# ============================================================
async def send_password_reset_code(to_email: str, code: str, user_type: str) -> bool:
    """
    Envía el código de 6 dígitos para restablecer la contraseña.
    """
    subject = "Neodomus - Código para restablecer tu contraseña"

    body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Recuperación de contraseña</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <h1 style="color: #2c3e50; text-align: center;">Restablece tu contraseña</h1>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>Neodomus</strong>.</p>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">Utiliza el siguiente código de 6 dígitos:</p>
            <div style="background-color: #ecf0f1; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
                {code}
            </div>
            <p style="font-size: 14px; color: #7f8c8d;">Este código expira en {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutos.</p>
            <p style="font-size: 14px; color: #7f8c8d;">Si no solicitaste este cambio, ignora este mensaje. Tu contraseña actual permanecerá activa.</p>
            <hr style="margin: 30px 0;">
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">Neodomus - Seguridad y confianza</p>
        </div>
    </body>
    </html>
    """

    return await send_email(to_email, subject, body)