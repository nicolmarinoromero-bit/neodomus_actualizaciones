# Matriz de cobertura de NeoDomus

> Medición real por semana (regla del trinquete: el umbral vigente nunca baja
> respecto a la cobertura real anterior). La cobertura se mide sobre TODA la
> lógica de la aplicación; ningún módulo de negocio está excluido.

## Resumen por semana

| Semana | Backend líneas / ramas | Umbral BE vigente | Frontend líneas / ramas / funciones | Umbral FE vigente |
|---|---|---|---|---|
| S1 (línea base) | **56.08 % / 31.20 %** (Cover combinado 50 %) | 56 / 31 (piso real) | **27.55 % / 68.94 % / 38.51 %** | 27 / 68 / 38 |
| S2 | 56.09 % líneas / 31.20 % ramas (Cover 50.53 %) | **50** (combinado, trinquete) | **30.01 % / 72.77 % / 42.92 %** | **30 / 72 / 42** |
| S3 | 56.09 % líneas / 31.20 % ramas (Cover 50.53 %) | 50 (piso semanal 40) | **40.92 % / 74.20 % / 50.00 %** | **40 / 74 / 50** |
| S4 | **59.91 % líneas / 36.25 % ramas** (Cover combinado 54.51 %) | 50 (combinado, piso semanal 50) | **52.75 % / 74.01 % / 54.61 %** | **52 / 74 / 54** |
| S5 | **60.64 % líneas / 36.25 % ramas** (Cover combinado 60.64 %) | **60** (combinado, piso semanal 60) | **64.84 % / 75.24 % / 58.73 %** | **60 / 74 / 58 / 60** |
| S6 | **81.87 % líneas / 80.30 % ramas** (Cover combinado 82 %) | **70** (piso semanal 70) | **70.31 % / 76.50 % / 60.85 %** | **70 / 76 / 60 / 70** |
| S7 | **81.87 % líneas / 80.30 % ramas** (sin cambios BE en S7) | 70 | **78.23 % / 77.89 % / 64.79 %** | **75 / 76 / 60 / 75** |
| S8 | **81.86 % combinado** (líneas 85.95 % / ramas 68.00 % según `coverage json`) | **80** | **80.94 % / 78.82 % / 66.26 %** | **80 / 78 / 65 / 80** |
| S9–S10 | — | 80 % | — | 80 % |

> La métrica "Cover" de `coverage report` (con `branch=True`) combina líneas y
> ramas; los pisos del bootcamp se aplican sobre **líneas** y se registra la
> rama aparte. Referencia histórica (acta T0, suite de entonces = 98 pruebas):
> 37.29 % líneas / 10.65 % ramas.

## Semana 1 — línea base (medición real 2026-11-12)

### Backend (suite: 291 pruebas, OK, 0 omitidas)

- Comando: `coverage run --source=app --branch -m unittest discover …` dentro
  del contenedor `api` sobre MySQL+MinIO de pruebas.
- **Líneas: 56.08 %** (5895 / 10511) · **Ramas: 31.20 %** (969 / 3106)
  · Cover combinado: **50 %** (`be/htmlcov/`, `be/coverage.xml` en el
  contenedor; XML copiado a las evidencias de la sesión).

Módulos con menor cobertura (objetivos S2–S8):

