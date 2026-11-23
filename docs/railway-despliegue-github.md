# Despliegue automático GitHub → Railway (Neodomus)

Runbook para conectar los servicios **existentes** de Railway al repositorio
GitHub. Este documento describe la configuración exacta por servicio. Nada de
esto se aplica a producción hasta que el operador lo ejecute en el dashboard;
este bloque solo prepara y prueba el código y los scripts.

## Estado actual de Railway (confirmado)

| Servicio Railway | Origen actual | Imagen | Estado |
|---|---|---|---|
| `neodomus_actualizaciones` (API) | Docker Hub | `juliancc13/neodomus-api:1.0.0` | Online |
| `neodomus-web` (Web) | Docker Hub | `juliancc13/neodomus-web:1.0.0` | Online |
| MySQL | Railway | `mysql:8.0` + volumen persistente | Online — **NO tocar, NO recrear** |

Datos a conservar: base MySQL (volumen persistente), credenciales actuales
(NO se cambian) y los archivos que el storage en uso tenga. Hallazgos de la
inspección de las imágenes actuales de Docker Hub (públicas):

- `juliancc13/neodomus-api:1.0.0`: CMD = `uv run alembic upgrade head &&
  uvicorn …` (migra en cada arranque) y su `alembic/versions` llega a
  **0060**. El repo va en **0066**: el primer pre-deploy de GitHub aplicará
  0061–0066 (todas aditivas/idempotentes, revisadas: `drop_*` solo en
  `downgrade`; 0062/0064 siembran datos con guardas; 0066 comprueba si la
  tabla existe). El código viejo (0060) sigue funcionando con ese esquema
  mientras dura el cambio.
- `juliancc13/neodomus-web:1.0.0`: nginx con `default.conf` horneado que
  hace proxy de `/api/v1/` al dominio **PÚBLICO** del API
  (`https://neodomusactualizaciones-production.up.railway.app`): round-trip
  por TLS de internet. El nuevo `deploy/Dockerfile.web` lo sustituye por el
  proxy interno (`BACKEND_PROXY_URL=http://…railway.internal:8000`), que la
  doc oficial de Railway confirma: `http://api.railway.internal:PORT`,
  DNS interno por entorno, TLS lo termina el proxy público.

## Cambios de código preparados en este bloque

| Archivo | Qué hace |
|---|---|
| `be/Dockerfile` | CMD ahora arranca **solo** uvicorn (`--port ${API_PORT:-8000}`). Las migraciones ya no corren en cada arranque. |
| `deploy/Dockerfile.web` | **Nueva** imagen de producción de la web: build Vite + nginx. Contexto = raíz del repo (necesario: `fe/src/utils/metros.ts` importa `../../../shared/metros`; con contexto en `fe/` el build falla). |
| `deploy/templates/web.conf.template` | **Nueva** plantilla nginx: SPA (`try_files → /index.html`), caché larga para `/assets/`, proxy `/api/v1/ → BACKEND_PROXY_URL`, endpoint estático `/healthz` para el healthcheck de Railway. |
| `.dockerignore` (raíz) | **Nuevo**: recorta el contexto (excluye `.venv`, `node_modules`, `minio_data`, `evidencias`, `.env`, secretos). |
| `.github/workflows/tests.yml` | `push` ahora incluye **todas las ramas (y main)**: los pushes a `main` generan checks de FE/BE/E2E, requisito para *Wait for CI*. No se silencian fallos (E2E reporta y sale 1). |
| `deploy/scripts/backup_mysql_railway.sh` | **Actualizado**: dump **sin** `CREATE DATABASE/USE` (restaurable en la base origen o en una de pruebas sin sobreescribir). |
| `deploy/scripts/restore_mysql_railway.sh` | **Actualizado**: `RESTORE_DATABASE` (default: la de origen; pruebas en base vacía distinta), crea la BD si falta, confirmación explícita. |
| `deploy/scripts/provisionar_minio_railway.sh` | **Nuevo**: buckets público/privado con políticas correctas (idempotente). |
| `deploy/scripts/backup_minio_railway.sh` | **Nuevo**: espejo `mc mirror` de ambos buckets a local, sin borrar. |
| `deploy/scripts/restore_minio_railway.sh` | **Nuevo**: espejo de vuelta con `--overwrite` y **sin `--remove`** (nunca destruye escrituras nuevas). |
| `deploy/scripts/verificar_restore.py` | **Nuevo**: compara origen vs restaurada (53 tablas, conteos, 68 FK, huérfanos). |
| `scripts/inventario_storage.py` | **Nuevo**: inventario read-only de las 10 columnas de URLs por ubicación. |
| `scripts/migrar_urls_storage.py` | **Nuevo**: migración selectiva de prefijos de URL (dry-run, JSON de filas, verificación). |
| `docs/railway-despliegue-github.md` | **Este documento.** |

## Sesión Railway (login interactivo pendiente del operador)

El CLI funciona (`npx @railway/cli@latest …`) pero no hay sesión
(`Unauthorized`). El operador completa el login en SU navegador — nunca
tokens en chat ni en terminal compartida:

```bash
npx @railway/cli@latest login        # abre el navegador y espera el acceso
npx @railway/cli@latest link --project 5724c155-4ba8-445e-9dac-14ff6576123e
```

