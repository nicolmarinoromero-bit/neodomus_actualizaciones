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
| 5 | Dobles de prueba | Inventario de dependencias externas; dobles para MinIO/SMTP/reloj/pagos; MSW en FE | ✅ COMPLETADA |
| 6 | Integración BD real | Servicio MySQL de pruebas en compose, semillas, ciclo de limpieza documentado, pruebas de repositorios | ✅ COMPLETADA |
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

### Semana 5 — Dobles de prueba
**Estado: COMPLETADA**

**Actividades realizadas**

1. **Inventario de dependencias externas y estrategia de dobles**
   (`docs/testing/CONFIGURACION_TESTING.md`): MinIO, SMTP, Gmail API, reloj,
   pasarela de pagos, scheduler y recomendación de técnicos. Backend: dobles
   explícitos y restauración de las implementaciones reales por prueba.
   Frontend: MSW 2.11.3 (`msw/node`) como doble de red + `vi.mock` para
   componentes con efectos externos.
2. **Backend — 8 archivos S5 (85 funciones, 131 casos al expandir
   parametrizaciones)**:
   - `test_s5_minio_dobles.py` (13): almacenamiento con el MinIO dedicado de
     pruebas, buckets público/privado, URLs públicas, borrado y errores.
   - `test_s5_email_dobles.py` (9) y `test_s5_gmail_api_dobles.py` (6):
     transporte SMTP y Gmail API sustituidos; se verifica el mensaje generado
     sin enviar correo real.
   - `test_s5_pagos_reloj.py` (11): pasarela simulada y reloj controlado;
     tarjeta aprobada/rechazada, vencimientos y estados de pago.
   - `test_s5_scheduler_tareas.py` (11): tareas programadas ejecutadas de
     forma determinista (recordatorios, limpiezas y cierres).
   - `test_s5_notificaciones_plantillas.py` (14): plantillas, idioma,
     marcadores y renderizado de mensajes.
   - `test_s5_recomendacion_tecnicos.py` (9): ranking por especialidad,
     disponibilidad y carga de trabajo.
   - `test_s5_calificaciones_especializaciones_http.py` (12): contrato HTTP de
     calificaciones y especializaciones (permisos, validaciones y 404).
   - `testdb.py` conserva las implementaciones originales de correo, adjuntos
     y scheduler (`_send_email_sync_original`, `_send_email_original`,
     `_adjunto_original`, `_iniciar_scheduler_original`,
     `_detener_scheduler_original`) y las restaura durante cada caso, de modo
     que los dobles no contaminan el resto de la suite.
3. **Defecto real corregido (H-6)**: en `pagos_service._pagar_tarjeta` el
   selector por defecto `"aprobado"` pisaba el rechazo documentado de las
   tarjetas terminadas en `...0001`. Ahora `por_defecto=estado`; la regresión
   queda fijada por `test_s5_pagos_reloj.py`.
4. **Frontend — 6 pantallas críticas (61 pruebas nuevas)**, todas con red
   simulada por MSW/`vi.mock`:
   - `TechnicianEntregas.test.tsx` (9): entregas asignadas, estados,
     evidencias y ubicación.
   - `ClienteNovedades.test.tsx` (9): listado, cupones, filtros, detalle y
     errores.
   - `TecnicoDevoluciones.test.tsx` (10): recogidas/cambios, evidencias,
     búsqueda, detalle y reintento.
   - `TecnicoCitas.test.tsx` (8): estadísticas, filtros, paginación y
     reagendamiento (éxito, error, domingo y cancelación).
   - `AdminInstalaciones.test.tsx` (12): citas, tarifas, filtros, estados,
     reasignación, comisiones, cancelación con reembolso y aplazamiento.
   - `TecnicoNovedades.test.tsx` (13): listado/filtros, detalle con historial,
     mensaje/solución al cliente y formulario por pasos con validaciones.
   - MSW se declara en `fe/package.json`/`pnpm-lock.yaml`; `pnpm-workspace.yaml`
     contiene `allowBuilds: {msw: true, esbuild: true}` porque pnpm 11 ignora
     `pnpm.onlyBuiltDependencies` y falla con `ERR_PNPM_IGNORED_BUILDS`.