| Módulo | Cobertura | Nota |
|---|---|---|
| `services/recomendacion_service.py` | **0 %** | Objetivo unitarias S2 |
| `utils/gmail_api.py` | 0 % | Dependencia externa (S5) |
| `schemas/producto.py` | 0 % | S2 |
| `services/tareas_programadas.py` | 12 % | Scheduler (S5/S6) |
| `services/scheduler.py` | 19 % | Scheduler (S5/S6) |
| `routers/solicitudes.py` | 19 % | API S4 |
| `routers/consultas.py` | 20 % | API S4 |
| `services/novedades_service.py` | 22 % | API S4 |
| `routers/calificaciones.py` | 22 % | API S4 |
| `routers/novedades.py` | 25 % | API S4 (438 stmts) |
| `services/reportes_service.py` | 26 % | API S4 |
| `routers/clientes.py` | 28 % | API S4 |
| `routers/citas.py` | 39 % | API S4 (859 stmts, el mayor) |
| `routers/tarifas.py` | 39 % | API S4 |
| `routers/tecnicos.py` | 40 % | API S4 (662 stmts) |
| `services/auth_service.py` | 39 % | S2/S4 |
| `routers/reembolsos.py` | 43 % | API S4 |
| `routers/devoluciones.py` | 45 % | API S4 (433 stmts) |
| `services/pedidos_service.py` | 45 % | S4/S6 (757 stmts) |
| `routers/productos.py` | 48 % | API S4 (497 stmts) |
| `services/notificaciones.py` | 50 % | S5 (dobles de correo) |

### Frontend (suite: 30 archivos / 118 pruebas, todas OK)

- Comando: `cd fe && pnpm test --coverage` (v8).
- **Líneas 27.55 % · ramas 68.94 % · funciones 38.51 % · statements 27.55 %**.
- Umbrales fijados en `fe/vitest.config.ts` (piso = medición redondeada abajo):
  líneas 27 · ramas 68 · funciones 38 · statements 27.
- Áreas sin cubrir (priorizadas S2–S3): componentes `admin/`, `components/auth/`
  (AuthModalHost, DatosModal), `components/layout/` (Navbar, RoleRoute,
  PrivateRoute, paneles técnico/admin), `components/profile/` (CampoEmail,
  PasswordTab, PaymentsTab, ServiciosTab, PerfilCuenta), `pages/public/`
  (Login, Register, CheckoutPage), `utils/favoritos.ts`, `utils/tabStorage.ts`,
  `i18n/translations.ts` (construirT) y `translateLocalizedMessage.ts`.

## Registro de mediciones

