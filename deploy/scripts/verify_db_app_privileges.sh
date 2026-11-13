#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${MYSQL_HOST:=127.0.0.1}"
: "${MYSQL_PORT:=3306}"
: "${MYSQL_DATABASE:=neodomus}"
: "${MYSQL_APP_USER:?Defina MYSQL_APP_USER}"
: "${MYSQL_APP_PASSWORD:?Defina MYSQL_APP_PASSWORD}"
: "${MYSQL_OWNER_USER:?Defina MYSQL_OWNER_USER}"
: "${MYSQL_OWNER_PASSWORD:?Defina MYSQL_OWNER_PASSWORD}"
command -v mysql >/dev/null || { echo 'Falta cliente mysql' >&2; exit 127; }
[[ "$MYSQL_APP_USER" != "$MYSQL_OWNER_USER" ]] || { echo 'Las cuentas app y owner deben ser diferentes' >&2; exit 2; }

probe="__neodomus_acl_probe_$(date +%s)_$$"
tmp=$(mktemp -d)
trap 'MYSQL_PWD="$MYSQL_OWNER_PASSWORD" mysql --protocol=TCP -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_OWNER_USER" "$MYSQL_DATABASE" -e "DROP TABLE IF EXISTS \`$probe\`" >/dev/null 2>&1 || true; rm -rf -- "$tmp"' EXIT

MYSQL_PWD="$MYSQL_OWNER_PASSWORD" mysql --protocol=TCP -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_OWNER_USER" "$MYSQL_DATABASE" \
  -e "CREATE TABLE \`$probe\` (id INT PRIMARY KEY, value VARCHAR(32) NOT NULL)"

app_mysql() {
  MYSQL_PWD="$MYSQL_APP_PASSWORD" mysql --protocol=TCP -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_APP_USER" "$MYSQL_DATABASE" "$@"
}
app_mysql --batch --skip-column-names -e "INSERT INTO \`$probe\` VALUES (1, 'before'); UPDATE \`$probe\` SET value='after' WHERE id=1; SELECT value FROM \`$probe\` WHERE id=1; DELETE FROM \`$probe\` WHERE id=1" > "$tmp/dml.out"
grep -qx 'after' "$tmp/dml.out" || { echo 'Fallo DML autorizado (SELECT/INSERT/UPDATE/DELETE)' >&2; exit 1; }

expect_denied() {
  local statement=$1 operation=$2
  if app_mysql -e "$statement" >"$tmp/denied.out" 2>"$tmp/denied.err"; then
    echo "FALLO: el rol app pudo ejecutar $operation" >&2
    exit 1
  fi
  if ! grep -Eq 'ERROR 1142|command denied|privilege' "$tmp/denied.err"; then
    echo "FALLO: $operation falló por una causa distinta a permisos" >&2
    cat "$tmp/denied.err" >&2
    exit 1
  fi
  echo "OK: $operation rechazado por permisos"
}
expect_denied "ALTER TABLE \`$probe\` ADD COLUMN should_not_exist INT" ALTER
expect_denied "DROP TABLE \`$probe\`" DROP
echo 'OK: app puede usar DML y no puede alterar ni borrar tablas; la tabla temporal se elimina con la cuenta owner.'