5. **E2E nuevos con `page.route`** (sin fixtures ni escrituras en la BD):
   - `fe/e2e/semana5-tecnico.e2e.spec.ts` (2 recorridos): consulta, filtros,
     detalle y reporte de novedad con evidencia.
   - `fe/e2e/semana5-admin.e2e.spec.ts` (2 recorridos): filtros, cancelación
     con reembolso, edición de tarifa, cambio de estado y reasignación.
   - Orquestadores `scripts/e2e_tecnico_novedades.py`,
     `scripts/e2e_admin_instalaciones.py` y la base común
     `scripts/e2e_semana5_lib.py`; registrados en `tests/run_e2e_tests.ps1`.
     La sesión se restaura con tokens por pestaña y `/auth/session` +
     `/users/me` interceptados; ningún recorrido escribe en `neodomus`.

**Resultados reales (2026-11-13)**

| Suite | Resultado |
|---|---|
| Backend (pytest + cobertura + umbral 60) | **517 passed, 0 skipped** · líneas **60.64 %** · ramas 36.25 % · Cover **60.64 %** · 365 s |
| Frontend (Vitest + cobertura + thresholds) | **61 archivos / 379 pruebas OK** · líneas **64.84 %** · ramas **75.24 %** · funciones **58.73 %** · statements 64.84 % |
| E2E técnico (page.route) | **2/2 passed** (`scripts/e2e_tecnico_novedades.py`) |
| E2E admin (page.route) | **2/2 passed** (`scripts/e2e_admin_instalaciones.py`) |

- Umbrales FE en `fe/vitest.config.ts`: **60 / 74 / 58 / 60**
  (líneas/ramas/funciones/statements). La corrida completa con cobertura
  termina **EXIT OK**.
- Umbral BE en `be/pyproject.toml`: `--cov-fail-under=60`; la suite reporta
  `Required test coverage of 60% reached`.
- Evidencias: `be_pytest_s5_final.txt`, `fe_cov_s5_run1.txt`,
  `e2e_s5_tecnico_run3.txt`, `e2e_s5_admin_run5.txt` (carpeta de evidencias
  del entorno de ejecución).

**Notas de aprendizaje registradas**: los dobles deben restaurar la
implementación real dentro del propio caso (los parches globales de
`testdb.py` afectan a toda la suite); MSW exige `allowBuilds` en pnpm 11; en
FE los textos con acentos pueden llegar doble-codificados al DOM, por lo que
las aserciones usan prefijos ASCII o regex tolerantes; los componentes con
iconos junto al texto requieren `getAllByText` o acotar con `within`.

**Estado de aprobación: COMPLETADA.** Dependencias externas aisladas en ambas
capas, un defecto real de pagos corregido con regresión, 131 casos BE y 61 FE
nuevos, 4 recorridos E2E con red interceptada, suites completas verdes y
cobertura por encima del piso S5 (BE 60.64 %, FE 64.84 %), sin bajar el
trinquete.

### Semana 6 — Pruebas de integración con BD real
**Estado: COMPLETADA**

**Actividades realizadas**

1. **Infraestructura de integración aislada** (`docs/testing/CONFIGURACION_TESTING.md`):
   - MySQL 8 del compose (`neodomus_mysql`) con la base **`neodomus_test`**
     (nunca `neodomus`), en la revisión Alembic **`0064`**.
   - MinIO dedicado **`neodomus_minio_test`** (contenedor propio, puerto
     anfitrión `9100`, buckets `neodomus-test-media` y
     `neodomus-test-private`) unido a la red `neodomus_tests_net`, a la que
     también se conecta `neodomus_api` para que la suite resuelva
     `neodomus-minio-test:9000` sin tocar el MinIO de desarrollo.
   - Las credenciales se inyectan por variables de entorno en el comando de
     ejecución; no se versiona ningún `.env` ni secreto.