| Fecha | Suite | Resultado | Cobertura | Comando |
|---|---|---|---|---|
| 2026-11-12 | BE unittest completa | 291 OK · 0 omitidas | — | contenedor `api` |
| 2026-11-12 | BE cobertura | 291 OK | 56.08 % líneas / 31.20 % ramas | `coverage run --branch` (contenedor) |
| 2026-11-12 | FE completa | 118/118 OK | — | `pnpm test` |
| 2026-11-12 | FE cobertura | 118/118 OK | 27.55 % líneas | `pnpm test --coverage` |
| 2026-11-12 | E2E login (nuevo) | 4/4 × 2 corridas | — | `python scripts/e2e_login.py` |
| 2026-11-13 | BE pytest S2 (unitarias+suite) | 343 passed | 50.53 % combinado (umbral 50 ✓) | `pytest app/tests -q` (contenedor) |
| 2026-11-13 | FE cobertura S2 | 196/196 OK (42 archivos) | 30.01 % líneas / 72.77 % ramas | `pnpm test --coverage` |
| 2026-11-13 | Umbral FE en rojo (verificación) | 1 archivo → 0.15 % < 30 % → ERROR | — | `pnpm vitest run src/utils/metros.test.ts --coverage` |
| 2026-11-13 | FE cobertura S3 | 257/257 OK (49 archivos) | 40.92 % líneas / 74.20 % ramas | `pnpm test --coverage` |
| 2026-11-13 | BE pytest S4 (contrato API + H-4) | 386 passed · 0 skipped | 59.91 % líneas / 36.25 % ramas / **54.51 % combinado** (umbral 50 ✓) | `pytest app/tests -q` (contenedor) |
| 2026-11-13 | FE cobertura S4 | 316/316 OK (55 archivos) | 52.75 % líneas / 74.01 % ramas / 54.61 % funciones | `pnpm test --coverage` |
| 2026-11-13 | FE trinquete S4 en rojo (verificación) | 55 archivos, 316 OK, cobertura de ramas 73.12 % < 74 % → ERROR | — | `pnpm test --coverage` |
| 2026-11-13 | FE trinquete S4 en verde | 316/316 OK, ramas 74.01 % | 52.75 % líneas | `pnpm test --coverage` |
| 2026-11-13 | BE pytest S5 (dobles + contrato) | **517 passed · 0 skipped** | **60.64 % líneas / 36.25 % ramas / 60.64 % combinado** (umbral 60 ✓) | `pytest app/tests -q` (contenedor) |
| 2026-11-13 | FE cobertura S5 | **379/379 OK (61 archivos)** | **64.84 % líneas / 75.24 % ramas / 58.73 % funciones** | `pnpm test --coverage` |
| 2026-11-13 | E2E S5 técnico (page.route) | **2/2 passed** | — | `python scripts/e2e_tecnico_novedades.py` |
| 2026-11-13 | E2E S5 admin (page.route) | **2/2 passed** | — | `python scripts/e2e_admin_instalaciones.py` |
| 2026-11-13 | BE pytest S6 (integración MySQL real, 65 pruebas nuevas) | **582 passed · 0 skipped** | **81.87 % líneas / 80.30 % ramas / 82 % combinado** (umbral 70 ✓) | `pytest app/tests -q` (contenedor, `neodomus_test`) |
| 2026-11-13 | FE cobertura S6 | **431/431 OK (67 archivos)** | **70.31 % líneas / 76.50 % ramas / 60.85 % funciones** | `pnpm exec vitest run --coverage` |
| 2026-11-14 | E2E S7 login (Page Objects, 4 × 2 repeticiones) | **8 passed · EXIT 0** | — | `python scripts/e2e_login.py` con `E2E_REPEAT_EACH=2` |
| 2026-11-14 | E2E S7 compra (dos corridas independientes) | **2/2 passed en cada corrida · EXIT 0** | — | `python scripts/e2e_cart_checkout.py` (repetición 1) |
| 2026-11-14 | E2E S7 admin (9 × 2 repeticiones) | **18 passed · EXIT 0** | — | `python scripts/e2e_admin_paginacion.py` con `E2E_REPEAT_EACH=2` |
| 2026-11-14 | FE cobertura S7 (medición) | **522/522 OK (77 archivos)** | **78.23 % líneas / 77.89 % ramas / 64.79 % funciones** | `pnpm exec vitest run --coverage --minWorkers=1 --maxWorkers=4` |
| 2026-11-14 | FE cobertura S7 (trinquete 75) | **522/522 OK · EXIT 0** | 78.23 % líneas / 77.89 % ramas / 64.79 % funciones | misma corrida con thresholds 75/76/60/75 |
| 2026-11-14 | FE cobertura S8 (medición) | **572/572 OK (84 archivos)** | **80.94 % líneas / 78.82 % ramas / 66.26 % funciones** | `pnpm exec vitest run --coverage --minWorkers=1 --maxWorkers=4` |
| 2026-11-14 | FE cobertura S8 (trinquete 80) | **572/572 OK · EXIT 0** | 80.94 % líneas / 78.82 % ramas / 66.26 % funciones | misma corrida con thresholds 80/78/65/80 |
| 2026-11-14 | BE pytest S8 (umbral 80, endpoint MinIO corregido) | **582 passed · 0 skipped · EXIT 0** | **81.86 % combinado** (líneas 85.95 % / ramas 68.00 %) | `pytest app/tests -q -rs` (contenedor, `neodomus_test`) |
| 2026-11-14 | Workflow `coverage.yml` | YAML válido · 2 jobs · guardia 0 skipped | — | `yaml.safe_load` sobre el archivo |

## Semanas siguientes (plantilla de registro)

| Fecha | Suite | Resultado | Cobertura | Comando |
|---|---|---|---|---|
| (S2) | | | | |

