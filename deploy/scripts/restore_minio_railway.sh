#!/usr/bin/env bash
# Restauración del almacenamiento S3-compatible de Neodomus (Railway).
#
# Devuelve los objetos de un respaldo local a los buckets. Reglas:
#   - --overwrite: los objetos respaldados vuelven a subirse.
#   - SIN --remove: los objetos presentes en el storage que NO están en el
#     respaldo NO se borran (nunca se destruyen escrituras nuevas).
#
# Uso:
#   MINIO_ENDPOINT=... MINIO_ACCESS_KEY=... MINIO_SECRET_KEY=... \
#   [MINIO_SECURE=false] [MINIO_BUCKET=neodomus-media] [MINIO_PRIVATE_BUCKET=neodomus-private] \
#   BACKUP_DIR=backups/minio/20261118_154500 \
#   ./deploy/scripts/restore_minio_railway.sh
set -euo pipefail
set -E

MINIO_ENDPOINT="${MINIO_ENDPOINT:?Define MINIO_ENDPOINT}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:?Define MINIO_ACCESS_KEY}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:?Define MINIO_SECRET_KEY}"
MINIO_SECURE="${MINIO_SECURE:-false}"
MINIO_BUCKET="${MINIO_BUCKET:-neodomus-media}"
MINIO_PRIVATE_BUCKET="${MINIO_PRIVATE_BUCKET:-neodomus-private}"
BACKUP_DIR="${BACKUP_DIR:?Define BACKUP_DIR (directorio del espejo con fecha, p. ej. backups/minio/20261118_154500)}"
MINIO_IMAGE="${MINIO_IMAGE:-elestio/minio:latest}"

log_info() { printf '[INFO] %s\n' "$*" >&2; }

for BUCKET in "${MINIO_BUCKET}" "${MINIO_PRIVATE_BUCKET}"; do
  if [ ! -d "${BACKUP_DIR}/${BUCKET}" ]; then
    echo "[ERROR] No existe ${BACKUP_DIR}/${BUCKET}" >&2
    exit 1
  fi
done

printf '%s\n' "Vas a restaurar el storage desde ${BACKUP_DIR} hacia ${MINIO_ENDPOINT}." >&2
printf '%s\n' "Se SOBREESCRIBEN los objetos del respaldo; los demás NO se borran." >&2
printf '%s\n' "Escribe RESTAURAR para continuar: " >&2
read -r CONFIRMACION
if [ "${CONFIRMACION}" != "RESTAURAR" ]; then
  log_info "Cancelado por el operador."
  exit 1
fi

SCHEMA='http'
if [ "${MINIO_SECURE}" = 'true' ]; then
  SCHEMA='https'
fi

for BUCKET in "${MINIO_BUCKET}" "${MINIO_PRIVATE_BUCKET}"; do
  log_info "Mirror ${BACKUP_DIR}/${BUCKET} -> neodomus/${BUCKET}"
  docker run --rm \
    --entrypoint mc \
    -e MC_HOST_neodomus="${SCHEMA}://${MINIO_ACCESS_KEY}:${MINIO_SECRET_KEY}@${MINIO_ENDPOINT}" \
    -v "${BACKUP_DIR}/${BUCKET}:/data" \
    "${MINIO_IMAGE}" \
    mirror --overwrite "/data/${BUCKET}" "neodomus/${BUCKET}"
done

log_info "Restauración de storage OK. Valida /health/readiness y una imagen del catálogo."
