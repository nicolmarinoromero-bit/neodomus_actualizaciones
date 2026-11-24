#!/usr/bin/env bash
# Respaldo de la base MySQL de PRODUCCIÓN (Railway) a un volcado .sql.gz.
#
# Se ejecuta desde cualquier máquina con Docker (Git Bash/WSL/CI): lanza un
# contenedor efímero mysql:8.0 con mysqldump apuntando al host/proxy de la
# base de Railway. Credenciales SOLO por variables de entorno; nunca se
# imprimen ni se escriben en el dump.
#
# Uso (Git Bash / WSL):
#   RAILWAY_DB_HOST=mysql.railway.internal \
#   RAILWAY_DB_PORT=3306 \
#   MYSQL_USER=neodomus MYSQL_PASSWORD=... MYSQL_DATABASE=neodomus \
#   ./deploy/scripts/backup_mysql_railway.sh
#
# Localmente usa el dominio PÚBLICO del proxy TCP de Railway (Settings →
# Networking → TCP Proxy); desde un job dentro de Railway usa el host
# interno (p. ej. mysql.railway.internal:3306).
#
# Requisitos de permisos: el usuario del dump necesita SELECT. Se usa
# --no-tablespaces para no exigir PROCESS (Railway otorga usuarios
# restringidos). --single-transaction evita bloqueos (InnoDB).
set -euo pipefail
set -E
umask 077

RAILWAY_DB_HOST="${RAILWAY_DB_HOST:?Define RAILWAY_DB_HOST (dominio del proxy TCP o host interno de Railway)}"
RAILWAY_DB_PORT="${RAILWAY_DB_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:?Define MYSQL_USER}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:?Define MYSQL_PASSWORD}"
MYSQL_DATABASE="${MYSQL_DATABASE:?Define MYSQL_DATABASE (p. ej. neodomus)}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups/mysql_railway}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:8.0}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

log_info() { printf '[INFO] %s\n' "$*" >&2; }
log_error() { printf '[ERROR] %s\n' "$*" >&2; }

mkdir -p -- "${BACKUP_DIR}"
TIMESTAMP="$(date -u '+%Y%m%d_%H%M%S')"
DUMP_FILE="${BACKUP_DIR}/neodomus_railway_${TIMESTAMP}.sql.gz"

log_info "Respaldo de ${MYSQL_DATABASE} desde ${RAILWAY_DB_HOST}:${RAILWAY_DB_PORT} (usuario ${MYSQL_USER})"

# MYSQL_PWD por entorno del contenedor: la contraseña no aparece en argv
# ni en la línea de comandos visible. La imagen mysql:8.0 trae mysqldump
# en PATH, así que se usa como comando directamente.
#
# SIN el flag --databases: el volcado no contiene CREATE DATABASE/USE, así
# que puede restaurarse en la base de origen o en OTRA base de pruebas
# (RESTORE_DATABASE en restore_mysql_railway.sh) sin sobreescribir nada
# por accidente.
MYSQL_PWD="${MYSQL_PASSWORD}" docker run --rm -i \
  -e MYSQL_PWD \
  "${MYSQL_IMAGE}" \
  mysqldump \
    --host="${RAILWAY_DB_HOST}" \
    --port="${RAILWAY_DB_PORT}" \
    --user="${MYSQL_USER}" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --set-gtid-purged=OFF \
    --no-tablespaces \
    --default-character-set=utf8mb4 \
    "${MYSQL_DATABASE}" \
  | gzip > "${DUMP_FILE}"

# Un dump vacío o truncado (p. ej. red cortada) no es un respaldo: se
# valida tamaño mínimo (el esquema de Neodomus supera de sobra 1 KB) y
# que gzip no reporte corrupción.
SIZE=$(wc -c < "${DUMP_FILE}")
if [ "${SIZE}" -lt 1024 ]; then
  log_error "Dump sospechosamente pequeño (${SIZE} bytes); NO se considera válido: ${DUMP_FILE}"
  exit 1
fi
gzip -t "${DUMP_FILE}" || { log_error "Dump corrupto: ${DUMP_FILE}"; exit 1; }

SHA=$(sha256sum "${DUMP_FILE}" | cut -d' ' -f1)
log_info "Respaldo OK: ${DUMP_FILE} (${SIZE} bytes, sha256=${SHA})"

# Retención: borra respaldos locales anteriores a N días (el fichero en
# Railway/proveedor no se toca).
find "${BACKUP_DIR}" -name 'neodomus_railway_*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete >&2 || true
