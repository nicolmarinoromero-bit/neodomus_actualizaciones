#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Requiere restic, gzip, sha256sum y docker (modo predeterminado: BD en Compose).
# Configuración mediante entorno/archivo root-only; nunca pasar contraseñas en argv.
: "${RESTIC_PASSWORD_FILE:?Defina RESTIC_PASSWORD_FILE (archivo chmod 600)}"
: "${RESTIC_REPOSITORY:?Defina RESTIC_REPOSITORY local (p. ej. /var/backups/neodomus)}"
: "${MYSQL_HOST:=127.0.0.1}"
: "${MYSQL_PORT:=3306}"
: "${MYSQL_DATABASE:=neodomus}"
: "${MYSQL_USER:=neodomus_backup_runtime}"
: "${MYSQL_DUMP_MODE:=docker}"
: "${MYSQL_DOCKER_CONTAINER:=neodomus-prod-db-1}"
: "${MYSQL_PASSWORD_FILE:=}"
: "${BACKUP_INCLUDE_MINIO_VOLUME:=true}"
: "${MINIO_DOCKER_CONTAINER:=neodomus-prod-minio-1}"
: "${API_DOCKER_CONTAINER:=neodomus-prod-api-1}"
: "${BACKUP_SOURCE_DIR:=/opt/neodomus}"
: "${BACKUP_WORK_DIR:=/var/tmp/neodomus-backup}"
: "${BACKUP_EXTRA_PATHS:=}"
: "${RESTIC_OFFSITE_REPOSITORY:=}"

for cmd in restic gzip sha256sum; do
  command -v "$cmd" >/dev/null || { echo "Falta dependencia: $cmd" >&2; exit 127; }
done
[[ -r "$RESTIC_PASSWORD_FILE" && -s "$RESTIC_PASSWORD_FILE" ]] || { echo 'RESTIC_PASSWORD_FILE no legible/vacío' >&2; exit 2; }
[[ -d "$BACKUP_SOURCE_DIR" ]] || { echo "No existe BACKUP_SOURCE_DIR: $BACKUP_SOURCE_DIR" >&2; exit 2; }

mkdir -p "$BACKUP_WORK_DIR"
chmod 700 "$BACKUP_WORK_DIR"
tmpdir=$(mktemp -d "$BACKUP_WORK_DIR/run.XXXXXX")
api_was_running=false
minio_was_running=false
wait_healthy() {
  local container=$1 status
  for _ in {1..45}; do
    status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container" 2>/dev/null || true)
    [[ "$status" == healthy ]] && return 0
    sleep 2
  done
  echo "ERROR: $container no alcanzó estado healthy tras reanudarlo" >&2
  return 1
}
restore_services() {
  local failed=0
  if [[ "$minio_was_running" == true ]]; then
    if docker start "$MINIO_DOCKER_CONTAINER" >/dev/null; then
      minio_was_running=false
      wait_healthy "$MINIO_DOCKER_CONTAINER" || failed=1
    else
      echo 'ERROR: no se pudo reanudar MinIO' >&2
      failed=1
    fi
  fi
  if [[ "$api_was_running" == true ]]; then
    if docker start "$API_DOCKER_CONTAINER" >/dev/null; then
      api_was_running=false
      wait_healthy "$API_DOCKER_CONTAINER" || failed=1
    else
      echo 'ERROR: no se pudo reanudar API' >&2
      failed=1
    fi
  fi
  return "$failed"
}
cleanup() {
  restore_services || true
  rm -rf -- "$tmpdir"
}
trap cleanup EXIT

if [[ "$BACKUP_INCLUDE_MINIO_VOLUME" == true ]]; then
  command -v docker >/dev/null || { echo 'MinIO backup requiere docker' >&2; exit 127; }
  api_running=$(docker inspect --format '{{.State.Running}}' "$API_DOCKER_CONTAINER")
  minio_running=$(docker inspect --format '{{.State.Running}}' "$MINIO_DOCKER_CONTAINER")
  [[ "$api_running" == true || "$api_running" == false ]] || { echo 'No se pudo identificar el estado de API' >&2; exit 2; }
  [[ "$minio_running" == true || "$minio_running" == false ]] || { echo 'No se pudo identificar el estado de MinIO' >&2; exit 2; }
  api_was_running="$api_running"
  minio_was_running="$minio_running"
  echo "$(date -Is) Pausando escrituras: deteniendo API y MinIO para un punto consistente."
  [[ "$api_was_running" != true ]] || docker stop --time 30 "$API_DOCKER_CONTAINER" >/dev/null
  [[ "$minio_was_running" != true ]] || docker stop --time 30 "$MINIO_DOCKER_CONTAINER" >/dev/null
