# Progreso del Bootcamp Testing ADSO — NeoDomus

> Plan de ejecución semana por semana (S1 → S10) con su estado, evidencia y
> resultados reales. Este archivo se actualiza al cerrar cada semana.
> Auditoría de partida: `docs/testing/AUDITORIA_INICIAL.md`.

## Plan de ejecución

| Sem | Tema (bootcamp) | Actividades previstas en NeoDomus | Estado |
|---|---|---|---|
| 1 | Pirámide, AAA, primer E2E, línea base de cobertura | Playwright a estudio del proyecto, E2E de login con AAA, cobertura FE (`@vitest/coverage-v8`) + re-medición BE, matriz de rotación, umbral línea base | ✅ COMPLETADA |
| 2 | Unitarias AAA + CI con umbral 30 % | pytest añadido, unitarias de reglas de negocio reales, umbral 30 % en CI | ✅ COMPLETADA |
| 3 | Componentes React | user-event, formularios críticos (Login/Registro/Checkout), estados no felices | ✅ COMPLETADA |
| 4 | Pruebas de API | Contrato HTTP de routers sin cubrir (productos, reports, devoluciones, novedades, consultas, tarifas, solicitudes, users) + escenarios negativos | ✅ COMPLETADA |
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

### Semana 2 — Pruebas unitarias y CI inicial
**Estado: COMPLETADA**

**Actividades realizadas**

1. Infra pytest añadida al proyecto (`be/pyproject.toml`: pytest, pytest-cov,
   pytest-mock; `[tool.pytest.ini_options]` con testpaths y addopts de
   cobertura; `uv.lock` regenerado). pytest ejecuta también los 291 TestCase
   unittest heredados sin reescribirlos.
2. Unitarias backend nuevas (pytest, puras, sin BD): `test_unidades_seguridad.py`
   (17), `test_unidades_recomendacion.py` (15), `test_unidades_i18n_bd.py` (17),
   `test_unidades_fechas.py` (3). Total **52 casos nuevos**.
3. Unitarias/componentes frontend nuevos (78 casos): `i18n/traducciones.test.ts`
   (14: construirT + traducirMensajeNotificacion + parser), `utils/tabStorage.test.ts`
   (6), `utils/favoritos.test.tsx` (6), `utils/productImages.test.ts` (9),
   `utils/tecnicosSync.test.ts` (3), `utils/metrosLimites.test.ts` (5),
   `constants.test.ts` (9: contrato STOCK_MINIMO/categorías espejo del backend),
   `components/common/ProtectedRoute.test.tsx` (5), `components/layout/RoleRoute.test.tsx`
   (7: normalización admin/roles), `contexts/AuthModalContext.test.tsx` (5),
   `components/common/ConfirmDialog.test.tsx` (5), `components/common/PasswordInput.test.tsx` (4).
4. Umbral de cobertura: FE fijado y VERIFICADO (30 % líneas / 72 ramas / 42
   funciones en `fe/vitest.config.ts`; una corrida parcial confirma que el
   umbral falla cuando no se alcanza). BE `--cov-fail-under=50` (combinado ≥
   piso semanal; trinquete por encima del piso de 30).
5. CI (`.github/workflows/tests.yml`, cambios staged selectivamente para no
   incluir ediciones ajenas concurrentes): job backend ahora corre `pytest`
   con cobertura + umbral y `-rs` (omitidos visibles); job frontend corre
   `-Coverage`; artefactos de log+cobertura se suben SIEMPRE (verificable
   aunque falle el umbral). Sin push (no autorizado): validado localmente.

**Resultados reales**

| Suite | Resultado |
|---|---|
| Backend (pytest, todo + cobertura + umbral) | **343 passed** · cobertura combinada **50.53 %** (umbral 50 ✓) · 187 s |
| Frontend (Vitest + cobertura + thresholds) | **42 archivos / 196 pruebas OK** · líneas **30.01 %** · ramas 72.77 % |
| Umbrales verificados en rojo | corrida de 1 archivo FE → `Coverage for lines (0.15%) does not meet global threshold (30%)` ✓ |

**Hallazgos y notas**
- `recomendacion_service.horas_estimadas_producto(cantidad=0)` trata 0 como 1
  unidad (`cantidad or 1`): comportamiento fijado con test y observación para
  el equipo (no es un defecto de contrato del API hoy).
- El fallback frase-a-frase de `translateLocalizedMessage` sustituye frases
  conocidas dentro de mensajes desconocidos (ej. "Mensaje inexistente" →
  "Message inexistente"): comportamiento real documentado con test.
- `formatMetros(1.005)` → "1" (comportamiento estándar de toFixed en binario):
  fijado con test.