2. **Base común de integración** `be/app/tests/s6_base.py`:
   - Crea usuarios (cliente, técnico, admin), clientes, técnicos y pedidos
     reales con SQLAlchemy sobre `neodomus_test`; los endpoints se ejercitan
     por HTTP con `TestClient`.
   - Limpieza FK-safe en `tearDown` (hijos → padres) y limpieza adicional de
     `PasswordResetToken`; rate-limit desactivado por `BaseT1TestCase`.
   - Verificación explícita del **estado persistido** tras cada endpoint, no
     solo del código de respuesta.
3. **Backend — 6 archivos S6, 65 pruebas de integración**:
   - `test_s6_auth_cuentas_integracion.py` (8): login/sesión/refresh/logout,
     cuentas inactivas, rol inválido, cambio de contraseña cliente/empleado,
     forgot-password de un solo uso, cambio de correo, Google OAuth simulado y
     registro con verificación + solicitudes de habilitación.
   - `test_s6_citas_integracion.py` (20): creación con técnico explícito y
     pago aprobado, autoasignación, validación de pago/franja/tarifa, rechazo
     de técnico inexistente o inactivo (**409**), equipo con técnico repetido,
     horas disponibles, técnico ocupado, listado/estado admin, equipo y
     comisión, cancelación con reembolso e historial, reasignación y
     reagendamiento (`id_comision` obligatorio aunque no se use).
   - `test_s6_devoluciones_novedades_reembolsos_integracion.py` (8):
     devoluciones y cambios, evidencias, novedades con `cliente_visible`,
     mensajes admin, reembolsos y transiciones persistidas.
   - `test_s6_pedidos_instalacion_integracion.py` (9): creación de pedidos con
     detalles, orden de instalación asociada, entrega, factura y estados.
   - `test_s6_reportes_integracion.py` (10): resumen de ventas, pedidos por
     mes, productos más vendidos, citas por estado/mes, totales de clientes,
     técnicos y productos, solicitudes pendientes y PDF.
   - `test_s6_tecnicos_entregas_integracion.py` (10): perfil y
     especializaciones, foto, citas asignadas, entregas, evidencias y
     permisos por rol.
   - Franjas reales verificadas: **08:00, 11:00, 14:00, 17:00**;
     `mantenimiento` 1 h e `instalacion` 1.5 h.
4. **Defectos reales corregidos con regresión**:
   - **H-7** — `routers/pedidos.py` usaba `f.cita.id_cliente_c` (campo
     inexistente) y rompía el listado de pedidos con cita: ahora
     `f.cita.id_cliente`.
   - **H-8** — `services/pedidos_service.py`: la orden de instalación y sus
     detalles no quedaban visibles dentro de la transacción. Se añade
     `db.flush()` antes de `_crear_orden_instalacion` y un `flush()` interno de
     la cita cuando `commit=False`, de modo que el resumen devuelto incluya la
     cita recién creada.
   - **H-9** — `routers/novedades.py` usaba `evidencia.novedad.id_cliente_n`
     (inexistente): ahora `evidencia.novedad.id_cliente`.
   - **H-10** — `novedades.fecha_reporte_novedad` quedaba `NULL`;
     `crear_novedad` y `_crear_novedad_bd` asignan `datetime.now()`
     explícitamente.
   - Regla de negocio fijada: las novedades nacen con `cliente_visible=False`;
     el cliente solo ve detalle/evidencia tras un mensaje admin con
     `cliente_visible=True`.
