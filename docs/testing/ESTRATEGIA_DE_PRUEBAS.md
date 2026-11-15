# Estrategia de pruebas de NeoDomus

> Documento de cierre del bootcamp de testing ADSO (Semana 9).
> Fecha: 2026-11-14. Complementa `docs/testing/CONFIGURACION_TESTING.md`
> (receta de ejecución) y `docs/testing/MATRIZ_DE_TRAZABILIDAD.md`
> (requisito → prueba). No sustituye a `tests/README.md`, guía central del
> equipo.

## 1. Objetivo y alcance

El objetivo es reducir el riesgo de regresión en los flujos que mueven dinero,
datos personales, agenda técnica e inventario, con evidencia ejecutable y
reproducible. La estrategia es **basada en riesgo**, no en cobertura por sí
misma: una línea cubierta sin una aserción de negocio no cuenta como calidad.

**Dentro del alcance**

- Backend FastAPI (`be/app`): servicios, routers, modelos, validaciones,
  permisos y transacciones sobre MySQL 8.
- Frontend React (`fe/src`): componentes, páginas, contextos, hooks y utilidades.
- Integraciones reales de pruebas: MySQL (`neodomus_test`) y MinIO dedicado
  (`neodomus_minio_test`).
- E2E web con Playwright/Chromium sobre los flujos críticos.
- CI de pruebas y de cobertura en GitHub Actions.

**Fuera del alcance de esta ejecución**

- E2E de la app móvil Expo (`movil/`): no hay runner móvil automatizado.
- Pruebas de carga, estrés, resiliencia de infraestructura y penetración.
- Pasarelas de pago reales, SMTP/Gmail reales y correos a destinatarios reales.
- Navegadores distintos de Chromium en E2E (no se ejecuta la matriz
  cross-browser).
- Mutación, fuzzing y contract testing contra terceros.

## 2. Principios

1. **Riesgo primero**: checkout, facturación, reembolsos, autenticación,
   permisos, agenda y evidencias tienen prioridad sobre pantallas cosméticas.
2. **Pirámide pragmática**: muchas unitarias rápidas, API/contrato sobre HTTP,
   integración real para transacciones y pocos E2E para recorridos completos.
3. **Aislamiento**: toda prueba corre contra `neodomus_test` y buckets `*test`;
   nunca contra `neodomus`, desarrollo o producción.
4. **Datos efímeros**: cada prueba crea sus fixtures con identificadores únicos
   y las elimina en orden FK-safe; los E2E verifican que no dejan residuos.
5. **Reproducibilidad**: comandos documentados, credenciales por variables de
   entorno, sin `.env` versionados y sin secretos en logs.
6. **Trinquete de cobertura**: el umbral nunca baja; se sube solo después de
   una medición real y se verifica con una segunda corrida completa.
7. **Defecto encontrado = regresión automatizada**: ningún arreglo se cierra
   sin una prueba que falle antes y pase después.
8. **Evidencia real**: no se documentan resultados estimados ni se manipulan
   métricas; los bloqueos y omisiones se registran con su causa.

## 3. Niveles de prueba

| Nivel | Objetivo | Herramientas | Datos | Ejemplos |
|---|---|---|---|---|
| Unitarias backend | Reglas puras: precios, fechas, seguridad, recomendación, transiciones | pytest + `unittest` heredado | Sin BD o dobles | `test_unidades_*.py`, `test_precio_service.py` |
| Contrato HTTP | Códigos, esquemas, permisos y validaciones de routers | pytest + `TestClient` | BD de pruebas | `test_api_contrato.py`, `test_api_productos_admin.py`, `test_api_novedades_reports.py` |
| Integración real | Transacciones, FKs, persistencia y MinIO | pytest + SQLAlchemy + MinIO | MySQL/MinIO de pruebas | `test_s6_*_integracion.py` |
| Componentes FE | Render, interacción, validaciones y estados | Vitest + Testing Library + `user-event` | Red simulada (MSW/`vi.mock`) | `fe/src/**/*.test.tsx` |
| E2E | Recorridos completos de usuario y verificación en BD | Playwright + orquestadores Python | Backend real + BD de pruebas | `fe/e2e/*.e2e.spec.ts`, `scripts/e2e_*.py` |
| CI | Ejecutar todo en cada cambio y publicar evidencia | GitHub Actions | Servicios efímeros dummy | `.github/workflows/tests.yml`, `coverage.yml` |