**Estado de aprobación: COMPLETADA.** ≥3 unitarias por "integrante" (78 FE +
52 BE sobre reglas de negocio reales), CI con umbral 30 % en ambas capas
(BE efectivamente 50 por trinquete), suites en verde y sin regresiones.

### Semana 3 — Componentes React con React Testing Library
**Estado: COMPLETADA**

**Actividades realizadas**

1. `@testing-library/user-event@14.5.2` añadido (receta de la semana); los
   tests nuevos de interacción lo usan (type/click/selectOptions/keyboard).
2. Formularios críticos probados a nivel página (los que INVENTARIO marcaba
   sin cubrir):
   - `pages/auth/Login.test.tsx` (7): validación nativa del correo, 401 con
     mensaje real, 403 inhabilitada + solicitud de habilitación, "Recordarme"
     (guarda solo el correo), redirección por rol y cierre del modal.
   - `pages/auth/Register.test.tsx` (8): requisitos de contraseña en vivo,
     filtrado de documento/teléfono, dependencia ciudad→municipio,
     normalización del correo, payload completo y error del backend.
   - `pages/public/CheckoutPage.tarjeta.test.tsx` (7): validaciones campo a
     campo (datos/número/expiración/vencida/CVV/simulador), pago exitoso y
     regla de privacidad (número completo sin persistir).
   - `pages/cliente/CitasPage.test.tsx` (8): flujo de 3 pasos completo
     (técnico→fecha/hora→pago), aviso sin técnico, sin método de pago,
     payload de creación, cancelación con desglose de reembolso e historial
     con calificación.
   - `pages/cliente/AyudaPage.test.tsx` (12): FAQ acordeón, chat asistente,
     formulario de contacto con validaciones y toasts, "Mis solicitudes" con
     marcado de respuesta leída (PATCH) y estado vacío.
   - `pages/admin/AdminProductos.test.tsx` (10): tabla con badges de
     stock/estado/precio con descuento, búsqueda, filtro, paginación,
     visibilidad, ocultado (payload completo), estados vacío/error con
     reintentar y modal de reabastecimiento (2 tests, incluido el aviso sin
     cantidades).
   - `pages/admin/AdminConsultas.test.tsx` (9): aprobar/rechazar solicitudes
     de clientes y técnicos, habilitar cuentas (endpoints correctos),
     búsqueda de cuentas y gestión de consultas de ayuda con filtro.
   - Componentes/contextos reutilizables: `ConfirmDialog` (5),
     `PasswordInput` (4), `ProtectedRoute` (5), `RoleRoute` (7, normalización
     admin), `AuthModalContext` (5).
3. **Defecto real detectado y corregido (H-5)**: en `pages/auth/Register.tsx`
   el estado inicial `tipo_documento` era 2 (CE) mientras el select visible
   muestra CC (defaultValue="1"): quien no toca el select se registraba con
   CE viendo CC. Corregido a 1; el test lo fija.
4. Cobertura: **40.92 % líneas / 74.2 % ramas / 50 % funciones** (49 archivos
   / 257 pruebas, todas verdes). Umbral fijado en `fe/vitest.config.ts`
   (40/74/50). Backend mantiene su piso (50 combinado > piso semanal 40).

**Notas de aprendizaje registradas**: los `<form>` sin nombre accesible no
exponen role="form" (se localiza por clase del componente); los inputs
`type=email` bloquean el submit con validación nativa (jsdom imita a Chrome)
— el test afirma el comportamiento real del navegador.

**Estado de aprobación: COMPLETADA.** ≥3 tests con interacción + ≥1 estado no
feliz por cada área, sin repeticiones, sin probar detalles internos (todo se
localiza por rol/label/placeholder accesible salvo justificación escrita).

### Semana 4 — Pruebas de API (contrato HTTP)
**Estado: COMPLETADA**

**Actividades realizadas**

1. Backend — contrato HTTP de routers sin cubrir (43 casos nuevos):
   - `test_api_contrato.py` (18): solicitudes de cuenta (listar/aprobar/
     rechazar/habilitar-cuenta/empleados, 404, 400 de cuenta ya activa),
     tarifas (listado público + escritura admin + 400 costo<=0 + 404) y
     contacto/consultas (POST público, autenticado con correo de la cuenta,
     listado admin, resolución, estado inválido, "mías" aislado por cliente).
     Verificaciones transversales: Content-Type JSON en todas las respuestas,
     JSON mal formado → 4xx JSON sin HTML, y sin fugas de SQL/stack en cuerpos
     de error (`_sin_fugas`). El caso 18 es la regresión de H-4.
   - `test_api_productos_admin.py` (14): listado paginado con metadatos,
     creación (referencia única, dificultad inválida, nombre obligatorio),
     edición parcial (conserva campos no enviados), visibilidad (toggle
     idempotente), estado activo/inactivo, variantes (crear/listar/eliminar y
     404 de producto ajeno), detalle público, borrado (401/200/404 repetido)
     y precio NULL tolerado (H-4).
   - `test_api_novedades_reports.py` (11): catálogos públicos y listado admin
     de novedades, 400 por tipo/prioridad inválidos, 403 de técnico sobre cita
     ajena, detalle 404, cambio de estado, ciclo completo de cupón (crear →
     validar → duplicado 409 → agotado), cupones del cliente y contrato de
     reportes (permisos y estructura de resumen/ventas).
