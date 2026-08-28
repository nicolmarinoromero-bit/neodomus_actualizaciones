import json
# PARA: Importa el módulo json para convertir diccionarios en cadenas JSON.
# IMPACTO: Permite estructurar los registros de auditoría como JSON, facilitando su procesamiento por sistemas de análisis de logs.

import logging
# PARA: Importa el módulo logging para generar mensajes de registro (logs).
# IMPACTO: Se usa para enviar mensajes de auditoría a través del sistema de logging de Python, permitiendo configurar diferentes destinos (consola, archivo, etc.).

from datetime import datetime, timezone
# PARA: Importa datetime y timezone para manejar fechas y horas con zona horaria UTC.
# IMPACTO: Asegura que todas las marcas de tiempo de auditoría estén en UTC, facilitando la comparación y estandarización de eventos.

from typing import Literal, Optional
# PARA: Importa Literal (para valores fijos) y Optional (para valores que pueden ser None).
# IMPACTO: Mejora las anotaciones de tipo, documentando qué valores esperan los parámetros (ej. user_type solo puede ser "employee" o "client").

security_logger = logging.getLogger("security.audit")
# PARA: Crea (u obtiene) un logger con el nombre "security.audit".
# IMPACTO: Permite separar los logs de auditoría de otros logs de la aplicación, facilitando su filtrado y enrutamiento.

if not security_logger.handlers:
# PARA: Verifica si el logger ya tiene manejadores (handlers) configurados para evitar duplicar configuración.
# IMPACTO: Previene añadir múltiples manejadores al logger si el módulo se importa varias veces, evitando mensajes duplicados.

    _handler = logging.StreamHandler()
# PARA: Crea un manejador que envía los logs a la consola (stderr).
# IMPACTO: Los mensajes de auditoría se mostrarán en la salida estándar de errores, útil para desarrollo y depuración.

    _handler.setFormatter(logging.Formatter("[AUDIT] %(message)s"))
# PARA: Configura el formato de los mensajes, anteponiendo "[AUDIT] " al contenido del mensaje (que será el JSON).
# IMPACTO: Los logs de auditoría aparecerán con un prefijo claro, fácilmente identificable y grepeable.

    security_logger.addHandler(_handler)
# PARA: Agrega el manejador al logger.
# IMPACTO: A partir de ahora, los mensajes del logger security_logger se enviarán a la consola.

    security_logger.setLevel(logging.WARNING)
# PARA: Establece el nivel mínimo de severidad del logger como WARNING.
# IMPACTO: Solo se registrarán mensajes de nivel WARNING o superior. Los niveles inferiores (INFO, DEBUG) se ignoran. Esto evita ruido en entornos de producción, ya que los eventos de auditoría suelen ser importantes.

def _audit(event: str, **kwargs: object) -> None:
# PARA: Función privada que construye una entrada de auditoría con timestamp, evento y argumentos adicionales, la convierte a JSON y la envía al logger como un mensaje de advertencia.
# IMPACTO: Centraliza toda la lógica de generación de logs de auditoría, evitando duplicación de código. Cada función pública llamará a esta.

    log_entry = {"timestamp": datetime.now(timezone.utc).isoformat(), "event": event, **kwargs}
# PARA: Crea un diccionario con la marca de tiempo UTC en formato ISO, el nombre del evento y todos los kwargs adicionales.
# IMPACTO: Todos los registros de auditoría tienen una estructura uniforme, incluyendo timestamp preciso, lo que permite ordenarlos cronológicamente.

    security_logger.warning(json.dumps(log_entry, default=str))
# PARA: Convierte el diccionario a JSON (usando default=str para serializar objetos no serializables) y lo envía al logger como mensaje de nivel WARNING.
# IMPACTO: El mensaje se escribe como JSON en una línea, fácil de parsear por herramientas de análisis. El nivel WARNING hace que siempre se registre.

