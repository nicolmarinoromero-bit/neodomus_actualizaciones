# Auditoría inicial — Bootcamp Testing ADSO sobre NeoDomus

> Fecha: 2026-11-12 · Ejecutada antes de implementar la Semana 1.
> Rama de trabajo: `testing/bootcamp-adso` (creada desde `main` @ `5987882`, árbol limpio).
> Fuente del temario: https://github.com/ergrato-dev/bc-testing-adso (clonado a
> `%TEMP%\opencode\bc-testing-adso` para lectura; el material NO se copia al repo).

## 1. Estado del repositorio al inicio

| Aspecto | Estado |
|---|---|
| Rama inicial | `main`, limpia, sin cambios pendientes |
| Backend | `be/` — FastAPI 0.115 + SQLAlchemy 2 + PyMySQL, gestión con `uv` (contenedor `api` en marcha) |
| Frontend | `fe/` — React 18 + Vite 5, gestionado con pnpm 11.4 |
| Móvil | `movil/` (Expo) — fuera de alcance: sin infraestructura de testing y no exigido por el temario |
| BD | MySQL 8 (contenedor `neodomus_mysql` publicado en `127.0.0.1:3307`, base de desarrollo `neodomus`) |
| Archivos | MinIO (`neodomus_minio`, 9000/9001) |
| CI | `.github/workflows/tests.yml` (jobs `frontend`, `backend`, `e2e`) + `.github/workflows/sonarcloud.yml` |
| Docker de pruebas | `docker-compose.test.yml` (solo MinIO de pruebas) + scripts `tests/setup_*.ps1` |

## 2. Bootcamp: qué exige y qué ya cumple NeoDomus

Análisis semana por semana del material (README, teoría, recetas, reto, rúbrica)
comparado con el estado real del proyecto:

| Sem | Tema | Estado previo en NeoDomus | Brecha principal |
|---|---|---|---|
| 1 | Pirámide, AAA, primer E2E, línea base de cobertura | Playwright configurado (8 specs + orquestadores Python); acta T0 con cobertura backend 37,29 % líneas | Cobertura de frontend sin configurar (sin `@vitest/coverage-v8`); sin reporte HTML de Playwright; sin matriz de rotación ni umbral registrado; línea base backend desactualizada (la suite creció de 98 a 291 pruebas desde T0) |
| 2 | Unitarias AAA + CI con umbral 30 % | 291 casos unittest (runner del proyecto), 118 Vitest; CI `tests.yml` existe | Umbral de cobertura NO exigido en CI (ni backend ni frontend); sin reportes de cobertura como artefacto; sin `pytest` (el runner del proyecto es `unittest`; se decide añadir pytest como runner adicional compatible) |
| 3 | Componentes React (RTL + user-event) | 30 archivos Vitest con Testing Library | Sin `@testing-library/user-event` (usan `fireEvent`); formularios clave sin probar (Login, Registro, CheckoutPage); umbral 40 % |
| 4 | Pruebas de API (contrato HTTP) | Amplia suite de integración HTTP (t1, checkout, citas, reembolsos…) | Routers sin pruebas: `productos` CRUD admin, `reports`, `devoluciones`, `novedades`, `consultas`, `tarifas`, `solicitudes`, `users` CRUD; escenarios negativos y de Content-Type parciales; umbral 50 % |
| 5 | Dobles de prueba | Mocks de correo/pagos por test en la suite; hooks FE con `vi.mock` | Sin inventario de dependencias externas documentado; sin pruebas dedicadas a fallos de dependencia (MinIO, SMTP, reloj); MSW no usado en frontend |
| 6 | Integración BD real | Suite integrada contra MySQL real `neodomus_test` con aislamiento (testdb.py) | Sin servicio MySQL de pruebas en `docker-compose.test.yml` (el bootstrap depende de contenedores existentes); semillas/limpieza correctas pero sin documentación del ciclo; umbral 70 % |
| 7 | Playwright avanzado | 8 specs, orquestadores con fixtures únicos | 2 specs sin orquestador (metros, chatbot) frágiles; `retries: 0`; sin reporte HTML; sin Page Objects; sin pruebas de doble envío/red lenta |
| 8 | CI completo | CI con MySQL/MinIO efímeros + E2E de 6 flujos | Sin cobertura medida/umbralizada en CI; sin artefactos de cobertura; sin verificación de calidad (lint/tsc) como job; los 15 skip de MinIO en local |
| 9 | Integrador | Documentación dispersa (actas T0/T1/T2, tests/README) | Falta `docs/testing/ESTRATEGIA_DE_PRUEBAS.md`, matriz de trazabilidad y cobertura centralizadas |
| 10 | TDD | No aplicado | Implementar una historia de usuario nueva con RED→GREEN→REFACTOR |