2. **Robustez H-4 corregida** (hallazgo de S1):
   - `GET /clients`: el listado admin ya no construye `ClientResponse` por
     fila; serializa el dict con los mismos campos. Una fila heredada con
     correo inválido ya no tumba TODO el listado con 500: se devuelve tal cual
     para que el admin pueda detectarla. La validación `EmailStr` se mantiene
     en escrituras y en `/clients/me`; el contrato del endpoint ya era
     `List[dict]`.
   - `GET /productos/{id}` y listados: `_serializar` usa el fallback ya
     calculado (`precio_venta_producto=precio_venta`), de modo que una columna
     nullable con NULL se expone como **0** en lugar de romper la respuesta.
     El contrato público (`float`) no cambia.
   - Ambos casos con prueba de regresión que escribe la fila corrupta
     directamente en BD (saltando la validación de la API).
3. Frontend — 6 paneles administrativos/técnico (59 pruebas nuevas, RTL +
   user-event, red simulada):
   - `AdminDevoluciones.test.tsx` (10): estados de solicitud, aprobar/rechazar
     con motivo, observaciones y reembolsos (crear/procesar).
   - `TechnicianDashboard.test.tsx` (7): carga de citas/entregas/recogidas,
     métricas, agrupación por fecha, detalle y cambio de estado.
   - `AdminTecnicos.test.tsx` (12): listado con disponibilidad, alta/edición
     (contraseña opcional), inhabilitación con motivo/fecha, habilitación e
     historial por pestañas.
   - `AdminNovedades.test.tsx` (11): filtros combinados, detalle, cambio de
     estado, cupón, respuesta al técnico, mensaje al cliente y reasignación.
   - `AdminPedidos.test.tsx` (8): listado, búsqueda, edición de fecha/horas
     con horarios del backend, cambio de técnico y errores.
   - `AdminClientes.test.tsx` (11): listado, búsqueda, historial de
     pedidos/servicios/devoluciones, factura PDF e inhabilitar/habilitar.
4. **Métricas reales (2026-11-13)**:
   - Backend: **386 passed**, 0 skipped · líneas **59.91 %** (6297/10511) ·
     ramas **36.25 %** (1126/3106) · Cover combinado **54.51 %** (piso 50 ✓).
     Evidencia: `be_pytest_s4_final.txt`; XML `be/coverage.xml`.
   - Frontend: **55 archivos / 316 pruebas, todas verdes** · líneas
     **52.75 %** · ramas **74.01 %** · funciones **54.61 %** ·
     statements 52.75 %. Umbrales en `fe/vitest.config.ts`: **52 / 74 / 54 /
     52**; `pnpm test --coverage` termina **EXIT OK**.
   - Trinquete verificado: las corridas intermedias con ramas 73.12 %, 73.70 %
     y 73.91 % fallaron con `ERROR: Coverage for branches ... does not meet
     global threshold (74%)`; solo al cubrir la rama faltante la suite pasó
     (evidencia `fe_s4_full2.txt` → `fe_s4_final.txt`).
5. Contratos reales fijados por las pruebas: cliente autenticado en rutas de
   empleados responde **401** (no 403, por diseño de `get_current_employee`);
   PUT de productos exige `nombre_producto`+`precio_venta_producto`
   (422 si faltan) aunque el handler conserve campos no enviados; el nombre
   del producto se normaliza con capitalización por palabra; novedad cambia de
   estado con `{"nuevo_estado": ...}`; cupón duplicado responde 400/409 según
   la capa que lo detecte.

**Notas de aprendizaje registradas**: los listados admin de solo lectura deben
ser tolerantes a datos heredados (un registro corrupto no puede degradar la
pantalla completa); la validación estricta se reserva para escrituras y
recursos propios. En FE, los filtros con `<select>` que repiten textos de la
tabla obligan a acotar las consultas con `within(tabla)`; los date inputs se
manipulan con `fireEvent.change` y las ausencias con `waitFor` por
`AnimatePresence`.

**Estado de aprobación: COMPLETADA.** 43 pruebas BE nuevas (contrato + H-4) y
59 FE nuevas (6 áreas), con estados felices, negativos y de permisos; suite
completa verde y umbrales aplicados (BE 50 combinado; FE 52/74/54/52).