5. **Frontend — 6 archivos S6, 52 pruebas nuevas**:
   - `AdminReportes.test.tsx` (7): KPIs, gráficos, estados vacíos, rango
     inválido/fechas requeridas, reintento y descarga PDF con botón
     deshabilitado.
   - `TecnicoHistorial.test.tsx` (8): citas/entregas, filtros por
     estado/fecha/hora/búsqueda, pestañas, estados vacíos y errores.
   - `TecnicoPerfil.test.tsx` (14): perfil y catálogo, guardado normalizado,
     errores del backend, validación de teléfono, foto (tamaño/formato),
     especializaciones y pestañas.
   - `ServiciosTab.test.tsx` (9): orden de servicios, detalle/rastreo,
     técnico por asignar, cancelación y calificación con estrellas.
   - `FacturasTab.test.tsx` (5): facturas, montos nulos, estado vacío,
     descarga y error de carga.
   - `PasswordTab.test.tsx` (9): requisitos en vivo, copiar/pegar bloqueado,
     coincidencia, visibilidad, envío, estado guardando y errores.
   - En `TecnicoPerfil.test.tsx` el mock de `useAuth` devuelve un objeto
     `user` estable (hoisted): si se recrea en cada render, el
     `useEffect([user])` entra en bucle infinito.
6. **Limpieza de residuos**: tras un intento fallido se eliminaron y
   verificaron en `neodomus_test` la novedad 109, el pedido 6436, los clientes
   8045/8046, los usuarios 7770/7771/7772, los técnicos 5708/5709 y 16
   notificaciones. La suite deja la base sin residuos.

**Resultados reales (2026-11-13)**

| Suite | Resultado |
|---|---|
| Backend (pytest + cobertura + umbral 70) | **582 passed, 0 skipped** · líneas **81.87 %** · ramas **80.30 %** · Cover **82 %** · 704 s (verificación final; 934 s en la primera corrida) |
| Pruebas S6 BE nuevas | **65/65 OK** en 6 archivos |
| Frontend (Vitest + cobertura + thresholds) | **67 archivos / 431 pruebas OK** · líneas **70.31 %** · ramas **76.50 %** · funciones **60.85 %** · statements 70.31 % |
| Pruebas S6 FE nuevas | **52/52 OK** en 6 archivos |

- Umbrales FE en `fe/vitest.config.ts`: **70 / 76 / 60 / 70**
  (líneas/ramas/funciones/statements); la corrida completa termina **EXIT 0**.
- Umbral BE en `be/pyproject.toml`: `--cov-fail-under=70` y `fail_under = 70`;
  la suite reporta `Required test coverage of 70% reached`.
- Evidencias: `s6_full_run1.txt` (582 passed, 81.87 %),
  `s6_full_run3.txt` (verificación final con umbral 70),
  `s6_fe_cov_run8.txt` (431/431, 70.31 %) y las corridas dirigidas
  `s6_fe_nuevas_run3.txt`, `s6_fe_facturas_run1.txt`,
  `s6_fe_password_run1.txt` (carpeta de evidencias del entorno de ejecución).
- Cobertura BE por módulo: `auth.py` 95 %, `auth_service.py` 88 %,
  `citas.py` 75 %, `tecnicos.py` 89 %, `devoluciones.py` 88 %,
  `novedades.py` 84 %, `reembolsos.py` 80 %, `reportes_service.py` 93 %,
  `pedidos_service.py` 69 %.

**Notas de aprendizaje registradas**: las pruebas de integración deben
verificar el estado persistido y limpiar en orden FK-safe; un `flush()` dentro
de la transacción evita que los resúmenes devuelvan IDs nulos sin cambiar el
contrato; los técnicos inactivos y las reglas de franja se validan mejor desde
HTTP; en FE, los mocks de contexto deben ser estables para no disparar efectos
en bucle; la suite completa FE necesita límites de workers por contención de
CPU, sin relajar la configuración comprometida.

**Estado de aprobación: COMPLETADA.** 65 pruebas BE y 52 FE nuevas contra
MySQL/MinIO reales de pruebas, 4 defectos reales corregidos con regresión
(H-7…H-10), suites completas verdes y cobertura por encima del piso S6
(BE 81.87 %, FE 70.31 %), con el trinquete subido a 70/70 y sin tocar la base
de desarrollo ni producción.

---

### Semana 7 — E2E avanzado, Page Objects y cierre de cobertura FE
**Estado: COMPLETADA**

**Actividades realizadas**

