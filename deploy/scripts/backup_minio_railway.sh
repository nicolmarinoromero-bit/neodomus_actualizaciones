#!/usr/bin/env bash
# Respaldo del almacenamiento S3-compatible de Neodomus (Railway).
#
# Copia (mc mirror --overwrite) los buckets público y privado a un directorio
# local. NO borra nada ni en origen ni en destino (sin --remove).
#
# Uso:
#   MINIO_ENDPOINT=<host>:<puerto> \
#   MINIO_ACCESS_KEY=... MINIO_SECRET_KEY=... \
#   [MINIO_SECURE=false] [MINIO_BUCKET=neodomus-media] [MINIO_PRIVATE_BUCKET=neodomus-private] \
#   [BACKUP_DIR=backups/minio] [MINIO_IMAGE=elestio/minio:latest] \
#   ./deploy/scripts/backup_minio_railway.sh
set -euo pipefail
set -E
umask 077

MINIO_ENDPOINT="${MINIO_ENDPOINT:?Define MINIO_ENDPOINT}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:?Define MINIO_ACCESS_KEY}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:?Define MINIO_SECRET_KEY}"
MINIO_SECURE="${MINIO_SECURE:-false}"
MINIO_BUCKET="${MINIO_BUCKET:-neodomus-media}"
MINIO_PRIVATE_BUCKET="${MINIO_PRIVATE_BUCKET:-neodomus-private}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups/minio}"
MINIO_IMAGE="${MINIO_IMAGE:-elestio/minio:latest}"

log_info() { printf '[INFO] %s\n' "$*" >&2; }
log_error() { printf '[ERROR] %s\n' "$*" >&2; }

STAMP="$(date -u '+%Y%m%d_%H%M%S')"
SCHEMA='http'
if [ "${MINIO_SECURE}" = 'true' ]; then
  SCHEMA='https'
fi
for BUCKET in "${MINIO_BUCKET}" "${MINIO_PRIVATE_BUCKET}"; do
  DEST="${BACKUP_DIR}/${BUCKET}/${STAMP}"
  mkdir -p -- "${DEST}"
  log_info "Mirror ${BUCKET} -> ${DEST}"
  docker run --rm \
    --entrypoint mc \
    -e MC_HOST_neodomus="${SCHEMA}://${MINIO_ACCESS_KEY}:${MINIO_SECRET_KEY}@${MINIO_ENDPOINT}" \
    -v "${DEST}:/data" \
    "${MINIO_IMAGE}" \
    mirror --overwrite "neodomus/${BUCKET}" "/data/${BUCKET}"
done

log_info "Respaldo de storage OK en ${BACKUP_DIR} (espejo por bucket). Copia a un segundo destino."
