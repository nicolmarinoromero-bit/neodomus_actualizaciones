#!/usr/bin/env bash
set -euo pipefail

base=${1:-http://localhost:8080}
base=${base%/}
product_id=${2:-10}
failures=0

check_http() {
  local label=$1 url=$2 expected=${3:-200} actual
  actual=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --connect-timeout 5 --max-time 15 "$url") || actual=000
  printf '%-32s HTTP %s (esperado %s)\n' "$label" "$actual" "$expected"
  if [[ "$actual" != "$expected" ]]; then failures=$((failures + 1)); fi
}

date -Iseconds
check_http 'Web / (estático)' "$base/"
check_http 'Web producto (SPA)' "$base/producto/$product_id"
check_http 'Liveness' "$base/health"
check_http 'Readiness' "$base/health/readiness"
check_http 'OpenAPI JSON' "$base/openapi.json"
check_http 'Listado de productos' "$base/api/v1/productos/"
check_http 'Producto de referencia' "$base/api/v1/productos/$product_id"

if [[ -z "${SMOKE_EMAIL:-}" || -z "${SMOKE_PASSWORD:-}" ]]; then
  printf '%s\n' 'ERROR: define SMOKE_EMAIL y SMOKE_PASSWORD para validar autenticación.' >&2
  failures=$((failures + 1))
else
  token=$(python -c 'import json,os; print(json.dumps({"email":os.environ["SMOKE_EMAIL"],"password":os.environ["SMOKE_PASSWORD"]}))' |
    curl --silent --show-error --fail --connect-timeout 5 --max-time 15 \
      -H 'Content-Type: application/json' --data-binary @- "$base/api/v1/auth/login" |
      python -c 'import json,sys; print(json.load(sys.stdin).get("access_token", ""))') || token=''
  if [[ -n "$token" ]]; then
    printf '%-32s OK\n' 'Autenticación de prueba'
    session_code=$(python -c 'import json,sys; print("header = " + json.dumps("Authorization: Bearer " + sys.stdin.read().strip()))' <<< "$token" |
      curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
        --connect-timeout 5 --max-time 15 --config - "$base/api/v1/auth/session") || session_code=000
    printf '%-32s HTTP %s (esperado 200)\n' 'Sesión autenticada' "$session_code"
    if [[ "$session_code" != 200 ]]; then failures=$((failures + 1)); fi
  else
    printf '%-32s ERROR\n' 'Autenticación de prueba'
    failures=$((failures + 1))
  fi
  unset token
fi

if (( failures > 0 )); then
  printf 'Smoke test fallido: %s verificación(es) con error.\n' "$failures" >&2
  exit 1
fi
printf '%s\n' 'Smoke test completado correctamente.'
