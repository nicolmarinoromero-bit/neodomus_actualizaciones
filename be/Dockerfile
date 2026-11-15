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

USER appuser

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