**Dónde se ejecuta `railway run` — verificado antes de usarlo:**
`railway run` lanza el proceso **en tu PC** inyectando las variables del
servicio. Tu PC NO es parte de la red privada de Railway: los dominios
`*.railway.internal` no se resuelven desde fuera (y los TCP Proxy públicos
sí). Por tanto:

- `railway run -- python scripts/inventario_storage.py` SOLO funciona si
  `DATABASE_URL` del servicio apunta a un host alcanzable desde el PC
  (proxy TCP público). Si la BD real usa `mysql.railway.internal`, ese
  comando fallará con DNS — usar el dominio del **TCP Proxy** de MySQL
  (Settings → Networking del servicio MySQL) con el usuario/contraseña que
  el operador decida exportar en su shell.
- Igual para el storage: si `MINIO_ENDPOINT` es interno, el inventario del
  storage se hace con el `MINIO_PUBLIC_ENDPOINT` (o proxy TCP de MinIO),
  no con el interno.

**`railway ssh` en esta red: NO disponible** (probado contra MySQL y contra
el API: el túnel WireGuard no establece y queda colgado — red con bloqueo
de UDP). Alternativa para tocar la BD real desde el PC: **TCP Proxy** de
MySQL (Settings → Networking → Generate Domain en el servicio MySQL).
Crearlo expone la BD por TCP con su contraseña — generarlo solo para
inventario+respaldo y borrarlo después, o dejarlo para el backup programado.

### Inspección del proyecto (solo lectura, con sesión del operador)

```bash
npx @railway/cli@latest variables --service neodomus_actualizaciones --json | \
  python deploy/scripts/variables_no_secretas.py   # solo claves no secretas
npx @railway/cli@latest variables --service neodomus-web --json | \
  python deploy/scripts/variables_no_secretas.py
npx @railway/cli@latest status                    # servicios y entornos del proyecto
```

Con esa salida se confirman los datos pendientes:

1. **Dominio privado del API** → `RAILWAY_PRIVATE_DOMAIN` (backend): debe
   aparecer en la salida; es lo que se usa en `BACKEND_PROXY_URL`.
2. **Pre-deploy disponible**: Settings → Deploy del API (campo
   "Pre-Deploy Command" visible en el plan actual). No requiere Pro según
   docs vigentes + Help Station (Hobby, ene-2026).
3. **Ubicación del almacenamiento** → valores de `MINIO_ENDPOINT`,
   `MINIO_SECURE`, `MINIO_PUBLIC_ENDPOINT`, `MINIO_BUCKET`,
   `MINIO_PRIVATE_BUCKET` (no secretos) y el host de `DATABASE_URL`. Nada de
   contraseñas/keys se imprime (el filtro las oculta por diseño, probado
   con datos sintéticos).
4. **Persistencia**: si el storage de Railway es un servicio MinIO con
   volumen, se confirma en el canvas (icono de volumen en el servicio) o con
   `railway status`; el volumen montado en `/data` es el requisito.

## ¿Dónde viven hoy el catálogo y las evidencias? (evidencia local)

- **Catálogo base**: estáticos horneados en la web — `fe/public/productos`
  (18 imágenes), servidos como `/productos/*.jpg` por nginx; la BD local no
  tiene ninguna URL de imagen (inventario: 0 URLs en las 10 columnas).
- **Evidencias**: en el MinIO local de desarrollo existe `minio_data/` con
  7 ficheros (config + buckets); las filas de evidencias en BD local están
  a cero. En PRODUCCIÓN la ubicación real queda sin cerrar: depende de las
  `MINIO_*` del servicio API en Railway y de las URLs en la BD real.
- **Datos que el operador debe aportar** (todos no sensibles, salidas del
  filtro anterior):
  - Valores de `MINIO_ENDPOINT/MINIO_SECURE/MINIO_PUBLIC_ENDPOINT/`
    `MINIO_BUCKET/MINIO_PRIVATE_BUCKET` del servicio API.
  - `DATABASE_URL_HOST` (host/base sin credenciales).
  - Resultado de `python scripts/inventario_storage.py` contra la BD REAL
    con el host alcanzable (TCP Proxy de MySQL; NUNCA un `*.railway.internal`
    desde el PC): conteos por ubicación de las 10 columnas.
  - Pre-deploy Command visible Sí/No en Settings → Deploy del API.
  - `RAILWAY_PRIVATE_DOMAIN` del API.

## Inventario REAL del proyecto Railway (bloque 5, sesión autorizada)

Proyecto `affectionate-reverence` (5724c155-4ba8-445e-9dac-14ff6576123e),
entorno `production` (e5055cf6). Resultados agregados, sin secretos:

| Servicio | Dominio privado | Dominio público |
|---|---|---|
| `neodomus-web` | `neodomus-web.railway.internal` | `neodomus-web-production.up.railway.app` |
| `neodomus_actualizaciones` (API) | `neodomusactualizaciones.railway.internal` | `neodomusactualizaciones-production.up.railway.app` |
| `MySQL` | `mysql.railway.internal` | sin proxy TCP |

- **BACKEND_PROXY_URL resuelto**: `http://neodomusactualizaciones.railway.internal:8000`
  (el dominio privado que faltaba por confirmar).
