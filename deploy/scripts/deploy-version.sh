#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/deploy/compose.prod.yaml"
ENV_FILE="${PROJECT_ROOT}/deploy/.env.prod"
BACKUP_SCRIPT="${PROJECT_ROOT}/scripts/backup-restic.sh"
TMP_OVERRIDE=""
DEPLOY_STARTED=false
API_BASE="${GHCR_API_IMAGE:-}"
WEB_BASE="${GHCR_WEB_IMAGE:-}"

usage() {
  cat <<'EOF'
Uso:
  deploy-version.sh --check-only VERSION_NUEVA VERSION_ANTERIOR
  deploy-version.sh --execute VERSION_NUEVA VERSION_ANTERIOR

VERSION usa SemVer X.Y.Z (sin prefijo v). Para ejecutar se requieren:
  GHCR_API_IMAGE, GHCR_WEB_IMAGE, RESTIC_REPOSITORY, RESTIC_PASSWORD_FILE,
  SMOKE_EMAIL, SMOKE_PASSWORD y SCHEMA_COMPATIBILITY_CONFIRMED=yes.

Las migraciones no se ejecutan en este script. Revise/aplique manualmente
migraciones backward-compatible antes de desplegar; no use downgrade automático.
EOF
}

log() { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 2; }

valid_version() {
  [[ "$1" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]
}

valid_image_base() {
  [[ "$1" =~ ^ghcr\.io/[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*$ ]]
}

write_override() {
  local version=$1
  TMP_OVERRIDE="$(mktemp "${TMPDIR:-/tmp}/neodomus-compose.XXXXXX.yaml")"
  cat > "$TMP_OVERRIDE" <<EOF
services:
  api:
    image: ${API_BASE}:${version}
  migrate:
    image: ${API_BASE}:${version}
  web:
    image: ${WEB_BASE}:${version}
EOF
  chmod 600 "$TMP_OVERRIDE"
}

compose_base() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

compose_version() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -f "$TMP_OVERRIDE" "$@"
}

wait_healthy() {
  local version=$1 service id status
  for service in api web; do
    id="$(compose_version "$version" ps -q "$service")"
    [[ -n "$id" ]] || { log "No se encontró el contenedor de ${service}."; return 1; }
    status=starting
    for _ in {1..90}; do
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$id" 2>/dev/null || true)"
      [[ "$status" == healthy ]] && break
      [[ "$status" != unhealthy && "$status" != missing ]] || break
      sleep 3
    done
    [[ "$status" == healthy ]] || { log "${service} no está saludable (estado=${status})."; return 1; }
    local expected actual
    if [[ "$service" == api ]]; then expected="${API_BASE}:${version}"; else expected="${WEB_BASE}:${version}"; fi
    actual="$(docker inspect --format '{{.Config.Image}}' "$id")"
    [[ "$actual" == "$expected" ]] || { log "La imagen activa de ${service} no coincide con la versión solicitada."; return 1; }
  done
  curl --fail --silent --show-error --max-time 15 http://127.0.0.1:8080/health/readiness >/dev/null
  SMOKE_EMAIL="$SMOKE_EMAIL" SMOKE_PASSWORD="$SMOKE_PASSWORD" \
    bash "${PROJECT_ROOT}/scripts/smoke-test.sh" http://127.0.0.1:8080
}

rollback() {
  local previous=$1
  log "Restaurando las imágenes existentes ${previous}; no se reconstruyen ni se alteran volúmenes."
  write_override "$previous"
  compose_version up -d --no-build api web
  wait_healthy "$previous"
}

on_error() {
  local status=$1 line=$2
  trap - ERR
  if [[ "$DEPLOY_STARTED" == true ]]; then
    log "Falló la actualización (línea ${line}); inicio rollback de aplicación."
    if rollback "$PREVIOUS_VERSION"; then
      log 'Rollback de aplicación verificado. La base de datos no fue revertida.'
    else
      log 'ERROR: rollback automático falló; requiere intervención del operador.'
    fi
  fi
  exit "$status"
}

[[ $# -eq 3 ]] || { usage; exit 2; }
MODE=$1
NEW_VERSION=$2
PREVIOUS_VERSION=$3
[[ "$MODE" == --check-only || "$MODE" == --execute ]] || { usage; exit 2; }
valid_version "$NEW_VERSION" || fail 'VERSION_NUEVA debe usar SemVer X.Y.Z.'
valid_version "$PREVIOUS_VERSION" || fail 'VERSION_ANTERIOR debe usar SemVer X.Y.Z.'
[[ "$NEW_VERSION" != "$PREVIOUS_VERSION" ]] || fail 'Las dos versiones deben ser distintas.'
valid_image_base "$API_BASE" || fail 'GHCR_API_IMAGE debe ser una ruta base ghcr.io/owner/image sin tag.'
valid_image_base "$WEB_BASE" || fail 'GHCR_WEB_IMAGE debe ser una ruta base ghcr.io/owner/image sin tag.'

for command_name in docker curl; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Falta dependencia: ${command_name}."
done
[[ -f "$COMPOSE_FILE" && -f "$BACKUP_SCRIPT" ]] || fail 'Faltan archivos Compose o de respaldo del repositorio.'

if [[ "$MODE" == --check-only ]]; then
  log "Validación de argumentos superada para ${PREVIOUS_VERSION} -> ${NEW_VERSION}; no se modificó ningún servicio."
  exit 0
fi

[[ -f "$ENV_FILE" ]] || fail 'Falta deploy/.env.prod; créelo desde la plantilla en el servidor.'
[[ -n "${RESTIC_REPOSITORY:-}" && -r "${RESTIC_PASSWORD_FILE:-}" ]] || fail 'Configura Restic mediante el entorno seguro del servicio de despliegue.'
[[ -n "${SMOKE_EMAIL:-}" && -n "${SMOKE_PASSWORD:-}" ]] || fail 'Configura la cuenta sintética de smoke test desde el gestor de secretos.'
[[ "${SCHEMA_COMPATIBILITY_CONFIRMED:-}" == yes ]] || fail 'Confirma compatibilidad backward-compatible del esquema tras revisar/aplicar migraciones aprobadas.'

trap 'on_error "$?" "$LINENO"' ERR
compose_base config --quiet
compose_base ps
for image in "${API_BASE}:${NEW_VERSION}" "${WEB_BASE}:${NEW_VERSION}" \
             "${API_BASE}:${PREVIOUS_VERSION}" "${WEB_BASE}:${PREVIOUS_VERSION}"; do
  docker pull "$image"
done

# No inicia despliegue si el snapshot no puede completarse.
bash "$BACKUP_SCRIPT"
write_override "$NEW_VERSION"
DEPLOY_STARTED=true
compose_version up -d --no-build api web
wait_healthy "$NEW_VERSION"
DEPLOY_STARTED=false
log "Versión ${NEW_VERSION} desplegada y verificada."

trap - EXIT
if [[ -n "$TMP_OVERRIDE" ]]; then rm -f -- "$TMP_OVERRIDE"; fi
