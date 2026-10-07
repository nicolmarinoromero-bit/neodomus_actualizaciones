"""
Conftest de pruebas del backend Neodomus.

Aísla las pruebas en una base de datos MySQL dedicada (neodomus_test):

* Antes de importar la aplicación, apunta DATABASE_URL a la BD de
  pruebas (pydantic-settings da prioridad a las variables de entorno
  sobre el archivo .env).
* Aplica las migraciones reales de Alembic sobre la BD de pruebas.
* Siembra los catálogos mínimos (tipos de documento, roles).
* Limpia todas las tablas entre test (TRUNCATE con FK checks off).
* Stubea infraestructura externa (SMTP, MinIO, respaldo de init_db.sql)
  y reinicia el rate limiter, sin tocar la lógica de negocio.

Ejecución (desde la raíz del repo):

    docker compose exec api uv run pytest
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# ── 1. Ruta del backend y BD de pruebas ANTES de importar app ──
BE_DIR = Path(__file__).resolve().parents[2]  # .../be
if str(BE_DIR) not in sys.path:
    sys.path.insert(0, str(BE_DIR))

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "mysql+pymysql://neodomus:neodomus123@db:3306/neodomus_test?charset=utf8mb4",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
# SMTP vacío: ningún envío real sale de la suite (los sends están stubeados).
os.environ["SMTP_HOST"] = ""
os.environ["ENVIRONMENT"] = "development"

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from alembic import command
from alembic.config import Config

# Importar la app UNA vez (settings ya apuntan a la BD de pruebas).
from app.main import app as fastapi_app  # noqa: E402
from app.database import Base, engine, get_db  # noqa: E402
from app.utils.security import hash_password  # noqa: E402
from app.middleware.rate_limit import limiter  # noqa: E402

# Importa todos los modelos para que Base.metadata conozca todas las tablas.
import app.models  # noqa: E402, F401

TODAS_LAS_TABLAS = [t.name for t in reversed(Base.metadata.sorted_tables)]


# ──────────────────────────────────────────────────────────────
# Sesión: migraciones + catálogos (se ejecuta una sola vez)
# ──────────────────────────────────────────────────────────────
@pytest.fixture(scope="session", autouse=True)
def _preparar_base_de_pruebas():
    """Aplica las migraciones de Alembic en la BD de pruebas y siembra
    los catálogos que init_db.sql normalmente provee."""
    alembic_cfg = Config(str(BE_DIR / "alembic.ini"))
    command.upgrade(alembic_cfg, "head")

    with engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        # Catálogos mínimos (mismos valores que init_db.sql).
        conn.execute(
            text("INSERT IGNORE INTO tipos_documento (id_tipo_documento, nombre_tipo) "
                 "VALUES (1, 'cc'), (2, 'ce')")
        )
        conn.execute(
            text("INSERT IGNORE INTO roles_usuario (id_rol, nombre_rol) "
                 "VALUES (1, 'administrador'), (2, 'tecnico')")
        )
        conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    yield


@pytest.fixture(scope="session")
def db_session_factory():
    from sqlalchemy.orm import sessionmaker
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ──────────────────────────────────────────────────────────────
# Limpieza entre tests + stubs de infraestructura externa
# ──────────────────────────────────────────────────────────────
@pytest.fixture(autouse=True)
def _limpiar_y_stubear(db_session_factory, monkeypatch):
    """Autouse: vacía las tablas después de cada test y stubea
    SMTP / MinIO / respaldo de init_db.sql / rate limiter."""
    # Rate limiter en memoria: reiniciarlo evita 429 entre tests.
    limiter.reset()

    # SMTP: ningún correo sale de la suite de pruebas.
    async def _sin_email(*args, **kwargs):
        return True

    import app.utils.email as email_mod
    import app.services.auth_service as auth_service_mod
    import app.services.factura_service as factura_service_mod

    for nombre in ("send_email", "send_verification_email",
                   "send_password_reset_code", "send_email_change_code",
                   "send_email_with_attachment"):
        monkeypatch.setattr(email_mod, nombre, _sin_email, raising=False)
    # auth_service y factura_service importaron estos nombres a su módulo.
    for nombre in ("send_verification_email", "send_password_reset_code",
                   "send_email_change_code"):
        monkeypatch.setattr(auth_service_mod, nombre, _sin_email, raising=False)
    monkeypatch.setattr(factura_service_mod, "send_email", _sin_email, raising=False)

    # respaldar_usuarios() reescribiría scripts/init_db.sql con datos
    # de prueba: se desactiva para toda la suite.
    import app.services.auth_service as auth_svc
    import app.routers.users as users_router
    monkeypatch.setattr(auth_svc, "respaldar_usuarios", lambda: True)
    monkeypatch.setattr(users_router, "respaldar_usuarios", lambda: True)

    # MinIO: subidas/eliminaciones simuladas (no toca el bucket real).
    import app.services.minio_service as minio_mod
    monkeypatch.setattr(
        minio_mod, "subir_imagen",
        lambda carpeta, nombre, contenido: f"http://test-minio:9000/neodomus-media/{carpeta}/{nombre}",
    )
    monkeypatch.setattr(minio_mod, "eliminar_objeto", lambda objeto: None)

    yield

    # Limpieza: vaciar todas las tablas (los endpoints hacen commit
    # propio, por eso no se usa rollback de transacción).
    with engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        for tabla in TODAS_LAS_TABLAS:
            conn.execute(text(f"TRUNCATE TABLE `{tabla}`"))
        # Re-sembrar catálogos truncados.
        conn.execute(
            text("INSERT IGNORE INTO tipos_documento (id_tipo_documento, nombre_tipo) "
                 "VALUES (1, 'cc'), (2, 'ce')")
        )
        conn.execute(
            text("INSERT IGNORE INTO roles_usuario (id_rol, nombre_rol) "
                 "VALUES (1, 'administrador'), (2, 'tecnico')")
        )
        conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))


# ──────────────────────────────────────────────────────────────
# Clientes HTTP y sesión de BD
# ──────────────────────────────────────────────────────────────
@pytest.fixture()
def db(db_session_factory):
    """Sesión de BD por test (la app la usa vía override de get_db)."""
    session = db_session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db):
    """AsyncClient de httpx con la dependencia get_db sobreescrita."""
    def _override_get_db():
        yield db

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    try:
        # ASGITransport: ejecuta la app sin levantar el lifespan
        # (el scheduler de fondo no arranca en las pruebas).
        yield AsyncClient(
            transport=ASGITransport(app=fastapi_app),
            base_url="http://test",
        )
    finally:
        fastapi_app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────
# Fábricas y helpers de autenticación (ver app/tests/factories.py)
# Se importan con alias para mantener los nombres usados por los fixtures.
# ──────────────────────────────────────────────────────────────
from app.tests.factories import (  # noqa: E402
    crear_cliente as _crear_cliente,
    crear_empleado as _crear_empleado,
    crear_tecnico as _crear_tecnico,
    crear_categoria as _crear_categoria,
    crear_producto as _crear_producto,
    login as _login,
    auth_headers,
)


@pytest.fixture()
async def cliente_logueado(client, db):
    """Cliente creado + tokens reales obtenidos por /auth/login."""
    c = _crear_cliente(db)
    tokens = await _login(client, c.email, "Test1234!", "client")
    return c, tokens


@pytest.fixture()
async def admin_logueado(client, db):
    """Empleado administrador + tokens reales."""
    u = _crear_empleado(db, rol="administrador")
    tokens = await _login(client, u.email, "Test1234!", "employee")
    return u, tokens


@pytest.fixture()
async def tecnico_logueado(client, db):
    """Técnico (ficha + usuario) + tokens reales."""
    u = _crear_empleado(db, rol="tecnico")
    t = _crear_tecnico(db, usuario=u)
    tokens = await _login(client, u.email, "Test1234!", "employee")
    return u, t, tokens