### 3.1 Backend

- **Unitarias**: funciones de servicio sin I/O; los dobles se restauran en cada
  caso para no contaminar la suite.
- **Contrato HTTP**: se ejercitan routers reales con `TestClient`; se cubren
  caminos felices, 401/403, 404, 409, 422 y 500 controlados.
- **Integración**: `be/app/tests/s6_base.py` crea usuarios, clientes, técnicos,
  pedidos y citas reales; la limpieza es FK-safe (hijos → padres). Es la capa
  que detecta defectos que los dobles ocultan (H-7…H-10).
- **MinIO**: se prueba contra el servidor dedicado; los fallos de subida se
  fuerzan con dobles cuando se necesita el camino de error.

### 3.2 Frontend

- Componentes y páginas con Testing Library; se prefieren aserciones de
  comportamiento y texto visible a detalles de implementación.
- `user-event` para interacción realista (teclado, foco, formularios).
- Red simulada con MSW 2.11.3 o `vi.mock`; no se depende de servicios externos.
- Los tests de componentes que muestran toasts localizados deben montar
  `IdiomaProvider`, aunque la pantalla no use `t()` directamente.
- Las suites completas se ejecutan con `--minWorkers=1 --maxWorkers=4
  --testTimeout=60000` para evitar falsos fallos por contención de CPU.

### 3.3 E2E

- Playwright con Page Objects en `fe/e2e/pages/`; sin `waitForTimeout`, solo
  auto-waiting y aserciones.
- Cada flujo tiene un orquestador `scripts/e2e_*.py` que levanta los servidores
  necesarios, ejecuta el spec y verifica el estado final en BD.
- `E2E_REPEAT_EACH` se usa para detectar flakiness; `cart-checkout` exige un
  único pedido por cliente y se valida con corridas independientes.
- Los flujos que no deben escribir datos usan `page.route` para interceptar la
  red (S5).

## 4. Enfoque basado en riesgo

| Riesgo | Impacto | Cobertura principal |
|---|---|---|
| Cobro incorrecto o pedido duplicado | Crítico | Checkout unitario/integración/E2E, idempotencia y validación de carrito |
| Factura o PDF incorrecto | Alto | Contrato de facturas, PDF con logo, facturas admin y descarga |
| Reembolso/devolución mal estado | Crítico | Integración S6 de devoluciones, reembolsos y auditoría PEN-09/10 |
| Acceso indebido por rol | Crítico | `test_t1_3_permisos.py`, `RoleRoute`, `ProtectedRoute`, E2E de sesión |
| Cita o asignación inconsistente | Alto | Integración de citas, reasignación transaccional y agenda admin |
| Evidencia perdida o pública | Alto | MinIO privado, permisos de descarga y pruebas de foto de técnico |
| Inventario/stock incorrecto | Alto | Disponibilidad de productos, checkout por metros y validaciones de cantidad |
| Regresión visual funcional | Medio | Componentes de catálogo, carrito, checkout y paneles |
| Datos de prueba en entorno equivocado | Crítico | Guardas de `testdb.py`, base `neodomus_test`, revisión de URLs |

## 5. Ambientes y datos

- **Backend en contenedor**: la suite se ejecuta dentro de `neodomus_api` con
  `TEST_DATABASE_URL=...@db:3306/neodomus_test` y
  `TEST_MINIO_ENDPOINT=neodomus-minio-test:9000`.
- **E2E en host**: MySQL publicado en `localhost:3307` y MinIO de pruebas en
  `localhost:9100`; la URL siempre apunta a `neodomus_test`.
- **MinIO**: buckets `neodomus-test-media` y `neodomus-test-private`;
  credenciales exclusivas de pruebas por variables de entorno.
- **Correos**: `@example.com` (reservado por IANA), aceptado por
  `email-validator==2.1.0`. Los TLD `.test`/`.local` son rechazados.
- **Migraciones**: la base de pruebas debe estar en la revisión Alembic
  vigente (`0064` en esta ejecución).