- **Base de datos real: se llama `railway`** (`DATABASE_URL` del API apunta a
  `mysql.railway.internal:3306/railway`). Toda la configuración nueva debe
  usar `/railway` como nombre de base (no `/neodomus`).
- **Persistencia BD**: volumen `mysql-volume` en `/var/lib/mysql`,
  187 MB/500 MB usados, estado Ready.
- **Storage: NO existe en el proyecto** y la config del API está rota:
  `MINIO_ENDPOINT` solo contiene `:9000` (sin host), no hay
  `MINIO_PUBLIC_ENDPOINT` ni `MINIO_SECURE`, y no hay ningún servicio ni
  volumen de storage. Consecuencia: en producción **hoy no hay
  almacenamiento funcional** — las subidas de imágenes/evidencias del API
  fallan; el catálogo visible sale de los estáticos horneados en la web.
- **Pre-deploy**: disponible (docs vigentes; campo presente en Settings).
- **`railway ssh`: conexión FALLIDA.** Probado contra MySQL y contra el
  API: queda colgado y aborta con error sin ejecutar comandos. La causa no
  está determinada (no se atribuye a WireGuard ni a nada sin evidencia).
  Alternativa verificada para tocar la BD real desde el PC: **TCP Proxy**
  del MySQL (Settings → Networking → Generate Domain). Lo expone por TCP
  con su contraseña: generarlo solo para inventario+respaldo y retirarlo
  después si no se necesita.

Pendiente del inventario: conteo de URLs en la BD `railway` (¿hay
evidencias/archivos referenciados?) — requiere TCP Proxy o sesión desde la
red de Railway.

### Rescate de archivos: estado honesto (nada declarado inexistente)

Lo que SABEMOS por evidencia (no lo que falta por revisar):

- El proyecto Railway **no tiene** hoy servicio ni volumen de storage y la
  config `MINIO_*` del API está rota (`MINIO_ENDPOINT` sin host).
- La BD local de desarrollo tiene **0** URLs en las 10 columnas de archivos
  (inventario ejecutado).
- El directorio legacy `be/app/static` no contiene archivos de usuarios.
- Histórico: los despliegues VPS (`deploy/compose.prod.yaml` +
  `deploy/env.prod.example`) **sí** contemplaban un MinIO local; los
  commits «Preparación completa de Neodomus para instalación y desarrollo»
  y «feat(security): complete deployment controls…» introdujeron esas
  variables — si existió ese VPS con imágenes/evidencias, esos archivos
  quedan FUERA de Railway. `be/app/static` solo contiene `Logo.jpg`
  (logotipo horneado, no contenido de usuarios).

Lo que queda PENDIENTE (inaccesible ≠ vacío):

1. Conteo de URLs por columna en la BD `railway` real (con TCP Proxy).
2. Si aparecen URLs → identificar el host/bucket al que apuntan y decidir
   rescate (copia con `mc mirror` o migración con `migrar_urls_storage.py`).
3. Confirmación del operador de si hubo despliegues previos (VPS u otro
   proveedor) con archivos que deban rescatarse.
4. Mientras tanto **el servicio API actual NO se elimina ni se
   reconfigura**: podría contener rutas/objetos a rescatar.

## Configuración exacta por servicio (dashboard Railway)

### Servicio API — `neodomus_actualizaciones`

- **Source**: GitHub Repo `nicolmarinoromero-bit/neodomus_actualizaciones`, Branch `main`.
- **Config as code / Build**:
  - Root Directory: `/be`
  - Dockerfile Path: `Dockerfile` (es decir `be/Dockerfile`)
  - Watch Paths: `be/**`
- **Start Command**: vacío (usa el CMD de la imagen: uvicorn en `${API_PORT:-8000}`).
- **Pre-Deploy Command**: `alembic upgrade head`
  (falla el deploy si la migración falla; el CMD de la imagen ya NO la repite).
- **Target Port**: `8000` (Settings → Networking; coincide con EXPOSE 8000).
- **Healthcheck**: Settings → Deploy → Healthcheck Path `/health/readiness`,
  timeout generoso (p. ej. 60 s). Este endpoint valida BD **y** almacenamiento
  y devuelve 503 si falta alguno. **NUNCA publicar con `/health`**: ocultaría
  una dependencia requerida inaccesible. Si el storage no está listo, el
  despliegue no debe pasar el healthcheck — eso es el comportamiento
  correcto, no un error a esquivar.
- **Autodeploy**: ON (deploy on push a `main`).
- **Wait for CI**: ON (exige checks del workflow `Neodomus Tests`).

**Compatibilidad del código anterior con el esquema 0066 — probado:**

- La imagen actual de Docker Hub (juliancc13/neodomus-api:1.0.0) arrancó y
  sirvió tráfico contra una base con esquema 0066: `/health` 200,
  `/api/v1/productos/` 200, `/docs` 200 (contenedores efímeros de prueba).
  Sus columnas existen todas (esquema 0066 ⊇ 0060) y las columnas nuevas
  (0061/0063) son **nullable**, así que sus INSERT no se rompen; los
  índices únicos nuevos (google_id, id_solicitud_origen) son sobre columnas
  que el código viejo nunca escribe. 0062/0064 solo siembran/actualizan
  filas con guardas (SELECT previo / WHERE por id), re-ejecutables.