1. **Page Objects de Playwright** en `fe/e2e/pages/`:
   - `LoginPage.ts`, `CartCheckoutPage.ts`, `AdminPaginationPage.ts` y
     `AdminProductosPage.ts` encapsulan navegación, localizadores y acciones.
   - Los specs `login.e2e.spec.ts`, `cart-checkout.e2e.spec.ts` y
     `admin-paginacion.e2e.spec.ts` quedaron refactorizados para usarlos; los
     flujos conservan sus aserciones de negocio y verificación en BD.
   - Playwright usa transformación *strip-only*: los Page Objects asignan
     `page` de forma explícita (sin parameter properties de TypeScript).
2. **Eliminación de esperas fijas**: se retiraron los 4 `waitForTimeout` de
   `cart-checkout` y `register`; `fe/e2e/` no contiene ninguna espera fija.
   La sincronización se hace con `expect`/auto-waiting de Playwright.
3. **Repetición controlada de E2E** (`E2E_REPEAT_EACH`):
   - `scripts/e2e_login.py`, `e2e_cart_checkout.py` y `e2e_admin_paginacion.py`
     aceptan `E2E_REPEAT_EACH` para repetir cada prueba y detectar flakiness.
   - El verificador de `cart-checkout` exige **un único pedido por cliente**,
     por lo que ese flujo se ejecuta con repetición 1 y su estabilidad se
     demuestra con **dos ejecuciones independientes** (no con `repeat-each`).
4. **Correcciones con regresión**:
   - **H-11 (Login)** — dos envíos síncronos del formulario podían disparar dos
     peticiones. Se añade una guarda síncrona con `useRef` (`enviandoRef`) que
     bloquea el segundo submit antes del `setState`; regresión unitaria en
     `Login.test.tsx` (8/8).
   - **H-12 (NuevaNovedadModal)** — si fallaba la subida de evidencia, el aviso
     de error se sobrescribía con el de éxito. Ahora se conserva y muestra
     `Novedad creada pero error al subir evidencia` (tipo `err`) sin impedir el
     cierre; regresión en `NuevaNovedadModal.test.tsx` (11/11).
5. **Cierre de cobertura FE** — 10 archivos de prueba nuevos, 90 pruebas:
   - `CampoEmail.test.tsx` (8), `PaymentsTab.test.tsx` (10),
     `ResetPassword.test.tsx` (8), `VerifyCode.test.tsx` (9),
     `AdminPerfil.test.tsx` (8), `ClientDashboard.test.tsx` (8),
     `TecnicoMensajes.test.tsx` (7), `AdminCatalogo.test.tsx` (10),
     `AdminProveedores.test.tsx` (11) y `NuevaNovedadModal.test.tsx` (11).
   - Se cubren las 10 pantallas que estaban en 0 %: carga, error, estados
     vacíos, validaciones, filtros/paginación, persistencia local, roles y
     llamadas al backend.
6. **Verificación de tipos de E2E**: `tsc --noEmit` sobre `fe/e2e/pages/*.ts` y
   `fe/e2e/*.spec.ts` termina con **EXIT 0** tras dos ajustes solo de tipos
   (`HTMLInputElement.name` en `register` y `new Uint8Array(body)` en
   `reporte-ventas`), sin cambios de comportamiento.

**Resultados reales (2026-11-14)**

| Suite | Resultado |
|---|---|
| E2E login (4 pruebas × 2 repeticiones) | **8 passed** · 4.2 min · EXIT 0 · fixtures 0 |
| E2E compra (2 pruebas, dos corridas independientes) | **2/2 passed** en cada corrida (3.0 y 3.3 min) · pedidos 6954 y 6955 · EXIT 0 |
| E2E admin (9 pruebas × 2 repeticiones) | **18 passed** · 14.2 min · EXIT 0 · fixtures 0 |
| Frontend completo (Vitest + cobertura + thresholds) | **77 archivos / 522 pruebas OK** · líneas **78.23 %** · ramas **77.89 %** · funciones **64.79 %** · statements 78.23 % · EXIT 0 |
| Pruebas FE nuevas S7 | **90/90 OK** en 10 archivos |
| TypeScript de E2E | **EXIT 0** en Page Objects y specs |

