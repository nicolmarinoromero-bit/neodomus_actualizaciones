FROM python:3.12-slim AS builder

# uv se instala desde PyPI en lugar de copiarse de la imagen oficial de
# ghcr.io, que provocaba "TLS handshake timeout" en Docker Desktop cuando
# hay bloqueo o lentitud de red hacia ghcr.io (firewall/ISP).
# Versión fija (S8544: dependencia bloqueada; 0.13.5 escribe uv.lock
# revision = 5) y --only-binary :all: (S8541: nunca ejecuta setup.py; uv
# publica wheels binarios oficiales para linux/amd64).
RUN pip install --no-cache-dir --only-binary :all: "uv==0.13.5"

WORKDIR /app

COPY pyproject.toml uv.lock ./

COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./

# --locked: respeta uv.lock; --no-build evita ejecutar backends de build de
# dependencias; --no-build-isolation conserva el entorno de build controlado.
RUN uv sync --no-dev --locked --no-build --no-build-isolation --no-install-project

FROM python:3.12-slim AS runtime

WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y --no-install-recommends \
    && useradd --create-home --uid 1000 appuser \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv
COPY --chown=appuser:appuser app/ ./app/
COPY --chown=appuser:appuser alembic/ ./alembic/
COPY --chown=appuser:appuser alembic.ini ./
COPY --chown=appuser:appuser scripts ./scripts

USER appuser

EXPOSE 8000

# Arranque de producción SIN migraciones: Railway ejecuta `alembic upgrade
# head` como comando pre-deploy (fallo del pre-deploy aborta el deploy).
# Ejecutarlas también en cada arranque duplicaría el trabajo y, con más de
# una réplica, lanzaría migraciones concurrentes contra la misma base.
# API_PORT fija el puerto de escucha (Railway: Target Port = 8000); el
# despliegue local (docker-compose.yml) ya define su propio `command:`.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${API_PORT:-8000}"]