- **Concurrencia**: nunca se lanzan dos suites backend a la vez sobre
  `neodomus_test`; los locks y fixtures compartidas producirían falsos fallos.
- **Limpieza**: si una corrida se interrumpe, se limpian las filas con prefijos
  de la suite en orden de FKs antes de volver a medir.

## 6. Criterios de entrada y salida

### Entrada (antes de escribir pruebas)

- Requisito o defecto identificado y entendido.
- Entorno de pruebas disponible y migrado.
- Datos/fixtures definidos sin credenciales reales.
- Comportamiento esperado acordado (contrato o criterio de aceptación).

### Salida por cambio (definición de terminado)

- Prueba nueva o ajustada que falla sin el cambio y pasa con él.
- Suite afectada verde y sin pruebas omitidas no justificadas.
- Cobertura igual o superior al trinquete vigente.
- Si es flujo crítico, E2E o integración real que lo demuestre.
- Defecto corregido con prueba de regresión y registro en
  `docs/testing/PROGRESO_BOOTCAMP.md`.
- Documentación y matrices actualizadas.

### Salida del bootcamp (verificada al cerrar S8)

| Criterio | Resultado real |
|---|---|
| Backend completo | **582 passed, 0 skipped, EXIT 0** |
| Cobertura backend | **81.86 % combinado** (umbral 80) |
| Frontend completo | **84 archivos / 572 pruebas OK, EXIT 0** |
| Cobertura frontend | **80.94 % líneas / 78.82 % ramas / 66.26 % funciones** (umbral 80/78/65/80) |
| E2E críticos | Login 8/8 (×2), compra 2/2 en dos corridas, admin 18/18 (×2) |
| Defectos H-1…H-12 | Corregidos y con regresión o evidencia de suite |
| CI de cobertura | `coverage.yml` con artefactos y guardia de 0 omitidas |

## 7. Cobertura y trinquete

| Semana | Piso BE | Piso FE (líneas/ramas/funciones/statements) | Cobertura real al cerrar |
|---|---|---|---|
| S1 | línea base | 27/68/38 | BE 56.08 %; FE 27.55 % |
| S2 | 50 combinado | 30/72/42 | BE 56.09 %; FE 30.01 % |
| S3 | 50 combinado | 40/74/50 | BE 56.09 %; FE 40.92 % |
| S4 | 50 combinado | 52/74/54 | BE 59.91 %; FE 52.75 % |
| S5 | 60 combinado | 60/74/58/60 | BE 60.64 %; FE 64.84 % |
| S6 | 70 | 70/76/60/70 | BE 81.87 %; FE 70.31 % |
| S7 | 70 | 75/76/60/75 | BE 81.87 %; FE 78.23 % |
| S8 | 80 | 80/78/65/80 | BE 81.86 % combinado; FE 80.94 % |
| S9 | 80 | 80/78/65/80 | Sin cambios de código; se mantiene |
| S10 | 80 | 80/78/65/80 | Se mantiene o sube |

Reglas:

- La cobertura se mide sobre toda la lógica de la aplicación; las exclusiones
  están justificadas en `fe/vitest.config.ts` y `be/.coveragerc` (arranque,
  tipos, mapas de traducción, datos estáticos y la propia infraestructura de
  pruebas).
- El umbral se sube solo con una medición real; si una corrida con el umbral
  nuevo falla, se corrige la suite o se mantiene el umbral anterior, nunca se
  baja la métrica ni se excluye código para maquillarla.
- La cobertura de líneas no basta: se vigilan ramas y funciones, y los flujos
  críticos se validan además con integración y E2E.

## 8. Gestión de defectos

- **Registro**: identificador `H-n`, causa raíz, archivo afectado, corrección,
  prueba de regresión y estado.
- **Severidad**: bloqueante (impide arrancar/ejecutar), crítico (dinero,
  seguridad, pérdida de datos), mayor (flujo principal roto), menor (UI/texto).
- **Cierre**: solo con prueba automatizada que demuestre el comportamiento
  corregido y suite completa verde.
- Los 12 defectos H-1…H-12 están detallados en
  `docs/testing/MATRIZ_DE_TRAZABILIDAD.md`.

## 9. Evidencia y trazabilidad