- **Excepción documentada (recuperación con la imagen vieja)**: su CMD
  ejecuta `alembic upgrade head` con su árbol hasta 0060 y **falla** contra
  un marcador 0066 (`Can't locate revision identified by '0066'`, exit 255,
  probado). **NO se corrige tocando el marcador**: mientras el esquema esté
  en 0066, `alembic_version` no se modifica. La recuperación correcta de esa
  imagen es fijar un **Start Command explícito** que ejecute SOLO Uvicorn,
  omitiendo su CMD de migraciones:
  `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000`
  (probado en entorno aislado: arranque, login, lectura de catálogo y de
  pedidos OK con marcador 0066 intacto).
- Límites de compatibilidad documentados: la imagen vieja NO tiene
  `/health/readiness` (404); su recuperación se valida con arranque +
  endpoints reales (login/catálogo/pedidos), NO solo por `/health` 200. El
  código viejo no conoce `refresh_tokens` ni las columnas nuevas (todas
  nullable) — no las lee ni las escribe; el token de sesión del login viejo
  sigue el formato anterior (sin rotación de refresh tokens).
- Además: el endpoint `/health/readiness` NO existe en esa imagen antigua
  (404) — el healthcheck de Railway solo aplica al despliegue nuevo.

### Comprobar dependencias durante una recuperación con la imagen vieja

Sin `/health/readiness`, las dependencias se comprueban por separado
(comandos exactos, desde Railway → Service → "…" → Shell, o `railway ssh`):

```bash
# 1) BD: consulta real (no solo ping)
mysql --host=mysql.railway.internal -P 3306 --user=<USUARIO> -p \
  -e "SELECT COUNT(*) FROM productos"
# 2) Storage: health de MinIO/S3 desde el propio contenedor del API
python -c "import urllib.request; print(urllib.request.urlopen('http://<MINIO_ENDPOINT>/minio/health/ready', timeout=5).status)"
# 3) API viva: /health + endpoints funcionales con token real
#    (login de una cuenta conocida y GET /api/v1/productos/)
```

Sólo se declara recuperada la imagen vieja cuando (1), (2) y (3) pasen.
Para el despliegue NUEVO se mantiene `/health/readiness` como healthcheck
oficial: valida BD + storage y el deploy no publica si algo falta.

Variables (por nombre; valores con `...` se conservan de las actuales, no se
cambian credenciales):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `mysql+pymysql://<MYSQL_USER>:<MYSQL_PASSWORD>@mysql.railway.internal:3306/railway?charset=utf8mb4` — **la base real en Railway se llama `railway`** (confirmado en el inventario); no cambiar credenciales ni nombre |
| `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | los actuales (sin cambios) |
| `SECRET_KEY` | la actual (≥32 caracteres; `ENVIRONMENT=production` la exige) |
| `ENVIRONMENT` | `production` |
| `CORS_ORIGINS` | `https://<dominio-web>.up.railway.app` (+ dominio propio si existe) |
| `FRONTEND_URL` | `https://<dominio-web>.up.railway.app` |
| `MINIO_ENDPOINT` | `neodomus-media.railway.internal:9000` (host interno del servicio MinIO de Railway) |
| `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | los del MinIO de Railway (no reutilizar claves de desarrollo) |
| `MINIO_BUCKET` | `neodomus-media` |
| `MINIO_PRIVATE_BUCKET` | `neodomus-private` |
| `MINIO_PUBLIC_ENDPOINT` | `https://<dominio-publico-del-minio>` (URL que cargan los navegadores) |
| `MINIO_SECURE` | `true` si el dominio público es HTTPS |
| `PAYMENT_PROVIDER` | `simulator` (no hay pasarela real en este bloque) |
| `TRUSTED_PROXIES` | `*` (todas las peticiones llegan tras el proxy de Railway; la API sí es alcanzable directamente, valora el trade-off) |
| `API_PORT` | `8000` (opcional: es el valor por defecto) |
| `RATE_LIMIT_ENABLED` / `RATE_LIMIT_HEADERS_ENABLED` | `true` |
| `RATE_LIMIT_STORAGE_URI` | `memory://` (válida con 1 réplica; con >1 réplica, `redis://…`) |
| `SMTP_HOST/PORT/USERNAME/PASSWORD`, `EMAIL_PROVIDER`, `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`, `GOOGLE_SIGNIN_CLIENT_ID` | los actuales (sin cambios) |

Nota Railway MySQL: Railway entrega `MYSQL_URL` con formato `mysql://…`.
Neodomus exige el driver `mysql+pymysql://…?charset=utf8mb4` — transforma la
URL (añade `+pymysql` y `?charset=utf8mb4`) al definir `DATABASE_URL`; no
cambies el usuario/contraseña de Railway.

### Servicio Web — `neodomus-web`

- **Source**: GitHub Repo `nicolmarinoromero-bit/neodomus_actualizaciones`, Branch `main`.
- **Build**:
  - Root Directory: `/` (raíz del repo; **no** `/fe`: el build necesita `shared/`)
  - Dockerfile Path: `deploy/Dockerfile.web`
  - Watch Paths: `fe/**`, `shared/**`, `deploy/**`, `.dockerignore`
    (el `.dockerignore` de la raíz define el contexto de build; cambiarlo
    debe re-desplegar la web)
