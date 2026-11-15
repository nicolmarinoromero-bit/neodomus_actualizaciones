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
| Dobles de red frontend | MSW 2.11.3 (`msw/node`) + `vi.mock` | `fe/vitest.config.ts` (setup) | — (no aplica) |
| Dobles backend | `unittest.mock` + restauración por prueba | `be/app/tests/testdb.py` | — (no aplica) |
| BD de pruebas | MySQL 8 (`neodomus_test`) | `TEST_DATABASE_URL` + guardas de `testdb.py` | — |
| Archivos de pruebas | MinIO dedicado (`neodomus_minio_test`, 9100) | `docker-compose.test.yml` + `TEST_MINIO_*` | — |
| CI | GitHub Actions | `.github/workflows/tests.yml` (suite) + `.github/workflows/coverage.yml` (cobertura, S8) | Semana 2+ |

## 2. Comandos exactos (esta máquina)

Variables de sesión (nunca en archivos):

```powershell
. $env:TEMP\opencode\testenv.ps1   # carga TEST_MINIO_* / MYSQL_* del registro de usuario
$env:TEST_DATABASE_URL = "mysql+pymysql://neodomus:$env:MYSQL_PASSWORD@db:3306/neodomus_test?charset=utf8mb4"      # modo contenedor (unittest)
$env:TEST_DATABASE_URL = "mysql+pymysql://neodomus:$env:MYSQL_PASSWORD@localhost:3307/neodomus_test?charset=utf8mb4" # modo host (E2E)
```

Backend (contenedor `api`, base de pruebas migrada a head —la suite actual
tiene 582 pruebas, incluidas las 65 de integración de S6— y umbral de
cobertura 80 desde S8):

```powershell
# Suite completa con cobertura y umbral vigente (pytest, S2+)
. $env:TEMP\opencode\testenv.ps1
$url = "mysql+pymysql://neodomus:$env:MYSQL_PASSWORD@db:3306/neodomus_test?charset=utf8mb4"
docker compose exec -T -e TEST_DATABASE_URL=$url `
  -e TEST_MINIO_ENDPOINT=neodomus-minio-test:9000 `
  -e TEST_MINIO_PUBLIC_ENDPOINT=http://localhost:9100 `
  -e TEST_MINIO_ACCESS_KEY=$env:TEST_MINIO_ACCESS_KEY `
  -e TEST_MINIO_SECRET_KEY=$env:TEST_MINIO_SECRET_KEY `
  -e TEST_MINIO_BUCKET=$env:TEST_MINIO_BUCKET `
  -e TEST_MINIO_PRIVATE_BUCKET=$env:TEST_MINIO_PRIVATE_BUCKET `
  api uv run pytest app/tests -q -rs
```

`neodomus_minio_test` debe estar arriba (`docker start neodomus_minio_test`)
tras reiniciar Docker Desktop. Las pruebas S6 crean y limpian sus propias
fixtures en `neodomus_test`; nunca se ejecutan dos suites a la vez.

Frontend (host; suite actual: 84 archivos / 572 pruebas; umbral vigente 80/78/65/80):

```powershell
cd fe
pnpm test            # Vitest run (suite completa)
pnpm test --coverage # Vitest + cobertura v8 (reporte en fe/coverage/)
# En esta máquina, la suite completa con cobertura se ejecuta con:
pnpm exec vitest run --coverage --minWorkers=1 --maxWorkers=4 --testTimeout=60000
```

E2E (host; orquestadores con servidores efímeros):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests\run_e2e_tests.ps1 -List
powershell -NoProfile -ExecutionPolicy Bypass -File tests\run_e2e_tests.ps1 -Name login
# Un flujo suelto:
python scripts\e2e_login.py
# Flujos S5 (red interceptada con page.route; no escriben en la BD):
python scripts\e2e_tecnico_novedades.py
python scripts\e2e_admin_instalaciones.py
# Repetición de cada prueba S7 para detectar flakiness:
$env:E2E_REPEAT_EACH = "2"
python scripts\e2e_login.py
python scripts\e2e_admin_paginacion.py
Remove-Item Env:E2E_REPEAT_EACH
# Reporte HTML del último run:
cd fe; pnpm exec playwright show-report
```

- Los Page Objects viven en `fe/e2e/pages/` (`LoginPage`, `CartCheckoutPage`,
  `AdminPaginationPage`, `AdminProductosPage`). Playwright usa transformación
  *strip-only*: hay que asignar `page` explícitamente, sin parameter
  properties.
- `cart-checkout` debe ejecutarse con `E2E_REPEAT_EACH=1`: su verificador
  exige un único pedido por cliente. Su estabilidad se demuestra con dos
  ejecuciones independientes, no con `repeat-each`.
- No se permiten `waitForTimeout` en `fe/e2e/`; la sincronización usa las
  aserciones con auto-waiting de Playwright.
- Verificación de tipos de E2E (host, sin incluir los specs en el build de Vite):
  `node node_modules/typescript/bin/tsc --noEmit --target ES2022 --module ESNext
  --moduleResolution bundler --skipLibCheck --strict <pages y specs>`, con
  **EXIT 0** al cierre de S7.

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
- Las pruebas S6 usan `be/app/tests/s6_base.py`, que borra en orden FK-safe
  (hijos → padres), limpia `PasswordResetToken` y verifica el estado persistido
  antes de cerrar; la suite completa no deja residuos en `neodomus_test`.
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

