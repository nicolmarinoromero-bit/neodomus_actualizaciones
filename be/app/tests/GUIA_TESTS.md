# Guía de pruebas del backend NEODOMUS

## Cómo funciona la infraestructura

- **NUNCA** se corre contra la BD de producción (`neodomus`). El conftest
  raíz `be/conftest.py` fija `DATABASE_URL` a la BD de pruebas **antes**
  de que se importe el paquete `app`.
- `be/app/tests/conftest.py` aplica las migraciones reales de Alembic a la
  BD de pruebas, siembra catálogos (roles, tipos de documento), limpia
  **todas** las tablas tras cada test (TRUNCATE) y stubea infraestructura
  externa: SMTP (nunca envía correos reales), MinIO (subidas simuladas con
  URL falsa), `respaldar_usuarios()` (no reescribe `scripts/init_db.sql`) y
  el rate limiter (se reinicia por test).
- `be/app/tests/factories.py`: fábricas reutilizables.
- Ejemplos de estilo: `test_auth.py` (64 tests) y `test_aislamiento.py`.

## Cómo ejecutar (desde la raíz del repo, Git Bash)

Cada suite usa **su propia base de datos** (ya creadas: `neodomus_test`,
`neodomus_test_1`, `neodomus_test_2`, `neodomus_test_3`):

```bash
docker compose exec -e TEST_DATABASE_URL="mysql+pymysql://neodomus:neodomus123@db:3306/TU_BD?charset=utf8mb4" \
  api uv run pytest app/tests/archivo.py -q --no-cov
```

- **Siempre** pásale `TEST_DATABASE_URL` con TU base de datos (la que viene
  indicada en tu tarea). Sin ella, se usa `neodomus_test` (compartida).
- Itera con `--no-cov`; la corrida final de cobertura la hace el orquestador.
- MSYS/Git Bash: rutas de contenedor con `//app/...` (no `/app/...`).
  No pipées la salida de `docker` a `head` (SIGPIPE aborta el proceso).

## Fixtures disponibles (en `conftest.py`)

- `client` → `httpx.AsyncClient` (ASGITransport) con `get_db` sobreescrito
  a la sesión `db`; base `http://test`; prefijo real de la API: `/api/v1/...`.
- `db` → sesión SQLAlchemy conectada a la BD de pruebas.
- `cliente_logueado` → `(cliente, tokens)` — login real vía `/auth/login`.
- `admin_logueado` → `(usuario, tokens)` — rol administrador.
- `tecnico_logueado` → `(usuario, ficha_tecnico, tokens)`.

## Factories (`from app.tests.factories import ...`)

`crear_cliente(db, **kw)`, `crear_empleado(db, rol="administrador", **kw)`,
`crear_tecnico(db, usuario=None, **kw)`, `crear_categoria(db, **kw)`,
`crear_producto(db, **kw)`, `login(client, email, password, user_type)`
(async), `auth_headers(tokens)`.

Todos los kwargs sobrescriben los valores por defecto (p. ej.
`is_active=False`, `id_rol_u=None`, `documento_cliente=...`). Contraseña por
defecto de las factories: `Test1234!` (solo datos de prueba).

## Convenciones

- `asyncio_mode = auto`: los tests async no llevan marcador (el de
  `test_auth.py` es opcional/heredado).
- Docstrings y mensajes en español; nombres descriptivos (`test_<endpoint>_<caso>`).
- Cada test valida: código HTTP, estructura JSON relevante, autenticación
  (401 sin token / token inválido), autorización (403 rol incorrecto),
  validaciones (422), no encontrados (404), duplicados (400) y que las
  respuestas **no** expongan `password_hash`, `password` ni tokens internos.
- No hagas mocks de la lógica de negocio: solo la infraestructura externa
  ya está stubeada por el conftest.
- No modifiques código de producción (`be/app/**` fuera de `tests/`),
  `conftest.py`, `factories.py`, `pytest.ini`, ni la compose. Si encuentras
  un bug real, escribe el test que documente el comportamiento ACTUAL y
  anótalo en `be/app/tests/hallazgos/<tu_archivo>.md` (lo revisa el
  orquestador).

## Inventario de endpoints

```bash
grep -n "@router\." be/app/routers/*.py
```

Routers: `auth, users, clientes, tecnicos, productos, citas, solicitudes,
reports, consultas, pedidos, tarifas, calificaciones, notificaciones,
especializaciones, reembolsos, devoluciones, novedades`.