- Umbrales FE en `fe/vitest.config.ts`: **75 / 76 / 60 / 75**
  (líneas/ramas/funciones/statements). La primera corrida completa con la
  cobertura nueva dio 78.23 % y la segunda, ya con el trinquete en 75, terminó
  **EXIT 0** (427 s y 429 s respectivamente).
- Umbral BE vigente sin cambios en S7: 70 % (`be/pyproject.toml`), última
  medición real 81.87 % líneas / 80.30 % ramas (582 passed de S6).
- Evidencias de la sesión: `s7_login_final.txt` (8 passed),
  `s7_cart_final1.txt` y `s7_cart_final2.txt` (2/2 cada una),
  `s7_admin_run3.txt` (18 passed), `s7_fe_cov_run1.txt` (medición 78.23 %) y
  `s7_fe_cov_run2.txt` (verificación con umbral 75, EXIT 0).

**Notas de aprendizaje registradas**: los Page Objects reducen duplicación pero
deben evitar parameter properties por el transformador de Playwright; la
repetición de flujos es útil solo cuando el verificador admite múltiples
registros (compra exige uno); los avisos de error deben prevalecer sobre el
mensaje de éxito cuando la operación principal sí se completó; los tests de
modales con `setTimeout` deben esperar el cierre para no filtrar temporizadores
entre pruebas; la suite FE completa requiere `--minWorkers=1 --maxWorkers=4`
para evitar falsos fallos por contención de CPU.

**Estado de aprobación: COMPLETADA.** Tres flujos E2E estables con Page
Objects y repetición (login 8/8, compra 2/2 × 2, admin 18/18), cero esperas
fijas, cobertura FE en 78.23 % (piso 75) y BE en 81.87 % (piso 70), H-11 y H-12
corregidos con regresión, tipos de E2E limpios y sin tocar la base de
desarrollo ni producción.

---

### Semana 8 — CI de cobertura, trinquete 80 % y cierre de la brecha FE
**Estado: COMPLETADA**

**Actividades realizadas**

1. **Cierre de la brecha de cobertura FE** (78.23 % → 80.94 %): se añadieron
   7 archivos de prueba con 50 pruebas nuevas, sin tocar código de producción:
   - `LegalPages.test.tsx` (3): política de privacidad, términos de uso y las
     variantes de `LegalPage` (secciones numeradas, listas y tarjetas).
   - `ForgotPassword.test.tsx` (10): validación del correo, normalización,
     estado de envío, timeout, 429, errores con y sin detalle, fallo de red y
     vuelta al login.
   - `CambioPasswordObligatorio.test.tsx` (8): requisitos, coincidencia,
     reutilización de la temporal, éxito por rol, error del backend y logout.
   - `ProductosPublicos.test.tsx` (8): carga, error, paginación, tamaño de
     página, filtros por búsqueda/categoría, limpieza y refresco por foco.
   - `AdminFacturas.test.tsx` (7): carga, error, vacío, tabla de pedidos y
     citas, búsqueda por cinco campos, descarga de PDF y fallo de descarga.
   - `TechniciansTab.test.tsx` (7): favoritos, foto/iniciales, certificación,
     calificación, enlaces `tel:`/WhatsApp y persistencia al quitar favoritos.
   - `MessagesTab.test.tsx` (7): listado, contador, filtro de no leídos,
     detalle, marcado individual y masivo, persistencia y estados vacíos.
2. **Trinquete FE a 80 %** en `fe/vitest.config.ts`: líneas 80, ramas 78,
   funciones 65, statements 80. La suite completa quedó en **84 archivos /
   572 pruebas**, con **80.94 % líneas / 78.82 % ramas / 66.26 % funciones**
   y **EXIT 0** en dos corridas (medición y verificación con el umbral nuevo).
