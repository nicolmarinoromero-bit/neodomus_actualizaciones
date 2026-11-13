#!/usr/bin/env bash
set -Eeuo pipefail

# Docker MySQL ejecuta este init script solo al inicializar un volumen vacío.
# Restringimos contraseñas a hex aleatorio para evitar SQL escaping ambiguo;
# generar con: openssl rand -hex 32. Nunca habilitar xtrace en scripts de secretos.
for name in MYSQL_APP_USER MYSQL_APP_PASSWORD MYSQL_OWNER_USER MYSQL_OWNER_PASSWORD MYSQL_BACKUP_USER MYSQL_BACKUP_PASSWORD MYSQL_DATABASE MYSQL_ROOT_PASSWORD; do
  [[ -n "${!name:-}" ]] || { echo "Falta variable obligatoria: $name" >&2; exit 1; }
done
[[ "$MYSQL_APP_USER" =~ ^[a-zA-Z][a-zA-Z0-9_]{2,31}$ ]] || { echo 'MYSQL_APP_USER tiene formato no permitido' >&2; exit 1; }
[[ "$MYSQL_OWNER_USER" =~ ^[a-zA-Z][a-zA-Z0-9_]{2,31}$ ]] || { echo 'MYSQL_OWNER_USER tiene formato no permitido' >&2; exit 1; }
[[ "$MYSQL_APP_USER" != "$MYSQL_OWNER_USER" ]] || { echo 'App y migración deben ser cuentas distintas' >&2; exit 1; }
[[ "$MYSQL_DATABASE" == neodomus ]] || { echo 'Este bootstrap de roles solo admite la base neodomus' >&2; exit 1; }
for account in "$MYSQL_APP_USER" "$MYSQL_OWNER_USER" "$MYSQL_BACKUP_USER"; do
  case "$account" in
    neodomus_owner|neodomus_app|neodomus_read_only|neodomus_backup)
      echo "El nombre de cuenta $account colisiona con un rol MySQL" >&2
      exit 1
      ;;
  esac
done
[[ "$MYSQL_ROOT_PASSWORD" =~ ^[a-fA-F0-9]{32,}$ ]] || { echo 'MYSQL_ROOT_PASSWORD debe ser hexadecimal aleatoria (mínimo 32 caracteres)' >&2; exit 1; }
[[ "$MYSQL_APP_PASSWORD" =~ ^[a-fA-F0-9]{32,}$ ]] || { echo 'MYSQL_APP_PASSWORD debe ser hexadecimal aleatoria (mínimo 32 caracteres)' >&2; exit 1; }
[[ "$MYSQL_OWNER_PASSWORD" =~ ^[a-fA-F0-9]{32,}$ ]] || { echo 'MYSQL_OWNER_PASSWORD debe ser hexadecimal aleatoria (mínimo 32 caracteres)' >&2; exit 1; }
[[ "$MYSQL_BACKUP_USER" =~ ^[a-zA-Z][a-zA-Z0-9_]{2,31}$ ]] || { echo 'MYSQL_BACKUP_USER tiene formato no permitido' >&2; exit 1; }
[[ "$MYSQL_BACKUP_PASSWORD" =~ ^[a-fA-F0-9]{32,}$ ]] || { echo 'MYSQL_BACKUP_PASSWORD debe ser hexadecimal aleatoria (mínimo 32 caracteres)' >&2; exit 1; }
[[ "$MYSQL_BACKUP_USER" != "$MYSQL_APP_USER" && "$MYSQL_BACKUP_USER" != "$MYSQL_OWNER_USER" ]] || { echo 'La cuenta backup debe ser independiente' >&2; exit 1; }

export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"
mysql --protocol=socket -uroot "$MYSQL_DATABASE" <<SQL
CREATE USER IF NOT EXISTS '${MYSQL_APP_USER}'@'%' IDENTIFIED BY '${MYSQL_APP_PASSWORD}';
GRANT 'neodomus_app' TO '${MYSQL_APP_USER}'@'%';
SET DEFAULT ROLE 'neodomus_app' TO '${MYSQL_APP_USER}'@'%';
CREATE USER IF NOT EXISTS '${MYSQL_OWNER_USER}'@'%' IDENTIFIED BY '${MYSQL_OWNER_PASSWORD}';
GRANT 'neodomus_owner' TO '${MYSQL_OWNER_USER}'@'%';
SET DEFAULT ROLE 'neodomus_owner' TO '${MYSQL_OWNER_USER}'@'%';
CREATE USER IF NOT EXISTS '${MYSQL_BACKUP_USER}'@'%' IDENTIFIED BY '${MYSQL_BACKUP_PASSWORD}';
GRANT 'neodomus_backup' TO '${MYSQL_BACKUP_USER}'@'%';
SET DEFAULT ROLE 'neodomus_backup' TO '${MYSQL_BACKUP_USER}'@'%';
SQL
unset MYSQL_PWD
