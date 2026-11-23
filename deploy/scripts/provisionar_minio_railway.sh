#!/usr/bin/env bash
# Provisión del almacenamiento S3-compatible de Neodomus (Railway).
#
# Crea los buckets con la política correcta:
#   - MINIO_BUCKET        (público: catálogo de productos)  → lectura anónima
#   - MINIO_PRIVATE_BUCKET (evidencias, privadas)           → SIN política
#
# Idempotente: puede re-ejecutarse. No toca objetos existentes.
#
# Uso:
#   MINIO_ENDPOINT=<host>:<puerto> \
#   MINIO_ACCESS_KEY=... MINIO_SECRET_KEY=... \
#   [MINIO_SECURE=true|false] [MINIO_BUCKET=neodomus-media] \
#   [MINIO_PRIVATE_BUCKET=neodomus-private] \
#   ./deploy/scripts/provisionar_minio_railway.sh
set -euo pipefail
set -E

MINIO_ENDPOINT="${MINIO_ENDPOINT:?Define MINIO_ENDPOINT (host:puerto o dominio)}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:?Define MINIO_ACCESS_KEY}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:?Define MINIO_SECRET_KEY}"
MINIO_SECURE="${MINIO_SECURE:-false}"
MINIO_BUCKET="${MINIO_BUCKET:-neodomus-media}"
MINIO_PRIVATE_BUCKET="${MINIO_PRIVATE_BUCKET:-neodomus-private}"
MINIO_IMAGE="${MINIO_IMAGE:-elestio/minio:latest}"

if [ "${MINIO_BUCKET}" = "${MINIO_PRIVATE_BUCKET}" ]; then
  echo "[ERROR] MINIO_BUCKET y MINIO_PRIVATE_BUCKET deben ser distintos" >&2
  exit 1
fi

log_info() { printf '[INFO] %s\n' "$*" >&2; }

# Alias efímero dentro del contenedor; la imagen elestio/minio trae 'mc'.
# El entrypoint de la imagen es 'minio server', así que se invoca con
# --entrypoint (flag ANTES de la imagen). La configuración vive en /tmp del
# contenedor (nada persistente en el host).
SCHEMA='http'
if [ "${MINIO_SECURE}" = 'true' ]; then
  SCHEMA='https'
fi

log_info "Provisionando ${MINIO_BUCKET} (público) y ${MINIO_PRIVATE_BUCKET} (privado) en ${MINIO_ENDPOINT}"
docker run --rm \
  --entrypoint /bin/sh \
  -e MC_HOST_neodomus="${SCHEMA}://${MINIO_ACCESS_KEY}:${MINIO_SECRET_KEY}@${MINIO_ENDPOINT}" \
  "${MINIO_IMAGE}" -c '
    set -e
    mc mb --ignore-existing neodomus/"${MINIO_BUCKET}"
    mc mb --ignore-existing neodomus/"${MINIO_PRIVATE_BUCKET}"
    mc anonymous set download neodomus/"${MINIO_BUCKET}"
    echo "[INFO] Política anónima de DESCARGA aplicada solo al bucket público"
    echo "[INFO] Buckets:"
    mc ls neodomus | sed "s/^/  /"
  '

log_info "Provisión OK (idempotente). /health/readiness del API podrá validar el storage."
