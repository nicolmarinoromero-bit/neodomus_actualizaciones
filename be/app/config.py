import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import ConfigDict, model_validator


# El Client ID de OAuth es público, así que se usa como valor por defecto para
# que el login con Google funcione al clonar el proyecto sin configurar .env.
DEFAULT_GOOGLE_SIGNIN_CLIENT_ID = (
    "230717458999-qlm6dpfl8ui8idqfupgfr8lou9k48i0f.apps.googleusercontent.com"
)


class Settings(BaseSettings):
    """
    Configuración central de la aplicación.
    Las variables se cargan desde el archivo .env y las variables de entorno del sistema.
    """
    
    # --- Base de datos ---
    # La contraseña no se hardcodea: se lee de .env / variables de entorno.
    # Optional[str] (y no str = "") para no declarar una credencial MySQL por
    # defecto en el código (Sonar S6697); None equivale a "sin contraseña".
    MYSQL_USER: str = "neodomus"
    MYSQL_PASSWORD: Optional[str] = None
    MYSQL_DATABASE: str = "neodomus"
    DB_HOST: str = "db"
    DB_PORT: int = 3306
    DATABASE_URL: Optional[str] = None
    
    # --- JWT y seguridad ---
    SECRET_KEY: str = "clave_super_segura_para_desarrollo_cambiar_en_produccion"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # --- Verificación de email y recuperación de contraseña ---
    VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24
    # NUEVA variable en MINUTOS para el código de recuperación
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 10   # 10 minutos por defecto
    # Opcional: se mantiene por compatibilidad, pero ya no se usa
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 1
    
    # --- SMTP (Gmail) ---
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""

    # --- Proveedor de correo ---
    # EMAIL_PROVIDER="smtp": SMTP clásico (SMTP_HOST/PORT/USERNAME/PASSWORD).
    # EMAIL_PROVIDER="gmail_api": Gmail API con OAuth 2.0.
    # EMAIL_PROVIDER="resend": Resend API (requiere RESEND_API_KEY).
    EMAIL_PROVIDER: str = "smtp"
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "Neodomus <onboarding@resend.dev>"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REFRESH_TOKEN: str = ""
    GOOGLE_SIGNIN_CLIENT_ID: str = DEFAULT_GOOGLE_SIGNIN_CLIENT_ID

    # --- Pasarela de pagos ---
    # PAYMENT_PROVIDER="simulator" (por defecto): simulador académico local,
    # sin credenciales ni registro de empresa.
    PAYMENT_PROVIDER: str = "simulator"

    # --- Notificaciones al cliente por cambios de técnico ---
    # False: cuando el administrador modifica/desactiva un técnico (y eso
    # reasigna citas o entregas), el cliente NO recibe aviso.
    NOTIFICAR_CLIENTE_CAMBIOS_TECNICO: bool = False

    # --- MinIO (almacenamiento de imágenes) ---
    # MINIO_ENDPOINT: host:puerto para conectar desde la API (dentro de Docker: minio:9000).
    # MINIO_PUBLIC_ENDPOINT: URL que reciben los navegadores para cargar las imágenes.
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "neodomus"
    MINIO_SECRET_KEY: str = "neodomus12345"
    MINIO_BUCKET: str = "neodomus-media"
    MINIO_PUBLIC_ENDPOINT: str = "http://localhost:9000"
    MINIO_SECURE: bool = False
    # Bucket PRIVADO para evidencias y adjuntos del negocio (sin lectura anónima).
    # El bucket público MINIO_BUCKET sigue sirviendo solo el catálogo de productos.
    MINIO_PRIVATE_BUCKET: str = "neodomus-private"

    # --- Frontend URLs ---
    FRONTEND_URL: str = "http://localhost:5173"
    FRONTEND_VERIFY_EMAIL_PATH: str = "/verify-email"
    FRONTEND_RESET_PASSWORD_PATH: str = "/reset-password"
    CORS_ORIGINS: str = ""

    # --- Rate limiting y proxies de confianza ---
    # En producción con varios workers/procesos conviene un almacenamiento
    # compartido (p. ej. redis://...) para que los contadores sean globales;
    # "memory://" mantiene un contador por proceso.
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_STORAGE_URI: str = "memory://"
    RATE_LIMIT_HEADERS_ENABLED: bool = True
    # IPs/CIDR de los proxies autorizados a enviar X-Forwarded-For/Proto.
    # Vacío = no se confía en ninguna cabecera. "*" confía en todos: úsalo
    # solo cuando la API no sea accesible directamente por los clientes.
    TRUSTED_PROXIES: str = "127.0.0.1,::1"

    # --- Entorno ---
    ENVIRONMENT: str = "development"  # development, staging, production
    LOG_LEVEL: str = "INFO"

    @model_validator(mode="after")
    def _aplicar_google_signin_por_defecto(self):
        """Usa el Client ID público si la variable llega vacía (p. ej. Docker Compose)."""
        if not self.GOOGLE_SIGNIN_CLIENT_ID:
            self.GOOGLE_SIGNIN_CLIENT_ID = DEFAULT_GOOGLE_SIGNIN_CLIENT_ID
        return self

    @model_validator(mode="after")
    def _validate_production_secrets(self):
        """Fail-fast en producción si quedan secretos de desarrollo."""
        if self.ENVIRONMENT == "production":
            insecure_key = "clave_super_segura_para_desarrollo_cambiar_en_produccion"
            if self.SECRET_KEY == insecure_key or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "SECRET_KEY insegura en producción: genera con `openssl rand -hex 32` y configura en .env"
                )
            if (
                not self.MYSQL_PASSWORD
                or len(self.MYSQL_PASSWORD) < 12
                or self.MYSQL_PASSWORD.strip().lower().startswith(("change_me", "cambiar", "replace_me"))
            ):
                raise ValueError(
                    "MYSQL_PASSWORD insegura en producción: usa al menos 12 caracteres y configúrala en .env"
                )
            if (
                len(self.MINIO_SECRET_KEY) < 32
                or self.MINIO_SECRET_KEY.strip().lower().startswith(("change_me", "cambiar", "replace_me"))
                or self.MINIO_SECRET_KEY == "neodomus12345"
            ):
                raise ValueError("MINIO_SECRET_KEY insegura o placeholder en producción; usa una clave aleatoria de al menos 32 caracteres")
        return self
    
    model_config = ConfigDict(
        # Se carga `.env` del directorio de ejecución y, como respaldo para
        # arranques locales desde `be/` (sin Docker), el `.env` de la raíz del
        # repositorio. Los archivos ausentes se ignoran; el primero que defina
        # una variable tiene precedencia.
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


def validate_startup_settings() -> None:
    """Valida las variables imprescindibles antes de abrir conexiones."""
    required = {
        "DATABASE_URL": settings.DATABASE_URL,
        "SECRET_KEY": settings.SECRET_KEY,
    }
    missing = [name for name, value in required.items() if not value or not value.strip()]
    if missing:
        raise RuntimeError(
            "Configuración incompleta: faltan variables obligatorias "
            f"{', '.join(missing)}. Define estas variables en .env o en el entorno."
        )

    if not settings.DATABASE_URL.startswith("mysql+pymysql://"):
        raise RuntimeError(
            "DATABASE_URL no compatible: NEODOMUS utiliza actualmente "
            "MySQL mediante mysql+pymysql. PostgreSQL requiere adaptar y validar "
            "el esquema y las migraciones antes de usarlo."
        )
    secret_key = settings.SECRET_KEY.strip()
    if (
        secret_key == "clave_super_segura_para_desarrollo_cambiar_en_produccion"
        or secret_key.lower().startswith(("genera_", "cambiar", "change_me", "replace_me"))
    ):
        raise RuntimeError(
            "SECRET_KEY conserva el valor de ejemplo. Genera una clave aleatoria "
            "(por ejemplo, `openssl rand -hex 32`) y configúrala en .env."
        )
    if settings.ENVIRONMENT == "production" and not settings.MYSQL_PASSWORD:
        raise RuntimeError("MYSQL_PASSWORD es obligatoria en producción.")
    if settings.ENVIRONMENT == "production" and len(settings.MINIO_SECRET_KEY) < 12:
        raise RuntimeError("MINIO_SECRET_KEY debe tener al menos 12 caracteres en producción.")
    if settings.ENVIRONMENT == "production" and not settings.CORS_ORIGINS.strip():
        raise RuntimeError("CORS_ORIGINS es obligatoria en producción.")
    if settings.ENVIRONMENT == "production" and "*" in settings.CORS_ORIGINS:
        raise RuntimeError("CORS_ORIGINS no debe incluir el comodín '*' en producción.")
    if settings.ENVIRONMENT == "production" and len(settings.SECRET_KEY) < 32:
        raise RuntimeError("SECRET_KEY debe tener al menos 32 caracteres en producción.")
    if settings.LOG_LEVEL.upper() not in {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}:
        raise RuntimeError("LOG_LEVEL debe ser CRITICAL, ERROR, WARNING, INFO o DEBUG.")


# Instancia única para importar en otros módulos
settings = Settings()
