# Configuración de testing de NeoDomus

> Documento de la Semana 1 del bootcamp (receta "medir la cobertura desde el
> día 1" + anatomía de un E2E), adaptado al stack real del proyecto.
> Complementa `tests/README.md` (guía central del equipo). Aquí solo se añade
> lo configurado por el bootcamp.

## 1. Capas y herramientas

| Capa | Runner | Config | Cobertura |
|---|---|---|---|
| Unitarias/integración backend | `unittest` (heredada) + `pytest` (nueva, Semana 2) | `be/.coveragerc` | `coverage` (líneas + ramas, `source=app`) |
| Unitarias/componentes frontend | Vitest 2 + Testing Library | `fe/vitest.config.ts` | `@vitest/coverage-v8` (líneas/ramas/funciones) |
| E2E | Playwright 1.48 + orquestadores Python | `fe/playwright.config.ts` | — (no aplica) |
| BD de pruebas | MySQL 8 (`neodomus_test`) | `TEST_DATABASE_URL` + guardas de `testdb.py` | — |
| Archivos de pruebas | MinIO dedicado (`neodomus_minio_test`, 9100) | `docker-compose.test.yml` + `TEST_MINIO_*` | — |
| CI | GitHub Actions | `.github/workflows/tests.yml` | Semana 2+ |

## 2. Comandos exactos (esta máquina)

Variables de sesión (nunca en archivos):

```powershell
. $env:TEMP\opencode\testenv.ps1   # carga TEST_MINIO_* / MYSQL_* del registro de usuario
$env:TEST_DATABASE_URL = "mysql+pymysql://neodomus:$env:MYSQL_PASSWORD@db:3306/neodomus_test?charset=utf8mb4"      # modo contenedor (unittest)
$env:TEST_DATABASE_URL = "mysql+pymysql://neodomus:$env:MYSQL_PASSWORD@localhost:3307/neodomus_test?charset=utf8mb4" # modo host (E2E)
```

Backend (contenedor `api`, base de pruebas migrada a head):

```powershell
# Suite completa (291 pruebas)
docker compose exec -T -e TEST_DATABASE_URL=$url api uv run python -m unittest discover -s app/tests -p "test_*.py"
# Cobertura (líneas + ramas) con reportes HTML/XML
docker compose exec -T -e TEST_DATABASE_URL=$url api uv run coverage run --source=app --branch -m unittest discover -s app/tests -p "test_*.py"
docker compose exec -T api uv run coverage report; docker compose exec -T api uv run coverage html; docker compose exec -T api uv run coverage xml
```

Frontend (host):

```powershell
cd fe
pnpm test            # Vitest run (suite completa)
pnpm test --coverage # Vitest + cobertura v8 (reporte en fe/coverage/)
```

E2E (host; orquestadores con servidores efímeros):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests\run_e2e_tests.ps1 -List
powershell -NoProfile -ExecutionPolicy Bypass -File tests\run_e2e_tests.ps1 -Name login
# Un flujo suelto:
python scripts\e2e_login.py
# Reporte HTML del último run:
cd fe; pnpm exec playwright show-report
```

## 3. Cobertura: qué se incluye y qué se excluye

### Frontend (`fe/vitest.config.ts` → `test.coverage`)

- **Incluye**: `src/**/*.{ts,tsx}` (lógica, hooks, contextos, componentes, páginas).
- **Excluye** (no es lógica de negocio medible): `src/main.tsx` y `src/App.tsx`
  (arranque/rutas), `src/types/**`, `src/vite-env.d.ts`, `src/i18n/**`
  (traducciones declarativas; las claves críticas ya tienen test de claves),
  `src/data/**`, `src/assets/**`, `src/test/**` (infra de pruebas).
- Ningún módulo con lógica de negocio está excluido (regla del bootcamp).

### Backend (`be/.coveragerc`)

- `source = app`, `branch = True`, omitiendo solo `app/tests/*`.

## 4. Datos de prueba

- Toda suite exige base de pruebas `neodomus_test` (guarda dura en
  `be/app/tests/testdb.py`: rechaza `neodomus` y exige esquema migrado).
- Cada prueba crea sus propias fixtures (usuarios/productos únicos por `uuid`)
  y las limpia en `tearDown`/`finally`; los orquestadores E2E validan limpieza
  (`Fixtures propios restantes: 0`).
- Correos de prueba: `@example.com` (reservado IANA, aceptado por
  `EmailStr`). El TLD `.test` fue **rechazado** por `email-validator==2.1.0`
  (defecto corregido en Semana 1; ver PROGRESO).
- MinIO: solo buckets con la palabra `test` (`neodomus-test-media`,
  `neodomus-test-private`); credenciales exclusivas por entorno de sesión.

## 5. Redes y aislamiento de contenedores

- `neodomus_api` se conecta además a la red `neodomus_tests_net`
  (`docker network connect neodomus_tests_net neodomus_api`) para alcanzar el
  MinIO de pruebas por el alias interno `neodomus-minio-test:9000`
  (modo contenedor). El desarrollo (red `neodomus_net`, puertos 9000/9001)
  queda intacto.
- E2E en host usa el MySQL de desarrollo publicado en `127.0.0.1:3307`
  apuntando SIEMPRE a la base `neodomus_test` (nunca a `neodomus`).

## 6. Reglas de operación aprendidas en S1

- **Nunca lanzar dos suites concurrentes sobre `neodomus_test`**: los tests de
  concurrencia de la suite de auditoría usan sesiones/locks reales y una
  segunda suite induce `Lock wait timeout` en cascada.
- **No interrumpir una corrida de cobertura a mitad de ejecución**: si se
  aborta (timeout externo), las fixtures de los tests en vuelo quedan en la
  base de pruebas y contaminan listados admin (`GET /clients`, `GET
  /productos` devuelven 500 ante filas con datos fuera de contrato). Tras un
  aborto: limpiar las filas con prefijos de la suite (`t2.*`, `audit.*`,
  `REF-*`, `b2.*`, `b11.*`) en orden de FKs antes de volver a medir.
- El servidor dev (`uvicorn --reload` del contenedor `api`) recarga al editar
  código de `be/app`; es indiferente para la base de pruebas pero puede
  añadir segundos de latencia la primera vez tras un cambio.