- **Start Command**: vacío (CMD de la imagen: nginx).
- **Target Port**: `80` (Settings → Networking; coincide con EXPOSE 80).
- **Healthcheck Path**: `/healthz` (estático del propio nginx).
- **Autodeploy**: ON. **Wait for CI**: ON.

Variables:

| Variable | Valor |
|---|---|
| `BACKEND_PROXY_URL` | `http://${{neodomus_actualizaciones.RAILWAY_PRIVATE_DOMAIN}}:8000` (referencia interna de Railway; el nombre exacto se ve en Settings → Networking del servicio API) |
| `VITE_GOOGLE_CLIENT_ID` | opcional, **público** (Client ID OAuth; va en el bundle, jamás un secreto) |

`VITE_API_URL` no se define en Railway: la imagen hornea `/api/v1` (mismo
origen; nginx resuelve el proxy). Esto elimina problemas de CORS y de
configuración por dominio.

### CI (GitHub Actions)

- `Neodomus Tests` (FE + BE + E2E): corre en **push a todas las ramas** y en PR
  hacia `development`/`main`. Con push a `main` existen checks en el commit,
  así que *Wait for CI* tiene qué esperar. Los fallos NO se silencian: el job
  E2E acumula resultados de los 6 flujos y termina en error si alguno falla.
- `Cobertura (bootcamp)` + `SonarCloud`: ya corren en push a `main`.

## Migraciones Alembic (pre-deploy) — VERIFICADO en docs vigentes

- Pre-deploy: `alembic upgrade head` (imagen del API, con `DATABASE_URL` del
  servicio). Un fallo aborta el deploy **antes** de sustituir el tráfico.
- La imagen ya no migra en cada arranque → nada de migraciones concurrentes
  si hay varias réplicas.
- **Semántica oficial** (docs.railway.com/deployments/pre-deploy-command):
  corre en contenedor aparte con las variables del servicio y la red privada;
  sin shell → `alembic upgrade head` es un comando único válido (no necesita
  interpolación); no monta volúmenes; se puede fijar **Pre-deploy Timeout**
  (recomendado: 900 s, margen sobre la ejecución real medida ~segundos).
- **Plan**: la página oficial NO restringe el pre-deploy a Pro y en
  Railway Help Station se lo recomienda a un usuario de Hobby (ene-2026).
  La afirmación «requiere Pro» queda DESMENTIDA para Hobby. Confirmación
  final: el campo Pre-Deploy Command aparece en Settings → Deploy del
  servicio al aplicar. No se contrató nada.
- Compatibilidad de esquema: 0060 (imagen actual) → 0066 (repo) es aditivo;
  el API viejo sigue sirviendo tráfico durante el pre-deploy del nuevo.
- Compatibilidad Docker Compose: `docker-compose.yml` (dev), `deploy/compose
  .prod.yaml` y `docker-compose.test.yml` definen comandos explícitos o son
  ajenos al CMD; `docker compose config` válido en los tres con sus env.
  El cambio de CMD no rompe ningún despliegue existente.

## ¿Dónde están hoy las imágenes y evidencias? (procedimiento de verificación)

Que no haya un servicio "MinIO" visible en Railway no prueba que no exista
almacenamiento externo. El endpoint lo resuelve el API con las variables
`MINIO_*` del servicio y las URLs quedan grabadas en la base. Para averiguar
el origen REAL (sin revelar secretos):

1. `railway variables --service neodomus_actualizaciones` (del operador,
   valores ocultos): mira los nombres `MINIO_ENDPOINT`, `MINIO_SECURE`,
   `MINIO_PUBLIC_ENDPOINT`, `MINIO_BUCKET`, `MINIO_PRIVATE_BUCKET`.
2. Inventario read-only contra la BD real con el host ALCANZABLE desde la
   máquina que lo ejecuta (TCP Proxy público de MySQL — tu PC no está en la
   red privada de Railway, `railway run` no cambia eso):
   ```bash
   python scripts/inventario_storage.py --db \
     "mysql+pymysql://<usuario>:<contraseña>@<proxy-tcp>.railway.app:<puerto>/railway?charset=utf8mb4"
   ```
   Agrupa las URLs de las 10 columnas con archivos por
   `esquema://host/bucket`, rutas relativas y nulos. Con eso se sabe qué
   proveedor/host y cuántos archivos hay.
3. Decisión:
   - **Mismo storage externo**: si el proveedor actual es S3-compatible y
     estable, el nuevo despliegue APUNTA AL MISMO storage (mismas `MINIO_*`):
     cero migración de archivos. Solo añadir respaldo del bucket con
     `backup_minio_railway.sh`.
   - **MinIO nuevo en Railway**: provisionar con
     `provisionar_minio_railway.sh`, copiar con `backup_minio_railway.sh`
     desde el origen + subir con `restore_minio_railway.sh`, y recién ahí
     migrar referencias con `migrar_urls_storage.py` (selectivo, con dry-run,
     respaldo JSON de filas y verificación de cero residuales; NUNCA
     `UPDATE REPLACE` global, nunca borrar originales).

## Almacenamiento persistente compatible (MinIO en Railway)

- Servicio de storage: imagen `elestio/minio` (misma familia que compose;
  `/minio/health/ready` responde 200 — requisito del readiness) con volumen
  persistente montado en `/data`. Comando: `server /data --console-address ":9001"`.
