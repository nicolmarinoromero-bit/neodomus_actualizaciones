# NeoDomus

[![Python](https://img.shields.io/badge/Python-3.12%20%7C%20%3E%3D3.10-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Expo](https://img.shields.io/badge/Expo-57-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![MinIO](https://img.shields.io/badge/MinIO-almacenamiento%20de%20objetos-C72B49?logo=minio&logoColor=white)](https://min.io/)
[![Alembic](https://img.shields.io/badge/Alembic-1.13-6B7A8F)](https://alembic.sqlalchemy.org/)
[![Docker Compose](https://img.shields.io/badge/Docker%20Compose-servicios%20locales-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![unittest](https://img.shields.io/badge/unittest-3878AB)](https://docs.python.org/3/library/unittest.html)
[![Vitest](https://img.shields.io/badge/Vitest-2.1-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-1.48-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![SonarCloud](https://img.shields.io/badge/SonarCloud-configurado-F3704A?logo=sonarcloud&logoColor=white)](https://sonarcloud.io/)
[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-CI-2088FF?logo=githubactions&logoColor=white)](../../actions)

Plataforma web y móvil para consultar productos de domótica, gestionar compras y coordinar servicios técnicos, citas e instalaciones. El repositorio reúne el backend, la aplicación web, la app móvil y la documentación del proyecto.


## 1. Descripción general

**Problema que resuelve.** La venta e instalación de equipos de domótica implica coordinar catálogo, inventario (incluida venta por metros/corte), pagos, facturación, agenda de técnicos con especializaciones, entregas con evidencias y devoluciones con reembolsos. Hacerlo por canales dispersos genera sobregiros de stock, citas sin técnico compatible y trazabilidad nula de reclamos.

**Objetivo principal.** Integrar en un solo sistema el catálogo, la compra, la agenda técnica y el posventa, con control de inventario concurrente (bloqueo pesimista), verificación de identidad y auditoría de operaciones sensibles.

**Componentes**

| Componente | Ubicación | Tecnologías confirmadas en configuración |
|---|---|---|
| API | `be/` | Python (rango `>=3.10`; contenedor Python 3.12), FastAPI 0.115.0, Uvicorn 0.30.0, SQLAlchemy 2.0.30 |
| Web | `fe/` | React 18.3.1, TypeScript 5.9.3, Vite 5.4.21 |
| Móvil | `movil/` | Expo 57.0.22, React Native 0.86.3, React 19.2.3, Expo Router 57.0.21 |
| Datos | Docker Compose / `be/alembic/` | MySQL 8.0, Alembic 1.13.2 |
| Archivos | API y Compose | MinIO (bucket público de catálogo y bucket privado de evidencias) |

Las versiones corresponden a los manifiestos de este repositorio (`be/pyproject.toml`, `fe/package.json`, `movil/package.json`, `docker-compose.yml`). La API monta los routers bajo `/api/v1`; la fuente de verdad del registro es `be/app/main.py`. Los pagos están configurados por defecto con un **simulador académico** (`PAYMENT_PROVIDER=simulator`); no se documentan como procesamiento real de tarjetas.

## 2. Funcionalidades principales

Implementadas en el código actual (backend `be/app/routers/`, web `fe/src/`, móvil `movil/app/`):

- **Autenticación y cuentas**: registro con verificación de correo por código, login unificado cliente/empleado, OAuth con Google, tokens JWT con refresco, recuperación de contraseña por código, cambio de correo y de contraseña, auditoría de accesos.
- **Catálogo**: productos con variantes (color/medida), venta por unidades y por metros, disponibilidad calculada, imágenes en MinIO y buscador con filtros.
- **Carrito y checkout**: carrito persistente, cupones de descuento, métodos de pago del simulador (débito, crédito, PSE, PayPal, punto de pago), factura PDF enviada por correo y descargable.
- **Inventario**: descuento y reintegro exacto de stock con bloqueo `SELECT ... FOR UPDATE`, alertas de stock bajo y agotado al equipo administrador.
- **Citas e instalaciones**: creación de órdenes de instalación, asignación automática del técnico por especialización y horario, reasignación con historial, recordatorios programados.
- **Entregas**: agenda de entregas, estados con reglas de transición para el técnico, evidencias fotográficas con descarga autorizada.
- **Devoluciones y reembolsos**: elegibilidad por pedido, devolución de corte completo en venta por metros, flujo de aprobación administrativa, recogida por técnico y reembolsos registrados con estado.
- **Calificaciones** del servicio, **notificaciones** en bandeja y por correo, **novedades/reclamos** con respuesta del equipo y cupones de compensación.
- **Paneles**: cliente, técnico y administración (solicitudes de cuenta, catálogo, citas, entregas, reportes de ventas en JSON/PDF, novedades).
- **App móvil**: pantallas públicas y de cliente, área de técnico (agenda, estados, fotos).
- **Documentación interactiva de la API**: Swagger UI en `/docs`, ReDoc en `/redoc` y contrato en `/openapi.json` (ver [Documentación](#6-documentación)).

> La presencia de una pantalla o requisito no demuestra por sí sola que el flujo esté completo; consulta la [matriz de trazabilidad](docs/MATRIZ_TRAZABILIDAD_REQUISITOS.md) y las [evidencias de QA](docs/qa/PEN-10/evidencias/INDEX.md).

## 3. Prerrequisitos

| Herramienta | Versión | Uso |
|---|---|---|
| Git | reciente | Clonar el repositorio |
| Docker Desktop (Windows/macOS) o Docker Engine + Compose | reciente | Ejecutar el stack completo (modo recomendado) |
| Python | 3.12 en contenedor; código compatible con `>=3.10` | Solo necesario si ejecutas el backend sin Docker (`be/.python-version`) |
| `uv` | ≥ 0.4 recomendado | Gestor de dependencias del backend (`be/uv.lock`) |
| Node.js | ≥ 20 LTS | Frontend web y móvil |
| `pnpm` | ≥ 9 | Gestor de paquetes de `fe/` y `movil/` (`pnpm-workspace.yaml`) |
| MySQL | 8.0 | Base de datos (en Docker o instalada localmente) |
| MinIO | actual | Almacenamiento de imágenes y evidencias (en Docker o binario local) |

Servicios externos **opcionales**: SMTP/Gmail o Resend para correos reales (`EMAIL_PROVIDER`), credenciales de Google OAuth para el login con Google. Sin ellos, la aplicación funciona con correos simulados en desarrollo y login local. Los pagos usan el simulador local y no requieren credenciales.

## 4. Instalación local paso a paso

### 4.1 Clonar el repositorio

```sh
git clone https://github.com/nicolmarinoromero-bit/neodomus_actualizaciones.git
cd neodomus_main
```

(Usa la URL de tu fork si trabajas sobre uno.)

### 4.2 Variables de entorno (todos los modos)

Desde la raíz, copia la plantilla y complétala. En PowerShell: `Copy-Item .env.example .env`; en macOS/Linux: `cp .env.example .env`.

Valores mínimos obligatorios (Compose los exige):

- `SECRET_KEY`: genera una con `python -c "import secrets; print(secrets.token_hex(32))"`.
- `MYSQL_ROOT_PASSWORD` y `MYSQL_PASSWORD`: contraseñas locales robustas (≥ 12 caracteres).
- `MINIO_ROOT_PASSWORD`: contraseña de MinIO.
- `DATABASE_URL` ya viene construida para el contenedor; ajústala solo si cambias MySQL.

No publiques `.env` ni lo uses en producción tal cual (ver [Variables de entorno](#5-variables-de-entorno)).

### 4.3 Con Docker (recomendado)

```sh
docker compose up --build
```

Levanta MySQL 8.0 (`3307` en el equipo), API (`8000`), MinIO (`9000`, consola `9001`) y web (`5173`). El contenedor de API ejecuta las migraciones Alembic (`uv run alembic upgrade head`), siembra usuarios de prueba si `EJECUTAR_SEED_AL_ARRANCAR=true` y arranca Uvicorn.

Direcciones locales:

| Servicio | URL |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| Contrato OpenAPI | http://localhost:8000/openapi.json |
| Salud API | http://localhost:8000/health |
| Consola MinIO | http://localhost:9001 |

Guía detallada: [docs/setup/con-docker.md](docs/setup/con-docker.md).

### 4.4 Backend sin Docker

1. Entra a la carpeta y crea el entorno virtual:

```sh
cd be
python -m venv .venv
.venv\Scripts\activate        # Windows (PowerShell: .\.venv\Scripts\Activate.ps1)
source .venv/bin/activate     # macOS/Linux
```

2. Copia la plantilla del backend y configura la conexión: `Copy-Item .env.example .env` (desde `be/`). Con MySQL local expuesto en `3307`, usa `DATABASE_URL=mysql+pymysql://neodomus:CAMBIAR@localhost:3307/neodomus?charset=utf8mb4` y `MINIO_ENDPOINT=127.0.0.1:9000`.
3. Instala dependencias (con `uv` instalado: `pip install uv` si falta):

```sh
uv sync
```

4. Prepara la base de datos (crea el esquema `neodomus` en MySQL 8.0) y ejecuta las migraciones:

```sh
uv run alembic upgrade head
```

5. Arranca el servidor de desarrollo:

```sh
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Para sembrar usuarios/catálogo de prueba (opcional): `uv run python ../scripts/seed_test_users.py` y otros utilitarios descritos en [scripts/README.md](scripts/README.md).

### 4.5 Frontend web sin Docker

```sh
cd fe
pnpm install
Copy-Item .env.example .env   # Windows; en macOS/Linux: cp .env.example .env
pnpm dev                      # Vite en http://localhost:5173
```

La web llama a la API en `VITE_API_URL` (por defecto `http://localhost:8000/api/v1`).

### 4.6 Servicios adicionales sin Docker (MySQL y MinIO)

- **MySQL 8.0**: instálalo o ejecuta `docker run -d --name neodomus_mysql -p 3307:3306 -e MYSQL_ROOT_PASSWORD=<clave> -e MYSQL_DATABASE=neodomus -e MYSQL_USER=neodomus -e MYSQL_PASSWORD=<clave> mysql:8.0`. Ajusta `DATABASE_URL` del backend al puerto/host que uses.
- **MinIO**: ejecuta `docker run -d --name neodomus_minio -p 9000:9000 -p 9001:9001 -e MINIO_ROOT_USER=neodomus -e MINIO_ROOT_PASSWORD=<clave> -v ./minio_data:/data elestio/minio:latest server /data --console-address ":9001"` (misma imagen que Compose). Configura `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` y `MINIO_PUBLIC_ENDPOINT` en `be/.env`.
- **App móvil** (opcional): `cd movil && pnpm install`, copia `movil/.env.example` a `movil/.env` (ajusta `EXPO_PUBLIC_API_URL` según el dispositivo) y ejecuta `pnpm start` (o `pnpm android`).

Guía completa sin Docker: [docs/setup/sin-docker.md](docs/setup/sin-docker.md).

## 5. Variables de entorno

Cada componente tiene su plantilla. Copia la que corresponda a tu forma de ejecución y rellena los valores. Las plantillas **no contienen credenciales reales**.

| Plantilla | Ubicación | Cuándo se usa |
|---|---|---|
| [`.env.example`](.env.example) | raíz | Docker Compose (todas las variables del stack) |
| [`be/.env.example`](be/.env.example) | `be/` | Backend sin Docker |
| [`fe/.env.example`](fe/.env.example) | `fe/` | Frontend web sin Docker |
| [`movil/.env.example`](movil/.env.example) | `movil/` | App móvil |

Principales variables de la plantilla raíz (inicial en negrita):

| Variable | Descripción | Ejemplo seguro |
|---|---|---|
| **MYSQL_ROOT_PASSWORD** | Contraseña de root de MySQL (exigida por Compose) | *(cadena larga aleatoria)* |
| MYSQL_DATABASE | Base de datos de la aplicación | `neodomus` |
| MYSQL_USER | Usuario de aplicación de MySQL | `neodomus` |
| **MYSQL_PASSWORD** | Contraseña del usuario de aplicación | *(cadena larga aleatoria)* |
| DATABASE_URL | Cadena de conexión SQLAlchemy usada por la API | `mysql+pymysql://neodomus:CAMBIAR@db:3306/neodomus?charset=utf8mb4` |
| **SECRET_KEY** | Clave para firmar los JWT | *(generada con `secrets.token_hex(32)`)* |
| ALGORITHM | Algoritmo de firma JWT | `HS256` |
| ACCESS_TOKEN_EXPIRE_MINUTES | Vigencia del token de acceso (min) | `60` |
| REFRESH_TOKEN_EXPIRE_DAYS | Vigencia del token de refresco (días) | `30` |
| ENVIRONMENT | Entorno de ejecución (`development`/`staging`/`production`) | `development` |
| RATE_LIMIT_ENABLED | Activa el limitador de peticiones (slowapi) | `true` |
| RATE_LIMIT_STORAGE_URI | Backend de contadores (`memory://` por proceso o `redis://...` compartido) | `memory://` |
| RATE_LIMIT_HEADERS_ENABLED | Devuelve cabeceras `X-RateLimit-*` y `Retry-After` en los 429 | `true` |
| TRUSTED_PROXIES | IPs/CIDR de proxies autorizados a enviar `X-Forwarded-For` (`*` solo si la API no es accesible directamente) | `127.0.0.1,::1` |
| EJECUTAR_SEED_AL_ARRANCAR | Siembra usuarios de prueba al arrancar (solo desarrollo) | `true` |
| WATCHFILES_FORCE_POLLING / WATCHFILES_POLL_DELAY_MS | Estabilidad del recargador en bind mounts Windows/WSL | `true` / `500` |
| VERIFICATION_TOKEN_EXPIRE_HOURS | Vigencia del código de verificación de registro (h) | `24` |
| PASSWORD_RESET_TOKEN_EXPIRE_MINUTES | Vigencia del código de recuperación (min) | `10` |
| SMTP_HOST / SMTP_PORT / SMTP_USERNAME / SMTP_PASSWORD | Servidor de correo saliente (usar contraseña de aplicación, nunca la personal) | `smtp.gmail.com` / `587` / *(correo)* / *(vacío)* |
| EMAIL_PROVIDER | Proveedor de correo: `smtp`, `gmail_api` o `resend` | `smtp` |
| RESEND_API_KEY / RESEND_FROM_EMAIL | Credenciales de Resend si `EMAIL_PROVIDER=resend` | *(vacío)* / `Neodomus <onboarding@resend.dev>` |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN | Credenciales de Gmail API (secretos) | *(vacío)* |
| GOOGLE_SIGNIN_CLIENT_ID / VITE_GOOGLE_CLIENT_ID | Client ID público del login con Google (no es secreto) | *(valor por defecto del proyecto)* |
| PAYMENT_PROVIDER | Pasarela de pagos (simulador académico) | `simulator` |
| FRONTEND_URL | Origen permitido por CORS y base de enlaces de correo | `http://localhost:5173` |
| FRONTEND_VERIFY_EMAIL_PATH / FRONTEND_RESET_PASSWORD_PATH | Rutas de la web para enlaces de verificación/recuperación | `/verify-email` / `/reset-password` |
| VITE_API_URL | URL de la API que usa la web | `http://localhost:8000/api/v1` |
| MINIO_ROOT_USER / **MINIO_ROOT_PASSWORD** | Credenciales de MinIO (usuario raíz) | `neodomus` / *(cadena larga aleatoria)* |
| MINIO_ENDPOINT | Endpoint MinIO visto por la API | `minio:9000` |
| MINIO_PUBLIC_ENDPOINT | URL pública de los objetos de catálogo | `http://localhost:9000` |
| MINIO_BUCKET | Bucket público del catálogo | `neodomus-media` |
| MINIO_PRIVATE_BUCKET | Bucket privado de evidencias | `neodomus-private` |
| MINIO_ACCESS_KEY / MINIO_SECRET_KEY | Credenciales usadas por la API (sin Docker toman los de root) | `neodomus` / *(igual a MINIO_ROOT_PASSWORD)* |
| MINIO_SECURE | Usar TLS para MinIO | `false` |
| NOTIFICAR_CLIENTE_CAMBIOS_TECNICO | Avisar al cliente cuando el admin reasigna/desactiva un técnico | `false` |
| DISABLE_SCHEDULER | Desactiva tareas programadas (usado en pruebas/E2E) | *(vacío; `1` en pruebas)* |

Variables de frontend (`fe/.env.example`): `VITE_API_URL` y `VITE_GOOGLE_CLIENT_ID`. En Vite, solo las variables con prefijo `VITE_` se exponen al navegador.

Variables de móvil (`movil/.env.example`): `EXPO_PUBLIC_API_URL` (sin el prefijo `/api/v1`; el cliente lo añade). Requiere reiniciar `pnpm start` al cambiarla. Para teléfono físico usa la IP LAN del PC; para emulador Android, `http://10.0.2.2:8000`.

`.gitignore` excluye `.env` y `.env*.local` en todo el repositorio; verifica con `git status` que nunca aparezcan. Para producción, `deploy/.env.prod` también está excluido y `be/app/config.py` valida secretos fuertes cuando `ENVIRONMENT=production`.

## 6. Documentación

- **Índice de documentación**: [docs/README.md](docs/README.md)
- **Matriz de trazabilidad de requisitos (RTM)**: [docs/MATRIZ_TRAZABILIDAD_REQUISITOS.md](docs/MATRIZ_TRAZABILIDAD_REQUISITOS.md)
- **Funciones críticas documentadas**: [docs/documentacion-funciones-criticas.md](docs/documentacion-funciones-criticas.md)
- **Guías de instalación**: [con Docker](docs/setup/con-docker.md) · [sin Docker](docs/setup/sin-docker.md)
- **Referencia técnica**: [arquitectura](docs/referencia-tecnica/architecture.md) · [endpoints](docs/referencia-tecnica/api-endpoints.md) · [esquema de BD](docs/referencia-tecnica/database-schema.md) · [diccionario de datos](docs/referencia-tecnica/diccionario-de-datos.md)
- **Manuales**: [usuario](docs/manuales/usuario/MANUAL_DE_USUARIO.md) · [técnico](docs/manuales/tecnico/MANUAL_TECNICO.md)
- **Requisitos**: [HUs](docs/requisitos/HUs/) · [RFs](docs/requisitos/RFs/) · [RNFs](docs/requisitos/RNs/) · [restricciones](docs/requisitos/restricciones.md)
- **Pruebas**: [tests/README.md](tests/README.md) (guía central) · [evidencias QA PEN-10](docs/qa/PEN-10/evidencias/INDEX.md)

### Documentación interactiva de la API

Con la API corriendo (`http://localhost:8000`):

| Herramienta | URL | Contenido |
|---|---|---|
| Swagger UI | [`/docs`](http://localhost:8000/docs) | 186 rutas agrupadas por módulo, con esquemas y «Try it out» |
| ReDoc | [`/redoc`](http://localhost:8000/redoc) | Referencia legible por módulo, con descripciones y respuestas |
| Contrato | [`/openapi.json`](http://localhost:8000/openapi.json) | Especificación OpenAPI completa (para clientes generados) |

Cada endpoint incluye su método, parámetros, cuerpo (schemas Pydantic), códigos de estado y requisito de autenticación (portador JWT / cookie de sesión). Los módulos están agrupados con etiquetas (`Authentication`, `Pedidos`, `Citas`, `Devoluciones`, …) y los servicios críticos tienen docstrings detalladas (ver [funciones críticas](docs/documentacion-funciones-criticas.md)).

## 7. Pruebas y calidad

| Suite | Comando | Nota |
|---|---|---|
| Backend (unittest + ASGI) | `cd be` y `python -m unittest discover -s app\tests -p "test_*.py"` con `TEST_DATABASE_URL` apuntando a la base `neodomus_test` | Exige MySQL de pruebas; rechaza la base de desarrollo (`be/app/tests/testdb.py`) |
| Frontend (Vitest) | `cd fe && pnpm test` | 108 pruebas unitarias/de componentes con red simulada |
| E2E (Playwright + orquestadores) | `powershell -File tests\run_all_tests.ps1 -IncludeE2E` | Orquestadores en `tests/`; detalles en su README |
| Cobertura backend | `coverage run -m unittest discover -s app\tests -p "test_*.py" && coverage report` (en `be/`) | Config `.coveragerc` |
| Análisis estático | SonarCloud vía GitHub Actions (`.github/workflows/`) | Config `sonar-project.properties` |

Los resultados reales de la última verificación completa están en [docs/qa/PEN-10/evidencias/INDEX.md](docs/qa/PEN-10/evidencias/INDEX.md). Ejecutar las suites **no modifica** funcionalidades; la base de pruebas es independiente de la de desarrollo.

## 8. Estructura del repositorio

```text
be/       API FastAPI: modelos, servicios, routers, migraciones Alembic y pruebas
fe/       Aplicación web React/TypeScript/Vite (pruebas Vitest y E2E Playwright)
movil/    Aplicación Expo/React Native (cliente y técnico)
scripts/  Inicialización, semillas de datos y utilidades E2E
tests/    Orquestadores de pruebas para PowerShell y actas de testing
docs/     Requisitos, referencia técnica, setup, manuales, QA y matriz RTM
deploy/   Recursos de despliegue (excluye .env.prod)
```

## 9. Seguridad y límites conocidos

- No publiques archivos `.env`, credenciales, tokens ni datos personales.
- El bucket de catálogo de MinIO aplica lectura pública (`be/app/services/minio_service.py`); las evidencias del negocio van al bucket **privado** con descarga autorizada por rol/asignación.
- Los pagos usan un simulador académico; no procesan tarjetas reales ni mueven dinero.
- Las URLs de desarrollo no son direcciones de producción verificadas; `ENVIRONMENT=production` activa validaciones de secretos fuertes en `be/app/config.py`.
- El historial completo de defectos conocidos y su estado está en `docs/qa/PEN-*` (ver [defectos por iteración](docs/qa/PEN-10/defectos-encontrados.md)).