fi

export RESTIC_PASSWORD_FILE
dump="$tmpdir/${MYSQL_DATABASE}.sql.gz"
case "$MYSQL_DUMP_MODE" in
  docker)
    command -v docker >/dev/null || { echo 'Falta dependencia: docker' >&2; exit 127; }
    docker exec -i "$MYSQL_DOCKER_CONTAINER" sh -c \
      'MYSQL_PWD="$MYSQL_BACKUP_PASSWORD" exec mysqldump --protocol=TCP --host=127.0.0.1 --user="$MYSQL_BACKUP_USER" --single-transaction --routines --triggers --events --hex-blob --no-tablespaces --default-character-set=utf8mb4 "$MYSQL_DATABASE"' \
      | gzip -9 > "$dump"
    ;;
  local)
    command -v mysqldump >/dev/null || { echo 'Falta dependencia: mysqldump' >&2; exit 127; }
    [[ -r "$MYSQL_PASSWORD_FILE" && -s "$MYSQL_PASSWORD_FILE" ]] || { echo 'MYSQL_PASSWORD_FILE no legible/vacío' >&2; exit 2; }
    MYSQL_PWD="$(<"$MYSQL_PASSWORD_FILE")" mysqldump --protocol=TCP --host="$MYSQL_HOST" --port="$MYSQL_PORT" \
      --user="$MYSQL_USER" --single-transaction --routines --triggers --events --no-tablespaces \
      --hex-blob --default-character-set=utf8mb4 "$MYSQL_DATABASE" | gzip -9 > "$dump"
    ;;
  *) echo 'MYSQL_DUMP_MODE debe ser docker o local' >&2; exit 2 ;;
esac
gzip -t "$dump"
sha256sum "$dump" > "$tmpdir/${MYSQL_DATABASE}.sql.gz.sha256"

paths=("$dump" "$tmpdir/${MYSQL_DATABASE}.sql.gz.sha256" "$BACKUP_SOURCE_DIR")
if [[ "$BACKUP_INCLUDE_MINIO_VOLUME" == true ]]; then
  mkdir -p "$tmpdir/minio-data"
  docker cp "$MINIO_DOCKER_CONTAINER:/data/." "$tmpdir/minio-data/"
  [[ -n "$(find "$tmpdir/minio-data" -mindepth 1 -print -quit)" ]] || { echo 'La copia del volumen MinIO quedó vacía' >&2; exit 1; }
  (cd "$tmpdir/minio-data" && find . -type f -print0 | sort -z | xargs -0 -r sha256sum) > "$tmpdir/minio-data.sha256"
  paths+=("$tmpdir/minio-data" "$tmpdir/minio-data.sha256")
  restore_services
  api_was_running=false
  minio_was_running=false
  echo "$(date -Is) API/MinIO reanudados; copia consistente de objetos preparada."
fi
if [[ -n "$BACKUP_EXTRA_PATHS" ]]; then
  # Delimitar con ':'; no admite nombres de ruta que contengan ':' .
  IFS=: read -r -a extra_paths <<< "$BACKUP_EXTRA_PATHS"
  for path in "${extra_paths[@]}"; do [[ -e "$path" ]] && paths+=("$path") || { echo "Ruta adicional inexistente: $path" >&2; exit 2; }; done
fi

export RESTIC_REPOSITORY
restic backup --host "$(hostname -f 2>/dev/null || hostname)" --tag neodomus --tag daily \
  --exclude '**/.env' --exclude '**/.env.*' --exclude '**/backup.env' \
  --exclude '**/restic-password' --exclude '**/mysql-backup-password' --exclude '**/.ssh/**' \
  "${paths[@]}"
restic forget --host "$(hostname -f 2>/dev/null || hostname)" --tag neodomus \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune

# Copia independiente a repositorio externo (S3/B2 vía RESTIC_OFFSITE_REPOSITORY).
if [[ -n "$RESTIC_OFFSITE_REPOSITORY" ]]; then
  restic copy --from-repo "$RESTIC_REPOSITORY" --repo "$RESTIC_OFFSITE_REPOSITORY"
fi
echo "Backup restic completado; SHA-256 dump: $(cut -d' ' -f1 "$tmpdir/${MYSQL_DATABASE}.sql.gz.sha256"); SHA-256 manifest MinIO: $(sha256sum "$tmpdir/minio-data.sha256" | cut -d' ' -f1)"