- Buckets: `neodomus-media` (público, política de descarga anónima) y
  `neodomus-private` (sin política) → `provisionar_minio_railway.sh`
  (idempotente, probado contra MinIO de pruebas).
- Variables del API: `MINIO_ENDPOINT=<host-interno>.railway.internal:9000`
  (HTTP interno), `MINIO_PUBLIC_ENDPOINT=https://<dominio-público>`
  (URL que cargan los navegadores), `MINIO_SECURE=true`.
- Respaldo del storage: `backup_minio_railway.sh` (mc mirror a local, sin
  borrar) + `restore_minio_railway.sh` (`--overwrite`, **sin `--remove`**:
  nunca destruye escrituras nuevas). Probados de punta a punta contra el
  MinIO de pruebas: provision→subida→mirror→borrado del objeto→mirror de
  vuelta→contenido recuperado.
- `/health/readiness` SE MANTIENE como healthcheck (BD + storage): no se
  oculta la dependencia con `/health` cuando el storage ya existe.
  **El despliegue solo pasa el healthcheck con BD y storage accesibles; si
  el almacenamiento requerido está inaccesible, el deploy NO publica — eso
  es correcto.** `/health` se queda como endpoint informativo del código,
  nunca como healthcheck de publicación.

## Compatibilidad de migraciones y almacenamiento (revisado)

- Las migraciones 0061–0066 (primera brecha con la imagen actual) son
  aditivas: no hay `DROP`/destructivas en `upgrade()`; un re-run es seguro.
- **Imágenes de productos**: las subidas nuevas van a MinIO
  (`minio_service.subir_imagen`, bucket público) y las de catálogo base son
  estáticos horneados en la web (`fe/public/productos`, servidos como
  `/productos/*.jpg`). Nada crítico en disco efímero del contenedor.
- **Evidencias**: bucket **privado** de MinIO, descargadas por rutas
  autorizadas. También en MinIO. El directorio legacy `app/static` solo
  conserva archivos heredados (no se borra).
- **URLs absolutas en BD**: las filas guardan URL completa
  `{MINIO_PUBLIC_ENDPOINT}/{bucket}/{objeto}`. Si el dominio público cambia,
  NO usar `UPDATE REPLACE` global: usar `scripts/migrar_urls_storage.py`
  (lista blanca de 10 columnas, límite exacto de prefijo host/bucket,
  dry-run por defecto, respaldo JSON de filas y verificación de cero
  residuales). Probado en BD sintética: migró solo las 2 filas del prefijo
  objetivo y descartó host parcial, otro bucket y rutas relativas.
- **minio_data/ local** es desarrollo: no forma parte de producción.
- **Scheduler** (`apscheduler`) corre en el proceso del API: mantener
  **1 réplica** para no duplicar trabajos.
- **Rate limit** `memory://`: por proceso; válido con 1 réplica.

## Pruebas ejecutadas en este bloque (infraestructura aislada) — RESULTADOS

| Prueba | Resultado |
|---|---|
| Build imagen API (`docker build -f be/Dockerfile ./be`) | OK (`neodomus-api:railway-test`; CMD `uvicorn … ${API_PORT:-8000}`, USER `appuser`, EXPOSE 8000) |
| Build imagen Web con contexto raíz (`docker build -f deploy/Dockerfile.web .`) | OK (`neodomus-web:railway-test`); resuelve `shared/metros.ts` fuera de `fe/` y el build Vite de producción pasa |
| Suite backend (unittest discover) sobre `neodomus_test` (MySQL 3307, instancia separada) + MinIO de pruebas exclusivo (credenciales efímeras, buckets `neodomus-test-media/-private`) | **456/456 pruebas OK** — migraciones completas hasta `0066 (head)`, exit 0 |
| Suite frontend (Vitest) | **573/573 pruebas OK (84 archivos)** — exit 0 |
| Smoke aislado (red Docker dedicada, contenedores efímeros eliminados al terminar) | OK: MySQL 8 efímero + MinIO efímero; migraciones `alembic upgrade head` **en la imagen de producción** con `ENVIRONMENT=production` (validadores fail-fast activos) → OK; API `/health` 200, `/health/readiness` 200 `{"database":true,"storage":true}`; Web `/healthz` 200, `/` y `/login` 200 (SPA), `/api/v1/productos/` 200 vía proxy nginx, estáticos `/productos/1.jpg` 200; Google Sign-In Client ID **público** horneado en el bundle (sin secretos) |
| Respaldo MySQL (comando del script, `mysqldump --single-transaction --no-tablespaces … | gzip`) | OK: 53 `CREATE TABLE`, datos presentes, `gzip` válido, sha256 registrado |
| **Bloque 3 — código viejo + esquema 0066** | OK: imagen Docker Hub 1.0.0 arrancó y sirvió `/health` 200, `/api/v1/productos/` 200, `/docs` 200 sobre BD con 0066 (contenedores efímeros). Excepción probada: su CMD (`alembic upgrade head`) falla con `Can't locate revision '0066'` (exit 255) |
| **Bloque 4 — recuperación imagen vieja (Start Command)** | OK: esquema 0066 y marcador intactos; imagen vieja arrancada con `sh -c "uv run uvicorn …"` (sin su CMD de migraciones): **login 200**, catálogo 200, **pedidos admin 200** con Bearer, rechazo correcto de rutas por rol; `/health/readiness` 404 (no existe) → dependencias comprobadas por separado (health MinIO 200 desde el contenedor + consultas reales a BD) |
| **Bloque 3 — verificación de contenido por hashes** | OK: `verificar_restore.py` ampliado (hash SHA-256 determinista por tabla, filas por PK, valores canonizados) → 53/53 tablas contenido idéntico, 68 FK, 0 huérfanos, exit 0. **Control negativo**: mutación de 1 fila → `productos CONTENIDO_DISTINTO` + exit 1; revertida → exit 0 |
| **Bloque 3 — filtro de variables Railway** | OK: `variables_no_secretas.py` muestra solo claves no secretas; `DATABASE_URL` solo host/base; secretos contados sin valor (probado con JSON sintético) |
| **Bloque 4 — sesión Railway** | CLI operativo vía `npx`; sin sesión (`Unauthorized`) — login interactivo pendiente del operador |