3. **Trinquete BE a 80 %** en `be/pyproject.toml` (`addopts` y
   `[tool.coverage.report] fail_under`). La suite completa se ejecutó contra
   MySQL/MinIO de pruebas con **582 passed, 0 skipped, EXIT 0** y **81.86 %**
   de cobertura combinada (TOTAL de pytest-cov).
   - La primera corrida omitió 15 pruebas de MinIO porque el registro local
     apuntaba a `localhost:9100`, inalcanzable desde el contenedor `api`. Se
     repitió con `TEST_MINIO_ENDPOINT=neodomus-minio-test:9000` (alias de la
     red `neodomus_tests_net`) y se obtuvo 0 omitidas.
4. **Workflow de cobertura independiente** `.github/workflows/coverage.yml`:
   - Job `frontend-coverage`: Node 22 + pnpm 11.4.0, `pnpm install
     --frozen-lockfile`, Vitest con cobertura y umbral del config; publica
     `lcov.info`, `coverage-summary.json` e `index.html`.
   - Job `backend-coverage`: MySQL 8 efímero (base `neodomus_test`) + MinIO
     efímero con `server /data`, migraciones Alembic, pytest con cobertura
     (umbral 80), reporte JUnit y verificación explícita de **0 pruebas
     omitidas**; publica `coverage.xml`, `htmlcov`, JUnit y la salida de
     pytest.
   - Credenciales **dummy** exclusivas de CI; no se usan secretos de
     desarrollo. El YAML se validó con `yaml.safe_load` (2 jobs, 7 y 11 pasos).
   - `tests.yml` y `sonarcloud.yml` quedaron intactos (cambio ajeno).

**Resultados reales (2026-11-14)**

| Suite | Resultado |
|---|---|
| Frontend completo (Vitest + cobertura, medición) | **84 archivos / 572 pruebas OK** · 80.94 % líneas · 78.82 % ramas · 66.26 % funciones · EXIT 0 |
| Frontend completo (verificación con umbral 80/78/65/80) | **84 archivos / 572 pruebas OK** · EXIT 0 · 452.75 s |
| Backend completo (pytest + cobertura, umbral 80) | **582 passed · 0 skipped · EXIT 0** · 81.86 % combinado · 489.74 s |
| Pruebas FE nuevas S8 | **50/50 OK** en 7 archivos |
| Workflow `coverage.yml` | YAML válido · 2 jobs · artefactos FE/BE · guardia de 0 omitidas |

- Evidencias de la sesión: `s8_unit_batch1.txt` / `s8_unit_batch1b.txt`
  (29 pruebas de los primeros 4 archivos), `s8_unit_batch2.txt` y
  `s8_adminfacturas.txt` (21 pruebas restantes), `s8_fe_cov_run1.txt`
  (medición 80.94 %) y `s8_fe_cov_run2.txt` (umbral 80, EXIT 0),
  `s8_be_cov.txt` (corrida con 15 omitidas por endpoint incorrecto),
  `s8_be_cov2.txt` (582 passed, 0 skipped, EXIT 0).

**Notas de aprendizaje registradas**: el endpoint de MinIO que funciona en el
host (`localhost:9100`) no resuelve dentro del contenedor `api`; debe usarse
el alias de red `neodomus-minio-test:9000`. Los componentes que muestran
toasts localizados necesitan `IdiomaProvider` en la prueba, aunque la pantalla
no use `t()` directamente. En formularios con `input type="email"` la
validación nativa del navegador puede impedir el `submit`; para probar la
validación propia se envía el formulario con `fireEvent.submit`. Los umbrales
de cobertura deben subirse solo después de una medición real y verificarse con
una segunda corrida completa.

**Estado de aprobación: COMPLETADA.** Cobertura FE en 80.94 % (piso 80) y BE
en 81.86 % combinado (piso 80), 572 pruebas FE y 582 BE sin omitidas,
workflow de cobertura con artefactos y guardia de 0 skipped, y sin cambios en
la base de desarrollo ni en los workflows ajenos.
