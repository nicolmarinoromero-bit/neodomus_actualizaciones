#!/usr/bin/env bash
# Restauración de un respaldo .sql.gz de la base de Neodomus (Railway).
#
# ADVERTENCIA: la restauración SOBREESCRIBE el contenido actual de la base
# destino dentro del volcado (--databases incluye CREATE/DROP DATABASE).
# Railway NO revierte la base al hacer rollback de código: si un deploy
# corrió migraciones destructivas, la única vuelta atrás es restaurar un
# respaldo previo con este script.
#
# Uso (Git Bash / WSL):
#   RAILWAY_DB_HOST=... RAILWAY_DB_PORT=... \
#   MYSQL_USER=... MYSQL_PASSWORD=... \
#   BACKUP_FILE=backups/mysql_railway/neodomus_railway_XXXX.sql.gz \
#   ./deploy/scripts/restore_mysql_railway.sh
#
# Prueba en base VACÍA (nunca en la base real):
#   MYSQL_DATABASE=neodomus RESTORE_DATABASE=neodomus_restore_test ... \
#   ./deploy/scripts/restore_mysql_railway.sh
#
# El script pide confirmación escribiendo exactamente: RESTAURAR
set -euo pipefail
set -E
umask 077

RAILWAY_DB_HOST="${RAILWAY_DB_HOST:?Define RAILWAY_DB_HOST}"
RAILWAY_DB_PORT="${RAILWAY_DB_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:?Define MYSQL_USER}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:?Define MYSQL_PASSWORD}"
BACKUP_FILE="${BACKUP_FILE:?Define BACKUP_FILE (ruta del .sql.gz a restaurar)}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:8.0}"

log_info() { printf '[INFO] %s\n' "$*" >&2; }
log_error() { printf '[ERROR] %s\n' "$*" >&2; }

if [ ! -f "${BACKUP_FILE}" ]; then
  log_error "No existe el fichero de respaldo: ${BACKUP_FILE}"
  exit 1
fi
gzip -t "${BACKUP_FILE}" || { log_error "El respaldo está corrupto: ${BACKUP_FILE}"; exit 1; }

# Verificación de integridad opcional: sha256 del fichero.
if [ -n "${EXPECTED_SHA256:-}" ]; then
  ACTUAL=$(sha256sum "${BACKUP_FILE}" | cut -d' ' -f1)
  if [ "${ACTUAL}" != "${EXPECTED_SHA256}" ]; then
    log_error "sha256 no coincide (esperado ${EXPECTED_SHA256}, real ${ACTUAL})"
    exit 1
  fi
  log_info "sha256 verificado OK"
fi

# Base destino. Por defecto la de MYSQL_DATABASE (restauración en producción);
# para pruebas usa una base VACÍA distinta (p. ej. neodomus_restore_test) y
# valida esquema/datos antes de tocar nada real.
RESTORE_DATABASE="${RESTORE_DATABASE:-${MYSQL_DATABASE}}"

printf '%s\n' "Vas a SOBREESCRIBIR la base '${RESTORE_DATABASE}' en ${RAILWAY_DB_HOST}:${RAILWAY_DB_PORT} (usuario ${MYSQL_USER}) con: ${BACKUP_FILE}" >&2
printf '%s\n' "El volcado NO contiene CREATE DATABASE: la base debe existir o se crea vacía a continuación." >&2
printf '%s\n' "Esta acción NO se puede deshacer. Escribe RESTAURAR para continuar: " >&2
read -r CONFIRMACION
if [ "${CONFIRMACION}" != "RESTAURAR" ]; then
  log_info "Cancelado por el operador."
  exit 1
fi

# NOTA: el backend de Railway (juliancc13/neodomus-api o el build de GitHub)
# debe estar DETENIDO o en mantenimiento durante la restauración: un
# servidor activo podría escribir encima del estado recién restaurado.
# En Railway: pestaña Deploy → "Pause"/"Restart" tras terminar.
#
# bash -c con variables pasadas por -e: la expansión ocurre DENTRO del
# contenedor (docker run no expande $ en argv) y el stdin queda reservado
# para el volcado.
MYSQL_PWD="${MYSQL_PASSWORD}" docker run --rm -i \
  -e MYSQL_PWD \
  -e RESTORE_DB_HOST="${RAILWAY_DB_HOST}" \
  -e RESTORE_DB_PORT="${RAILWAY_DB_PORT}" \
  -e RESTORE_DB_USER="${MYSQL_USER}" \
  -e RESTORE_DB_NAME="${RESTORE_DATABASE}" \
  "${MYSQL_IMAGE}" \
  bash -c 'mysql --host="$RESTORE_DB_HOST" --port="$RESTORE_DB_PORT" --user="$RESTORE_DB_USER" --default-character-set=utf8mb4 -e "CREATE DATABASE IF NOT EXISTS \`$RESTORE_DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"; mysql --host="$RESTORE_DB_HOST" --port="$RESTORE_DB_PORT" --user="$RESTORE_DB_USER" --default-character-set=utf8mb4 "$RESTORE_DB_NAME"' \
  < "${BACKUP_FILE}"

log_info "Restauración completada en '${RESTORE_DATABASE}'. Tras apagar/prender el API, valida /health/readiness."
