"""
Pruebas de las migraciones de Alembic sobre la BD de pruebas (MySQL real).

Cubre:

(a) ``alembic_version`` apunta al ``head`` del repositorio.
(b) ``alembic upgrade head`` es idempotente sobre la BD ya migrada.
(c) Generación de SQL en modo OFFLINE (sin conectarse a la BD) para
    revisiones concretas, y documentación del hallazgo de que generar el
    SQL completo ``head`` falla (las migraciones usan introspección de la
    propia BD para ser idempotentes).
(d) ``alembic downgrade -1`` + ``alembic upgrade head`` sobre la sesión de
    BD de pruebas. Es SEGURO: la última revisión (0057) solo añade/quita
    la columna ``productos.color_hex``, tabla que está vacía entre tests
    (el conftest TRUNCATEa todas las tablas), y no toca los catálogos
    sembrados (``roles_usuario`` / ``tipos_documento``).

Seguridad: dentro de pytest, ``be/conftest.py`` fija ``DATABASE_URL`` a la
BD de pruebas ANTES de importar ``app``; ``alembic/env.py`` toma la URL de
``app.config.settings``, así que las migraciones corren siempre contra la
BD de pruebas y nunca contra la BD de producción (``neodomus``).
"""

from __future__ import annotations

import io
import os
from contextlib import redirect_stdout
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text

from app.config import settings
from app.database import engine

# be/ (donde vive alembic.ini)
BE_DIR = Path(__file__).resolve().parents[2]


def _cfg() -> Config:
    """Configuración de Alembic apuntando a be/alembic.ini (recién creada
    en cada uso: Config es mutable y lo usamos para volcar SQL)."""
    return Config(str(BE_DIR / "alembic.ini"))


def _head() -> str:
    return ScriptDirectory.from_config(_cfg()).get_current_head()


def _version_actual() -> str | None:
    """Versión registrada en la tabla alembic_version de la BD de pruebas."""
    with engine.connect() as conn:
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar()


def _columnas(tabla: str) -> set[str]:
    with engine.connect() as conn:
        filas = conn.execute(
            text(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t"
            ),
            {"t": tabla},
        )
        return {f[0] for f in filas}


def _conteo(sql: str) -> int:
    with engine.connect() as conn:
        return int(conn.execute(text(sql)).scalar() or 0)


# ──────────────────────────────────────────────────────────────
# (0) Guardia de seguridad: la URL es la de PRUEBAS, no la de producción
# ──────────────────────────────────────────────────────────────
def test_config_de_alembic_apunta_a_la_bd_de_pruebas():
    """Guardia previa a cualquier migración: settings (y por lo tanto
    alembic/env.py) deben apuntar a la BD de pruebas."""
    url = settings.DATABASE_URL
    assert "neodomus_test" in url, f"DATABASE_URL no es la BD de pruebas: {url}"
    assert "3306/neodomus?" not in url, "Nunca se migra contra la BD de producción"
    assert url == os.environ.get("DATABASE_URL")


# ──────────────────────────────────────────────────────────────
# (a) alembic_version -> head
# ──────────────────────────────────────────────────────────────
def test_alembic_version_apunta_a_head():
    """La BD de pruebas está exactamente en la revisión head del repo."""
    head = _head()
    assert head is not None
    with engine.connect() as conn:
        versiones = [f[0] for f in conn.execute(text("SELECT version_num FROM alembic_version"))]
    assert versiones == [head], f"alembic_version={versiones}, head={head}"


# ──────────────────────────────────────────────────────────────
# (b) upgrade head idempotente
# ──────────────────────────────────────────────────────────────
def test_upgrade_head_es_idempotente():
    """Volver a ejecutar `alembic upgrade head` sobre la BD ya migrada no
    falla ni cambia la versión (no hay operaciones pendientes)."""
    head = _head()
    assert _version_actual() == head

    command.upgrade(_cfg(), "head")  # segunda corrida: sin error

    assert _version_actual() == head
    # El esquema sigue completo (la migración más reciente añade color_hex).
    assert "color_hex" in _columnas("productos")