- Cada semana se registra en `docs/testing/PROGRESO_BOOTCAMP.md` con comandos,
  resultados, duración, cobertura y evidencias.
- Los logs de esta sesión viven en
  `C:\Users\valet\AppData\Local\Temp\opencode\baseline\` (fuera del repo) y se
  referencian por nombre (`s8_be_cov2.txt`, `s8_fe_cov_run2.txt`, etc.).
- La matriz de trazabilidad relaciona requisito/HU, capa, archivo de prueba y
  estado; las brechas se declaran explícitamente.
- Los artefactos de CI (lcov, cobertura XML, HTML, JUnit) se publican con
  `actions/upload-artifact` en `coverage.yml`.

## 10. CI

- `tests.yml` (ajeno, intacto): suite frontend, backend y E2E en cada push/PR.
- `coverage.yml` (S8): dos jobs independientes.
  - `frontend-coverage`: Vitest con umbrales y artefactos de cobertura.
  - `backend-coverage`: MySQL/MinIO efímeros, Alembic, pytest con umbral 80,
    JUnit y guardia que falla si hay pruebas omitidas.
- El CI usa credenciales dummy y no imprime secretos.
- Limitación actual: la validación del workflow en esta máquina es estática
  (YAML) porque no hay push a GitHub; los comandos equivalentes se ejecutaron
  en local con EXIT 0.

## 11. Riesgos operativos y mitigaciones

| Riesgo | Mitigación aplicada |
|---|---|
| Contención de CPU en suites FE pesadas | `--minWorkers=1 --maxWorkers=4`, timeout 60 s |
| Docker Desktop se detiene | Reiniciar `neodomus_minio_test` y reconectar `api` a `neodomus_tests_net` |
| Endpoint MinIO incorrecto dentro del contenedor | Usar `neodomus-minio-test:9000`, no `localhost:9100` |
| Dos suites sobre `neodomus_test` | Ejecución secuencial y disciplina de lock |
| TLD rechazado por `email-validator` | Correos `@example.com` |
| Playwright no admite parameter properties | Page Objects con asignación explícita de `page` |
| Temporizadores de modales entre pruebas | Esperar el cierre/limpieza del `setTimeout` |
| Validación nativa de `input type="email"` | `fireEvent.submit` para probar la validación propia |
| E2E inestable | Page Objects, auto-waiting, repetición y datos únicos |
| Residuos en BD tras abortar | Limpieza FK-safe documentada antes de re-medir |

## 12. Mejoras pendientes (siguiente ciclo)

1. E2E móvil o pruebas de contrato de la app Expo.
2. Matriz cross-browser (Firefox/WebKit) para los flujos críticos.
3. Pruebas de carga y tiempos de respuesta en checkout y reportes.
4. Contract testing formal de esquemas OpenAPI.
5. Accesibilidad automatizada (axe) en páginas públicas y paneles.
6. Fábricas de datos reutilizables para reducir duplicación de fixtures.
7. Ejecución paralela de backend con esquemas de BD aislados por worker.
8. Mutation testing focalizado en servicios de dinero y permisos.

## 13. Roles y cadencia

En esta ejecución autónoma el mismo agente cumple análisis, implementación,
verificación y aprobación. La cadencia es semanal: análisis de brecha →
implementación → verificación real → corrección → aprobación → registro en
`PROGRESO_BOOTCAMP.md`. En un equipo humano, los roles se separan en QA,
desarrollo y revisión, manteniendo los mismos criterios de evidencia.

## 14. Referencias

- `docs/testing/CONFIGURACION_TESTING.md` — comandos, entornos y aislamiento.
- `docs/testing/MATRIZ_DE_COBERTURA.md` — mediciones semanales.
- `docs/testing/MATRIZ_DE_TRAZABILIDAD.md` — requisito → prueba y defectos.
- `docs/testing/PROGRESO_BOOTCAMP.md` — bitácora completa S1–S10.
- `docs/MATRIZ_TRAZABILIDAD_REQUISITOS.md` — RTM histórica de las 44 HU.
- `tests/README.md` — guía central de pruebas del proyecto.
- `docs/testing/AUDITORIA_INICIAL.md` — línea base y hallazgos de partida.