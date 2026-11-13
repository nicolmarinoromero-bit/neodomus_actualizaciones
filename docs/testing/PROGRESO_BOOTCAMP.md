# Progreso del Bootcamp Testing ADSO — NeoDomus

> Plan de ejecución semana por semana (S1 → S10) con su estado, evidencia y
> resultados reales. Este archivo se actualiza al cerrar cada semana.
> Auditoría de partida: `docs/testing/AUDITORIA_INICIAL.md`.

## Plan de ejecución

| Sem | Tema (bootcamp) | Actividades previstas en NeoDomus | Estado |
|---|---|---|---|
| 1 | Pirámide, AAA, primer E2E, línea base de cobertura | Playwright a estudio del proyecto, E2E de login con AAA, cobertura FE (`@vitest/coverage-v8`) + re-medición BE, matriz de rotación, umbral línea base | ✅ COMPLETADA |
| 2 | Unitarias AAA + CI con umbral 30 % | pytest añadido, unitarias de reglas de negocio reales, umbral 30 % en CI | 🔵 EN CURSO |
| 3 | Componentes React | user-event, formularios críticos (Login/Registro/Checkout), estados no felices | ⚪ PENDIENTE |
| 4 | Pruebas de API | Contrato HTTP de routers sin cubrir (productos, reports, devoluciones, novedades, consultas, tarifas, solicitudes, users) + escenarios negativos | ⚪ PENDIENTE |
| 5 | Dobles de prueba | Inventario de dependencias externas; dobles para MinIO/SMTP/reloj/pagos; MSW en FE | ⚪ PENDIENTE |
| 6 | Integración BD real | Servicio MySQL de pruebas en compose, semillas, ciclo de limpieza documentado, pruebas de repositorios | ⚪ PENDIENTE |
| 7 | Playwright avanzado | 3 flujos críticos estables, Page Objects, HTML report, doble envío/red lenta, `--repeat-each` | ⚪ PENDIENTE |
| 8 | CI completo y calidad | Cobertura+umbral en CI, artefactos, job de calidad, 0 omitidas justificadas | ⚪ PENDIENTE |
| 9 | Integrador | ESTRATEGIA_DE_PRUEBAS.md, matrices de cobertura y trazabilidad, consolidación | ⚪ PENDIENTE |
| 10 | TDD | Historia de usuario nueva con ciclos RED→GREEN→REFACTOR documentados | ⚪ PENDIENTE |

## Registro por semana

### Semana 1 — Fundamentos y primer E2E
**Estado: COMPLETADA**

**Actividades realizadas**

1. Auditoría inicial completa (`docs/testing/AUDITORIA_INICIAL.md`): bootcamp
   leído semana por semana; proyecto inventariado; suites existentes ejecutadas.
2. Línea base de ejecución medida:
   - Backend: **291 pruebas OK** (15 skip condicionales de MinIO) · luego
     **0 omitidas** al levantar la infra de MinIO de pruebas.
   - Frontend: **30 archivos / 118 pruebas OK**.
3. Infraestructura de pruebas: MinIO dedicado levantado
   (`neodomus_minio_test`, buckets `neodomus-test-media`/`-private`,
   credenciales exclusivas por env de usuario, red `neodomus_tests_net`);
   contenedor `api` conectado a la red de pruebas (modo contenedor).
4. Cobertura de frontend configurada (`@vitest/coverage-v8` + sección
   `coverage` en `fe/vitest.config.ts`); línea base real medida: **27.55 %
   líneas / 68.94 % ramas / 38.51 % funciones** con la suite completa en verde.
   Umbrales fijados al piso real (trinquete).
5. Cobertura de backend re-medida con `coverage` (líneas+ramas) — resultado en
   `docs/testing/MATRIZ_DE_COBERTURA.md`.
6. Primer E2E nuevo con estructura AAA: `fe/e2e/login.e2e.spec.ts`
   (login válido 200 + login inválido 401 con mensaje real) y orquestador
   `scripts/e2e_login.py` (fixtures únicos, servidores efímeros, limpieza
   verificada). Ejecutado: **4/4 passed** con `--repeat-each=2`.
7. Playwright: reporte HTML añadido (`playwright-report`, `show-report`) y
   `retries` solo en CI (1) / local (0) para detectar flakiness real.

**Archivos creados**: `docs/testing/AUDITORIA_INICIAL.md`,
`docs/testing/PROGRESO_BOOTCAMP.md`, `docs/testing/CONFIGURACION_TESTING.md`,
`docs/testing/MATRIZ_ROTACION_BOOTCAMP.md`, `docs/testing/MATRIZ_DE_COBERTURA.md`,
`.github/pull_request_template.md`, `fe/e2e/login.e2e.spec.ts`,
`scripts/e2e_login.py`.
**Archivos modificados**: `fe/vitest.config.ts` (cobertura+umbrales),
`fe/package.json`/`fe/pnpm-lock.yaml` (dev dep `@vitest/coverage-v8`),
`fe/playwright.config.ts` (HTML reporter + retries CI),
`tests/run_e2e_tests.ps1`/`tests/run_one.ps1` (registro del flujo `login`),
`tests/INVENTARIO.md`, `be/app/routers/novedades.py` (ver hallazgo H-1),
`be/app/tests/test_bloque_2.py`, `test_bloque_11.py`, `test_factura_pdf_logo.py`
(ver hallazgo H-2), `scripts/e2e_session.py` (ver hallazgo H-2),
`fe/src/hooks/useAdminNotificaciones.test.tsx` y
`fe/src/pages/public/ProductoDetalle.integration.test.tsx` (márgenes de espera
bajo instrumentación, aserciones intactas).

