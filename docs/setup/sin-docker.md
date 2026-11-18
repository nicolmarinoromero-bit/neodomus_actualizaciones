# Instalación local sin Docker

Guía basada en el layout actual `be/`, `fe/` y `movil/`. Requiere disponer de MySQL y servicios externos configurados por separado. No se comprobó esta instalación ejecutando los servicios.

## Requisitos indicados por el repositorio

- Python 3.11 o superior según `be/pyproject.toml`; `be/Dockerfile` usa Python 3.12.
- Node.js 22 según `fe/Dockerfile` y el frontend configurado.
- MySQL 8.0 para alinearse con `docker-compose.yml`.
- `uv` para dependencias Python y pnpm 11.4.0 para frontend y app móvil. El frontend declara `packageManager: pnpm@11.4.0` y su lockfile oficial es `pnpm-lock.yaml`.

## 1. Base de datos y servicios

Crea una base MySQL local `neodomus` y un usuario de desarrollo con permisos para esa base. No reutilices contraseñas de ejemplo en entornos compartidos. Para correo, MinIO y Google OAuth revisa los ajustes necesarios en `be/app/config.py` y `.env.example`.

## 2. Backend

Desde `be/` crea un entorno e instala dependencias declaradas:

```sh
uv sync
```

Configura `be/.env` con una `DATABASE_URL` que use `localhost` y el puerto MySQL local (normalmente 3306), una `SECRET_KEY` aleatoria y la configuración de servicios que usarás. Usa como referencia las variables de `.env.example` en la raíz; el backend carga `.env` desde su directorio actual.

Aplica las migraciones y arranca la API:

```sh
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API: `http://localhost:8000`; Swagger predeterminado de FastAPI: `/docs`; salud: `/health`.

## 3. Aplicación web

En otra terminal, desde `fe/` instala las dependencias con pnpm usando el lockfile versionado:

```sh
pnpm install
pnpm dev
```

Vite sirve por defecto en `http://localhost:5173`. Para apuntar la web a otro backend, configura `VITE_API_URL` antes de iniciar (valor por defecto en el cliente: `http://localhost:8000/api/v1`).

## 4. Aplicación móvil (opcional)

Desde `movil/`, instala las dependencias según el lockfile del proyecto y configura `movil/.env` con `EXPO_PUBLIC_API_URL`, sin `/api/v1`. La app agrega el prefijo automáticamente. En teléfono físico usa una IP LAN alcanzable; para emulador Android la plantilla propone `http://10.0.2.2:8000`.

```sh
pnpm install
pnpm start
```

Consulta `movil/README.md` y `movil/.env.example`. En la revisión del 18 de noviembre de 2026, `movil/package.json` declara Expo 58.0.23, Expo Router 58.0.30 y React Native 0.88.1. Los archivos de instrucciones o reportes fechados anteriormente pueden conservar versiones históricas; usa el manifiesto y la lockfile del checkout para preparar el entorno.

## Límites y diagnóstico

- No incluyas secretos en archivos versionados ni en reportes.
- Una falla de conexión puede provenir de `DATABASE_URL`, CORS, SMTP, MinIO o URL de API no accesible.
- Los archivos de migración de `be/alembic/versions/` son la referencia para el esquema; no ejecutes scripts de inicialización sin revisar su efecto.
- Para un arranque reproducible con todos los servicios, usa [Docker](con-docker.md).