def log_login_success(email: str, user_type: Literal["employee", "client"], ip: Optional[str] = None) -> None:
    _audit("LOGIN_SUCCESS", email=_redact_email(email), user_type=user_type, ip=ip)
# PARA: Registra un inicio de sesión exitoso, ofuscando el email antes de incluirlo en el log.
# IMPACTO: Permite auditar accesos correctos sin exponer el email completo, cumpliendo con privacidad de datos. Útil para detectar accesos anómalos.

def log_login_failed(email: str, reason: str, user_type: Optional[Literal["employee", "client"]] = None, ip: Optional[str] = None) -> None:
    kwargs = {"email": _redact_email(email), "reason": reason, "ip": ip}
    if user_type:
        kwargs["user_type"] = user_type
    _audit("LOGIN_FAILED", **kwargs)
# PARA: Registra un intento de inicio de sesión fallido, con la razón del fallo (ej. credenciales incorrectas, cuenta inactiva) y opcionalmente el tipo de usuario.
# IMPACTO: Ayuda a identificar intentos de fuerza bruta o problemas de autenticación. El email se ofusca para privacidad.

def log_password_changed(identifier: str, user_type: Literal["employee", "client"], ip: Optional[str] = None) -> None:
    _audit("PASSWORD_CHANGED", identifier=identifier, user_type=user_type, ip=ip)
# PARA: Registra un cambio de contraseña exitoso, usando un identificador (puede ser ID del usuario o email ofuscado, según la implementación).
# IMPACTO: Permite rastrear modificaciones de credenciales, útil para detectar cambios no autorizados. No se usa email para evitar exponer datos.

def log_password_reset_requested(email: Optional[str] = None, user_type: Optional[Literal["employee", "client"]] = None, ip: Optional[str] = None) -> None:
    kwargs = {"ip": ip}
    if email:
        kwargs["email"] = _redact_email(email)
    if user_type:
        kwargs["user_type"] = user_type
    _audit("PASSWORD_RESET_REQUESTED", **kwargs)
# PARA: Registra la solicitud de restablecimiento de contraseña, incluyendo email (ofuscado) y tipo de usuario solo si están disponibles.
# IMPACTO: Útil para auditar cuántos restablecimientos se solicitan y desde qué IP. El email es opcional porque si el email no existe, no se incluye (por seguridad, no se revela si el email está registrado).

def log_email_verified(email: str, user_type: Literal["client"] = "client", ip: Optional[str] = None) -> None:
    _audit("EMAIL_VERIFIED", email=_redact_email(email), user_type=user_type, ip=ip)
# PARA: Registra la verificación exitosa de un email (por defecto para clientes, pero puede extenderse).
# IMPACTO: Permite saber cuándo un usuario completa el registro verificando su correo. El email se ofusca.

def log_rate_limit_hit(endpoint: str, ip: Optional[str] = None) -> None:
    _audit("RATE_LIMIT_HIT", endpoint=endpoint, ip=ip)
# PARA: Registra cuando un cliente supera los límites de tasa de peticiones (rate limiting).
# IMPACTO: Ayuda a detectar ataques de denegación de servicio o bots. Incluye el endpoint afectado y la IP.

def _redact_email(email: str) -> str:
# PARA: Función privada que ofusca un email para proteger la privacidad en los logs.
# IMPACTO: Transforma "usuario@dominio.com" en "us***@dominio.com" (primeras dos letras, asteriscos, dominio). Si el email tiene formato inválido, retorna "***". Cumple con políticas de protección de datos (GDPR, etc.).

    if "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    if len(local) <= 1:
        return f"*@{domain}"
    if len(local) <= 2:
        return f"{local[0]}*@{domain}"
    return f"{local[:2]}{'*' * (len(local) - 2)}@{domain}"
# PARA: Implementa diferentes niveles de ofuscación según la longitud de la parte local del email.
# IMPACTO: Muestra las primeras dos letras (o solo la primera si es muy corto) y el dominio completo, ocultando el resto. Esto permite identificar al usuario sin exponer el email completo en los logs.