**Hallazgos y correcciones (defectos reales detectados por las pruebas)**

- **H-1 (bloqueante del entorno host)**: `be/app/routers/novedades.py:1058`
  usaba `\n` dentro de la expresión de un f-string anidado — sintaxis válida
  solo en Python ≥3.12 (`SyntaxError` en 3.11). El backend no se podía
  importar con el Python del host (3.11) usado por los orquestadores E2E.
  Corregido calculando el salto de línea en una variable local (`vence`),
  semántica idéntica; `python -m compileall app` pasa en 3.11 y la suite sigue
  en verde en el contenedor (3.12).
- **H-2 (defecto latente de contrato en E2E y fixtures)**: el pin
  `email-validator==2.1.0` del proyecto **rechaza TLDs reservados**
  (`.test`, `.local`); los orquestadores/fixtures usaban
  `@example.test`/`@test.local`, con lo que:
  - `scripts/e2e_session.py` fallaba con 422 en el login (regresión del pin);
  - un fixture residual `b2.cliente.*@test.local` en la base de pruebas hizo
    que `GET /api/v1/clients` (serialización `ClientResponse.email` con
    `EmailStr`) respondiera **500**, rompiendo
    `test_t1_3_permisos.test_endpoints_admin_rechazan_cliente_y_tecnico`
    (detectado por la propia suite al instrumentarse con cobertura).
  Corrección: dominios de fixtures migrados a `@test.neodomus.com`
  (aceptado por el contrato y claramente de pruebas) en
  `scripts/e2e_session.py`, `scripts/e2e_login.py` (nuevo), `test_bloque_2.py`,
  `test_bloque_11.py`, `test_factura_pdf_logo.py`; fila residual eliminada de
  la base de pruebas. El 500 ante una fila con correo inválido queda
  registrado como hallazgo de robustez para la Semana 4 (contrato API).
- **H-3 (estabilidad bajo instrumentación)**: 3 pruebas de FE (doble clic en
  notificaciones, flujo ProductoDetalle→checkout) excedían sus timeouts solo
  cuando la suite corre con cobertura v8 (contención). Se ampliaron ventanas
  de espera (`waitFor` 5 s; `describe` 45 s; `testTimeout` global 15 s) sin
  tocar aserciones; suite completa con cobertura: **118/118 OK**.
- **H-4 (hallazgo de robustez, pendiente para S4)**: los listados admin
  serializan TODAS las filas con esquemas Pydantic estrictos
  (`ClientResponse.email: EmailStr`, `ProductoResponse.precio_venta_producto:
  float` no opcional). Una sola fila con valor fuera de contrato (correo
  reservado o `precio NULL`, p. ej. fixtures de `test_t2_pago_pendiente`
  creados sin precio) provoca **500 en TODO el listado**. Detectado al
  instrumentar la suite; la corrección de contrato se aborda en la Semana 4
  con pruebas de API y decisión de diseño documentada.

**Resultado de las pruebas al cerrar la semana**

| Suite | Comando | Resultado |
|---|---|---|
| Backend | `unittest discover` (contenedor, MySQL+MinIO de pruebas) | 291 OK · 0 fallidas · 0 omitidas |
| Backend cobertura | `coverage run --branch` (contenedor) | **56.08 % líneas / 31.20 % ramas** (Cover 50 %) |
| Frontend | `pnpm test` | 118/118 OK |
| Frontend cobertura | `pnpm test --coverage` | 118/118 OK · **27.55 % líneas** |
| E2E login (nuevo) | `python scripts/e2e_login.py` | 4/4 passed × 2 corridas consecutivas · fixtures 0 |

**Estado de aprobación: COMPLETADA.** Implementación completa, criterios de
aceptación cubiertos (Playwright configurado con reporte HTML, E2E real con AAA
verificado dos veces, pirámide documentada, cobertura configurada y línea base
registrada en ambas capas), sin regresiones atribuibles (suite heredada en
verde) y evidencia verificable en esta misma sesión.

### Semana 2 — Pruebas unitarias y CI inicial (EN CURSO)
- Infra pytest añadida al proyecto (`be/pyproject.toml`: pytest, pytest-cov,
  pytest-mock; runner compatible con los 291 TestCase unittest heredados).
- Unitarias backend nuevas (pytest, puros, sin BD): `test_unidades_seguridad.py`
  (17 casos: política de contraseñas, hash/verify incluida vía legacy inválida,
  tokens JWT tipo/expiración/alteración), `test_unidades_recomendacion.py`
  (15: horas por dificultad/normalización/cantidad/redondeo + pin de
  comportamiento de cantidad 0), `test_unidades_i18n_bd.py` (17: resolución de
  idioma con q-values, lista blanca de traducción, auditoría con correo
  ofuscado), `test_unidades_fechas.py` (3: contrato naive Bogotá UTC-5).
- Unitarias frontend nuevas: `src/i18n/traducciones.test.ts` (14),
  `src/utils/tabStorage.test.ts` (6), `src/utils/favoritos.test.tsx` (6).
- (El registro se completa al cerrar la semana con las mediciones reales.)
