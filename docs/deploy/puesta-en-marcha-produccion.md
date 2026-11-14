# Puesta en marcha de Neodomus

Esta guía usa `deploy/compose.prod.yaml` de este branch: Compose administra MySQL, MinIO, API y web; Caddy termina TLS en el host y reenvía a la web publicada solo en `127.0.0.1:8080`.

## Límites de operación

- Los pagos disponibles usan el simulador; el sistema no procesa cobros reales.
- Los volúmenes MySQL y MinIO son persistentes en un solo host, pero no reemplazan backups fuera del host ni proporcionan alta disponibilidad.
- El scheduler corre dentro de cada proceso API. Mantén una sola réplica hasta separar el scheduler o agregar elección de líder.
- La aceptación operativa de semana 6 sigue pendiente para el servidor productivo. No ejecutes cambios de SSH, firewall, backups ni migraciones en producción sin los responsables y la ventana aprobados.

## Requisitos

1. Un host Linux con Docker Engine, Compose v2, Caddy y `curl`.
2. DNS `A` para `DOMAIN`, apuntando al host; publica TCP 80/443 para Caddy.
3. No publiques MySQL, API, MinIO ni su consola a Internet. Compose solo publica la web en loopback.
4. Espacio persistente para volúmenes MySQL/MinIO y almacenamiento externo para backups.

## Preparar configuración

Desde la raíz del repositorio:

```bash
cp deploy/env.prod.example deploy/.env.prod
chmod 600 deploy/.env.prod
```

Edita `deploy/.env.prod` con valores del gestor de secretos:

- Define `DOMAIN`, `ACME_EMAIL`, `FRONTEND_URL`, `CORS_ORIGINS` y `MINIO_PUBLIC_ENDPOINT` para el dominio real.
- Sustituye todos los valores `CHANGE_ME_IN_PROD` por secretos únicos. Genera contraseñas hexadecimales con `openssl rand -hex 32`.
- Conserva separados los usuarios MySQL de runtime, migración y backup (`MYSQL_APP_*`, `MYSQL_OWNER_*`, `MYSQL_BACKUP_*`).
- Configura un proveedor de correo y las credenciales de Google que correspondan. No copies secretos a Git ni a logs.
- Mantén `MINIO_BUCKET` y `MINIO_PRIVATE_BUCKET` distintos.

Valida la configuración sin arrancar contenedores:

```bash
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml config --quiet
```

## Migrar y arrancar

Conserva el volumen existente; no uses `down -v`:

```bash
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml up -d db minio
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml --profile ops run --rm migrate
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml up -d api web
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml ps
```

`migrate` usa el usuario MySQL de migración y debe terminar con código 0 antes de exponer la API. Revisa los logs sin imprimir el entorno completo:

```bash
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml logs --tail=100 migrate api web db minio
```

## Caddy y comprobación

Configura Caddy en el host para cargar `deploy/Caddyfile` y define `DOMAIN` y `ACME_EMAIL` en su servicio. El Caddyfile reenvía a `127.0.0.1:8080`; Nginx conserva el `X-Forwarded-Proto` HTTPS hacia la API.

Comprueba la web, el estado de API y el catálogo:

```bash
curl -I "https://${DOMAIN}/"
curl -fsS "https://${DOMAIN}/health/readiness"
curl -fsS "https://${DOMAIN}/api/v1/productos/"
```

Para la verificación autenticada, usa una cuenta sintética en un entorno autorizado. `scripts/smoke-test.sh` requiere `SMOKE_EMAIL` y `SMOKE_PASSWORD`; introdúcelos desde un gestor de secretos, nunca como argumentos que queden en el historial.

## Backup y rollback

Antes de actualizar datos, crea y verifica un backup consistente de MySQL y MinIO, conserva el tag de aplicación y confirma una restauración en un entorno aislado. Para volver a una versión compatible, despliega el tag anterior manteniendo `deploy/.env.prod` y los volúmenes:

```bash
git checkout <TAG_ANTERIOR>
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml up -d --build
```

No uses `alembic downgrade` sin revisar la migración. Si el esquema requiere restauración, usa el backup de MySQL y MinIO del mismo punto temporal. La recuperación no se considera validada hasta ensayarla antes del despliegue.