Sin correos reales (SMTP vacío), sin pagos reales (`PAYMENT_PROVIDER=simulator`), sin buckets
ni credenciales de desarrollo. Los contenedores del smoke (`smoke-*`) se eliminaron al terminar;
la base `neodomus_test` local y el MinIO de pruebas (`neodomus_minio_test`, puertos 9100/9101 en
127.0.0.1) quedan para re-ejecuciones: no tocan desarrollo.

Nota de la suite local: la primera ejecución de la suite backend encontró dos problemas de
entorno (Python global sin dependencias y codificación cp1252 en consola), corregidos creando
`be/.venv` con `uv sync --locked --group dev` (idéntico a CI) y fijando `PYTHONIOENCODING=utf-8`.
No afecta a Railway (la imagen ya lleva sus dependencias).

## Respaldo REAL previo a producción vs respaldo de pruebas

- **Respaldo de PRUEBAS** (ya ejecutado en este bloque): dumps de
  `neodomus_test` y espejos del MinIO de pruebas en `backups/`. Sirven para
  validar los scripts; NO sirven para recuperar producción.
- **Respaldo REAL** (obligatorio ANTES del primer deploy GitHub, lo corre el
  operador con las credenciales reales de Railway). **Destino privado
  excluido de Git: `respaldos/`** (ya en .gitignore — ver .gitignore:99;
  alternativamente `backups/`). Sin subir copias a servicios externos sin
  destino autorizado:
  ```bash
  RAILWAY_DB_HOST=<proxy-tcp-de-mysql>.railway.app \
  RAILWAY_DB_PORT=<puerto-proxy> \
  MYSQL_USER=<usuario-actual> MYSQL_PASSWORD=<contraseña-actual> \
  MYSQL_DATABASE=neodomus BACKUP_DIR=respaldos/mysql \
  ./deploy/scripts/backup_mysql_railway.sh
  # storage actual (con el endpoint real del inventario):
  MINIO_ENDPOINT=<endpoint-actual> MINIO_ACCESS_KEY=... MINIO_SECRET_KEY=... \
  MINIO_SECURE=... BACKUP_DIR=respaldos/minio \
  ./deploy/scripts/backup_minio_railway.sh
  ```
  → `.sql.gz` + espejo de buckets en el destino privado con sha256 y copia a
  un segundo destino local. El `.sql.gz` nuevo ya NO incluye
  `CREATE DATABASE/USE`: restaura en la base origen o en una de pruebas
  (`RESTORE_DATABASE`) sin sobreescribir nada por accidente.

## Secuencia de publicación (GitHub → Railway)

1. **Respaldo real** (BD + storage actual) y copia externa.
2. Averiguar el storage actual → **PARCIALMENTE RESUELTO (bloque 5)**: en el
   proyecto Railway no hay servicio ni volumen de storage y la config
   `MINIO_*` del API está rota. Eso prueba que desde Railway no hay
   almacenamiento activo, NO que no existan archivos (histórico VPS y
   referencias en la BD real quedan por confirmar). El despliegue nuevo
   necesitará provisionar MinIO (scripts listos y probados); el rescate de
   archivos previos depende del inventario de la BD `railway` y de lo que
   confirme el operador.
3. Añadir servicio MySQL ya existente a la red privada del proyecto (los
   servicios nuevos heredan red privada; verificar dominio interno del MySQL).
4. Aplicar variables y configuración por servicio (secciones anteriores).
5. Push del bloque a `main` (por el operador; este bloque no hace push) →
   CI verde → Railway despliega con pre-deploy `alembic upgrade head`
   (aplica 0061–0066, aditivas) → healthcheck `/health/readiness`.
6. Verificar: `/health/readiness` 200, catálogo con imágenes, login, una
   compra simulada, subida de una imagen de prueba y su URL nueva.
7. Solo entonces apuntar el dominio público web / activar autodeploy+Wait
   for CI como flujo normal.

## Recuperación sin perder escrituras nuevas

**Restaurar la BD NO es el rollback automático de cualquier fallo.** Árbol
de decisión:

- Fallo de build/CI o arranque → **rollback de código** en Railway
  (Redeploy del deploy anterior). La BD no se toca.
