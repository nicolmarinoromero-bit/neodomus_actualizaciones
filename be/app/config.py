import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    """
    Configuración central de la aplicación.
    Las variables se cargan desde el archivo .env y las variables de entorno del sistema.
    """
    
    # --- Base de datos ---
    DATABASE_URL: str = "mysql+pymysql://neodomus:neodomus123@db:3306/neodomus?charset=utf8mb4"
    
    # --- JWT y seguridad ---
    SECRET_KEY: str = "clave_super_segura_para_desarrollo_cambiar_en_produccion"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # --- Verificación de email y recuperación de contraseña ---
    VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24
    # 🔥 NUEVA variable en MINUTOS para el código de recuperación
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
    GOOGLE_SIGNIN_CLIENT_ID: str = ""

    # --- Pasarela de pagos ---
    # PAYMENT_PROVIDER="simulator" (por defecto): simulador académico local,
    # sin credenciales ni registro de empresa.
    PAYMENT_PROVIDER: str = "simulator"

    # --- Frontend URLs ---
    FRONTEND_URL: str = "http://localhost:5173"
    FRONTEND_VERIFY_EMAIL_PATH: str = "/verify-email"
    FRONTEND_RESET_PASSWORD_PATH: str = "/reset-password"
    
    # --- Entorno ---
    ENVIRONMENT: str = "development"  # development, staging, production
    
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


# Instancia única para importar en otros módulos
settings = Settings()