## 3. Ejecución de la línea base (mediciones reales)

| Suite | Comando | Resultado |
|---|---|---|
| Backend (unittest) | `docker compose exec -e TEST_DATABASE_URL=...@db:3306/neodomus_test api uv run python -m unittest discover -s app/tests -p "test_*.py"` | **291 pruebas: OK (15 skipped condicionales de MinIO)** · 239 s · base `neodomus_test` en Alembic `0064 (head)` |
| Frontend (Vitest) | `cd fe && pnpm test` | **30 archivos / 118 pruebas: OK** · 104 s |
| E2E | `tests\run_e2e_tests.ps1` (orquestadores) | No ejecutado en la auditoría: requiere MySQL de pruebas alcanzable por TCP desde el host; se ejecuta en la Semana 1 (ver abajo) |
| Cobertura backend | `coverage` dentro del contenedor `api` | Se re-mide en Semana 1 (T0 registró 37,29 % líneas / 10,65 % ramas con la suite de entonces) |
| Cobertura frontend | — | **No medible todavía**: falta `@vitest/coverage-v8` (se instala en Semana 1) |

### 3.1 Omisiones detectadas en la línea base

Las 15 pruebas omitidas del backend son los casos condicionales de MinIO
(`test_t1_2_minio.py` ×4, `test_foto_perfil_tecnico.py` ×8, parte de
`test_t1_3_permisos.py` ×3): se omiten **honestamente** cuando no hay MinIO de
pruebas configurado (`TEST_MINIO_*`). En la Semana 1 se levanta la infra de
MinIO de pruebas (`docker-compose.test.yml`) para dejar el total en 0 omitidas
en local (en CI ya hay MinIO efímero).

## 4. Restricciones de protección respetadas

- No se modifica la base de desarrollo `neodomus` (guarda dura en `testdb.py`).
- Solo se opera sobre bases `neodomus_test*` con `CREATE DATABASE IF NOT EXISTS`
  + Alembic (idempotente; sin DROP/DELETE/TRUNCATE globales).
- Sin push, sin merge a `main`; commits semanales locales en
  `testing/bootcamp-adso`.
- Credenciales de MinIO de pruebas generadas por sesión y guardadas solo como
  variables de entorno de usuario de esta máquina (nunca en archivos del repo).
- Los cambios previos del equipo (actas T0/T1/T2, `tests/`, orquestadores,
  workflows) se conservan intactos salvo adiciones documentadas.

## 5. Decisiones técnicas registradas

| Decisión | Justificación |
|---|---|
| Mantener `unittest` como runner de la suite heredada y añadir `pytest` para las pruebas nuevas (S2+) | El bootcamp usa pytest (parametrize, xfail, pytest-mock); `pytest` ejecuta también `unittest.TestCase` sin reescribir 291 pruebas. Los nuevos archivos usan pytest; los heredados no se reescriben (protección del proyecto). |
| Añadir `@vitest/coverage-v8` para cobertura de frontend | Receta del bootcamp (week-01/cobertura) adaptada al stack real (Vitest 2 + Vite 5). |
| Runner de cobertura backend: `coverage` ya presente en el proyecto (`.coveragerc`) | Ya configurado por el equipo en T0 con medición de ramas; se reutiliza y se añade umbral vía pytest-cov (`fail_under`) cuando pytest entre al CI. |
| E2E se sigue orquestando con scripts Python por flujo (patrón del proyecto) | Los orquestadores garantizan fixtures aislados + limpieza + servidores efímeros; Playwright `webServer` global no aplica a esta arquitectura de 2 servidores con BD dedicada. |
| Branch `testing/bootcamp-adso` | No se puede garantizar push (sin credenciales/autorización); todo queda local y documentado. |