- Deploy OK pero el código nuevo corrió migraciones destructivas (no aplica
  a 0061–0066, aditivas) y hay que volver de esquema → restaurar respaldo,
  PERO sin perder escrituras nuevas:
  1. Pausar el API (evita escrituras durante la restauración).
  2. **Respaldo del estado ACTUAL** antes de restaurar nada
     (`backup_mysql_railway.sh` nuevo dump: captura las escrituras nuevas).
  3. Restaurar el respaldo previo al incidente (`restore_mysql_railway.sh`,
     confirma `RESTAURAR`).
  4. Extraer las escrituras nuevas legítimas del dump del paso 2
     (diferencia de filas por fecha/ID) y aplicarlas SELECTIVAMENTE (SQL o
     `migrar_urls_storage.py` para URLs). Nunca restaurar encima ni al revés.
  5. Arrancar el API y validar `/health/readiness` + verificación con
     `verificar_restore.py` (53 tablas, conteos, 68 FK, huérfanos).
- Corrupción de datos puntual → restauración dirigida de tablas (dump del
  paso 2) sobre la BD viva, con el API pausado.
- Pérdida de objetos del storage → `restore_minio_railway.sh` del espejo:
  `--overwrite` repon el objeto; **sin `--remove`**, no destruye objetos
  nuevos no respaldados.

La verificación de restauración (`deploy/scripts/verificar_restore.py`)
compara origen vs restaurada: 53 tablas, COUNT(*) por tabla,
68 claves foráneas y filas huérfanas — probado en `neodomus_restore_test`
(base vacía distinta), exit 0. SHA256 del dump solo valida transporte; la
restauración correcta la demuestra la comparación de esquema/datos/relaciones.

## Estado de la publicación (NO declarar lista mientras falten respaldo real e inventario)

El cambio a Source GitHub queda **PREPARADO pero NO LISTO PARA ACTIVAR**:
faltan inventario del storage real y respaldo real, ambos ejecutados por el
operador. Siguiente acción concreta:

1. `npx @railway/cli@latest login` (el operador completa en su navegador) +
   `link --project 5724c155-…`.
2. Correr el filtro `variables_no_secretas.py` sobre API y web (ver sección
   Sesión Railway) → dominio privado del API + ubicación del storage.
3. Inventario real con el **host alcanzable** (TCP Proxy de MySQL o endpoint
   público del storage; NUNCA un `*.railway.internal` desde el PC):
   `python scripts/inventario_storage.py --db mysql+pymysql://<usuario>:<contraseña>@<proxy-tcp>:<puerto>/railway?charset=utf8mb4`
4. **Respaldo REAL** de BD (`backup_mysql_railway.sh`, base `railway`) y del
   storage actual si lo hubiera (hoy NO existe storage en el proyecto: solo
   habría archivos que el inventario del paso 3 revele) + copia
   externa, destino `respaldos/` (excluido de Git).
5. Con inventario + respaldo listos → aplicar la configuración por servicio
   (pre-deploy `alembic upgrade head`, healthcheck `/health/readiness`,
   autodeploy + Wait for CI) y publicar.

## Bloqueos y pendientes

1. **Ubicación del storage actual**: requiere la vista del operador
   (`railway variables` + `inventario_storage.py` contra la BD real). Ya hay
   procedimiento, inventario y plan de migración listos; falta EJECUTAR el
   inventario y decidir: reutilizar el storage externo o provisionar MinIO
   (todo el material está probado).
2. **MinIO en Railway (si toca provisionar)**: crear el servicio con volumen
   persistente (`elestio/minio`, buckets con `provisionar_minio_railway.sh`,
   dominio público para `MINIO_PUBLIC_ENDPOINT`) y respaldar con
   `backup_minio_railway.sh`. El healthcheck del API es SIEMPRE
   `/health/readiness`: sin storage accesible el deploy no publica.
3. **Dominio interno del API** para `BACKEND_PROXY_URL`: se confirma en el
   dashboard al aplicar (Settings → Networking del API).
4. **Pre-deploy**: desmentido el requisito de Pro (docs + Help Station);
   verificación final al aplicar (el campo debe aparecer en Settings →
   Deploy) y fijar Pre-deploy Timeout 900 s.
4b. **Rollback/recuperación de la imagen antigua**: su CMD no entiende el
   stamp 0066 (probado); la recuperación correcta es Start Command explícito
   solo-Uvicorn (probado: login+catálogo+pedidos OK), SIN tocar el
   marcador. Documentado en la configuración del API.
4c. **Sesión Railway**: sin login no se puede inspeccionar el proyecto
   `5724c155-…`; el CLI está operativo vía `npx`.
5. **Aplicar la configuración** (Source GitHub, variables, healthchecks,
   autodeploy) lo hace el operador en el dashboard: este bloque no toca
   producción ni hace push.
6. **`neodomus_test` y `neodomus_restore_test` locales**: creadas para las
   pruebas de estos bloques (bases separadas en el MySQL de desarrollo).
   `neodomus_restore_test` puede borrarse tras revisar; `neodomus_test`
   sirve para re-ejecutar la suite. Ninguna la usa la aplicación.
7. **Script .sh en Windows**: los scripts bash necesitan Git Bash/WSL o CI;
   en Windows los comandos equivalentes están probados directamente con
   Docker (documentados en este runbook).