## 7. Inventario de dependencias externas y dobles (Semana 5)

| Dependencia | Capa | Doble aplicado | Archivo de pruebas |
|---|---|---|---|
| MinIO (S3) | BE | Cliente real contra MinIO dedicado de pruebas, sustituido por `mock` cuando se prueba el fallo | `be/app/tests/test_s5_minio_dobles.py` |
| SMTP | BE | `_send_email_sync` / `_send_email` sustituidos; restauración en el propio caso | `be/app/tests/test_s5_email_dobles.py` |
| Gmail API | BE | `gmail_api` sustituido; se valida el mensaje construido sin llamada externa | `be/app/tests/test_s5_gmail_api_dobles.py` |
| Reloj | BE | `datetime`/zona horaria controlados con `freezegun`-estilo manual | `be/app/tests/test_s5_pagos_reloj.py` |
| Pasarela de pagos | BE | Tarjeta simulada por terminación (`...0001` rechaza) | `be/app/tests/test_s5_pagos_reloj.py` |
| Scheduler | BE | Tareas invocadas directamente, sin hilos ni esperas reales | `be/app/tests/test_s5_scheduler_tareas.py` |
| Recomendación de técnicos | BE | Ranking determinista con datos de prueba acotados | `be/app/tests/test_s5_recomendacion_tecnicos.py` |
| Red HTTP | FE | MSW 2.11.3 (`msw/node`) + `vi.mock` para módulos con efectos | `*.test.tsx` de S5 |
| Sesión E2E | E2E | `page.route` para `/auth/session`, `/users/me` y endpoints de datos | `fe/e2e/semana5-*.e2e.spec.ts` |

Reglas de aislamiento:

- `be/app/tests/testdb.py` guarda las implementaciones reales de correo,
  adjuntos y scheduler (`_send_email_sync_original`, `_send_email_original`,
  `_adjunto_original`, `_iniciar_scheduler_original`,
  `_detener_scheduler_original`) y las restaura dentro de cada caso: un parche
  global contaminaría el resto de la suite.
- `fe/pnpm-workspace.yaml` declara `allowBuilds: {msw: true, esbuild: true}`
  porque pnpm 11 ignora `pnpm.onlyBuiltDependencies` y falla con
  `ERR_PNPM_IGNORED_BUILDS` al instalar MSW.
- Los E2E S5 levantan Vite contra el backend real solo para servir la SPA; las
  rutas de datos se interceptan y ningún recorrido escribe en `neodomus`.

## 8. CI de cobertura (Semana 8)

Workflow propio `.github/workflows/coverage.yml`; **no modifica** `tests.yml`
ni `sonarcloud.yml` (archivos ajenos).

| Job | Servicios | Qué ejecuta | Artefactos |
|---|---|---|---|
| `frontend-coverage` | Node 22 + pnpm 11.4.0 | `pnpm exec vitest run --coverage --minWorkers=1 --maxWorkers=2 --testTimeout=60000` con umbrales 80/78/65/80 | `fe/coverage/lcov.info`, `coverage-summary.json`, `index.html` |
| `backend-coverage` | MySQL 8 (`neodomus_test`) + MinIO efímero (`server /data`) | Alembic head + `pytest app/tests -q -rs` con `--cov=app --cov-branch --cov-fail-under=80`, HTML y JUnit | `be/coverage.xml`, `be/htmlcov`, `be/backend-junit.xml`, `be/backend-pytest.txt` |

- Credenciales de CI **dummy** creadas y destruidas con cada job
  (`neodomus_ci_user`, `ci_minio_user`); nunca se usan las de desarrollo.
- El job backend incluye una guardia que lee `backend-junit.xml` y falla si
  `skipped > 0`. La medición local de S8 cerró con **582 passed, 0 skipped**.
- En local el endpoint de MinIO para pruebas dentro del contenedor es
  `neodomus-minio-test:9000`; `localhost:9100` solo sirve desde el host.
- Validación local del YAML (sin poder ejecutar GitHub Actions desde esta
  máquina): `yaml.safe_load` sobre el archivo, con 2 jobs y 7/11 pasos.
  Los comandos equivalentes de FE y BE ya se ejecutaron en local con
  **EXIT 0** y cobertura por encima del umbral.

## 9. Documentos de estrategia y trazabilidad (Semana 9)

| Documento | Contenido | Cuándo consultarlo |
|---|---|---|
| `docs/testing/ESTRATEGIA_DE_PRUEBAS.md` | Objetivo, alcance, principios, niveles, riesgos, ambientes, criterios de entrada/salida, trinquete, gestión de defectos, CI y mejoras pendientes | Antes de planear una prueba nueva o justificar una exclusión |
| `docs/testing/MATRIZ_DE_TRAZABILIDAD.md` | 44 HU agrupadas en 35 filas (26 cubiertas, 5 parciales, 1 brecha, 3 N/A), defectos H-1…H-12 y brechas declaradas | Para saber qué prueba cubre cada requisito y qué falta |
| `docs/MATRIZ_TRAZABILIDAD_REQUISITOS.md` | RTM histórica del equipo (2026-11-12; 291 BE / 108 FE) | Referencia; no se modifica desde el bootcamp |

Regla de mantenimiento: si se renombra o elimina un archivo de prueba citado,
la matriz debe actualizarse en el mismo cambio. Los conteos de la matriz se
verifican contra el árbol real antes de cada cierre semanal.