# ──────────────────────────────────────────────────────────────
# (c) SQL en modo offline (sin conectarse)
# ──────────────────────────────────────────────────────────────
def test_sql_offline_de_upgrade_entre_revisiones():
    """`alembic upgrade 0052:0053 --sql` imprime el CREATE TABLE sin tocar
    la BD (sale por stdout y alembic_version no cambia)."""
    buf = io.StringIO()
    with redirect_stdout(buf):
        command.upgrade(_cfg(), "0052:0053", sql=True)
    sql = buf.getvalue()

    assert "CREATE TABLE evidencias_novedad" in sql
    assert "FOREIGN KEY(id_novedad) REFERENCES novedades" in sql
    assert "UPDATE alembic_version SET version_num='0053'" in sql
    # El modo offline NO modifica la BD: seguimos en head.
    assert _version_actual() == _head()


def test_sql_offline_de_downgrade_entre_revisiones():
    """`alembic downgrade 0053:0052 --sql` imprime el DROP TABLE sin tocar
    la BD."""
    buf = io.StringIO()
    with redirect_stdout(buf):
        command.downgrade(_cfg(), "0053:0052", sql=True)
    sql = buf.getvalue()

    assert "DROP TABLE evidencias_novedad" in sql
    assert _version_actual() == _head()


def test_sql_offline_completo_hasta_head_falla_documentado():
    """HALLAZGO (comportamiento ACTUAL): generar el SQL offline de TODO el
    historial (`upgrade head --sql`) falla con AttributeError porque las
    migraciones de datos/introspección (p. ej. 0001) hacen
    `op.get_bind().execute(SELECT ...).scalar()` y en modo offline ese
    execute no devuelve resultado.

    El intento NO llega a conectarse a la BD: alembic_version y el esquema
    quedan intactos (solo se emite SQL parcial por stdout)."""
    buf = io.StringIO()
    with redirect_stdout(buf):
        with pytest.raises(AttributeError):
            command.upgrade(_cfg(), "head", sql=True)

    # Sí emitió SQL parcial antes de fallar (creación de alembic_version).
    assert "CREATE TABLE alembic_version" in buf.getvalue()
    # La BD de pruebas no se tocó.
    assert _version_actual() == _head()


# ──────────────────────────────────────────────────────────────
# (d) downgrade un paso + upgrade head
# ──────────────────────────────────────────────────────────────
def test_downgrade_un_paso_y_upgrade_head():
    """`alembic downgrade -1` y `alembic upgrade head` sobre la BD de pruebas.

    SEGURO en este repo: -1 solo revierte la 0057 (drop_column de
    `productos.color_hex`); la tabla `productos` está vacía entre tests y
    los catálogos sembrados (roles/tipos_documento) no se ven afectados.
    El bloque `finally` garantiza que la BD quede siempre en head."""
    head = _head()
    # NOTA (hallazgo): ScriptDirectory no tiene get_previous_head; la revisión
    # anterior se obtiene como el down_revision de la revisión head.
    anterior = ScriptDirectory.from_config(_cfg()).get_revision(head).down_revision
    assert anterior is not None
    assert _version_actual() == head
    assert "color_hex" in _columnas("productos")

    try:
        command.downgrade(_cfg(), "-1")
        assert _version_actual() == anterior
        assert "color_hex" not in _columnas("productos")
    finally:
        command.upgrade(_cfg(), "head")

    assert _version_actual() == head
    assert "color_hex" in _columnas("productos")
    # Los catálogos sembrados por el conftest sobreviven al ciclo completo.
    assert _conteo("SELECT COUNT(*) FROM roles_usuario") >= 2
    assert _conteo("SELECT COUNT(*) FROM tipos_documento") >= 2
