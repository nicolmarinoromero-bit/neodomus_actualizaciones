# Matriz de trazabilidad del bootcamp — NeoDomus

> Semana 9 del bootcamp ADSO. Fecha: 2026-11-14.
> Relaciona requisitos/historias con las pruebas automatizadas que los
> verifican en la suite actual. Complementa la RTM histórica
> `docs/MATRIZ_TRAZABILIDAD_REQUISITOS.md` (elaborada el 2026-11-12 con la
> suite de entonces: 291 BE / 108 FE) y no la reemplaza.

## Fuentes y verificación

- **Requisitos**: historias HU-001…HU-044 y RF asociados en
  `docs/requisitos/`; la RTM histórica se usa como punto de partida.
- **Pruebas backend**: 47 archivos `be/app/tests/test_*.py` (pytest y
  `unittest` heredado).
- **Pruebas frontend**: 84 archivos de prueba en `fe/src` (69 `.test.tsx` y
  15 `.test.ts`) con Vitest + Testing Library.
- **E2E**: 11 specs `fe/e2e/*.e2e.spec.ts` y orquestadores
  `scripts/e2e_*.py`.
- **Última ejecución real (2026-11-14, cierre S8)**:
  - Backend: **582 passed, 0 skipped, EXIT 0**, cobertura combinada 81.86 %.
  - Frontend: **84 archivos / 572 pruebas OK, EXIT 0**, 80.94 % líneas.
  - E2E S7: login 8/8, compra 2/2 en dos corridas, admin 18/18.
- No se marcan como aprobadas pruebas que no se hayan ejecutado en esta
  sesión o cuya evidencia esté solo documentada por el equipo.

## Leyenda

| Símbolo | Significado |
|---|---|
| ✅ | Cubierto por pruebas ejecutables en la capa indicada |
| ◐ | Cobertura parcial: falta una capa, un camino o una validación E2E |
| ○ | Brecha: no existe prueba dedicada identificada |
| N/A | Funcionalidad no implementada; no aplica prueba de aceptación |

## 1. Requisitos y flujos

| ID | Requisito / flujo | Backend (unitarias, contrato, integración) | Frontend | E2E | Estado |
|---|---|---|---|---|---|
| HU-001 | Registro de cuenta y verificación por código | `test_t1_1_cuentas.py`, `test_auth.py`, `test_s6_auth_cuentas_integracion.py` | `Register.test.tsx` | `register.e2e.spec.ts` / `scripts/e2e_register.py` | ✅ |
| HU-002 | Login, sesión JWT y cookies | `test_auth_session.py`, `test_t1_identidad.py`, `test_s6_auth_cuentas_integracion.py` | `Login.test.tsx`, `AuthModalContext.test.tsx` | `login.e2e.spec.ts`, `session.e2e.spec.ts` | ✅ |
| HU-003 | Cierre de sesión | Sin revocación de JWT en backend (por diseño actual) | `AuthImagesSession.test.tsx`, `ProtectedRoute.test.tsx` | `session.e2e.spec.ts` | ◐ (no hay revocación de tokens) |
| HU-004 | Recuperación y cambio de contraseña | `test_t1_1_cuentas.py`, `test_s6_auth_cuentas_integracion.py` | `ForgotPassword.test.tsx`, `VerifyCode.test.tsx`, `ResetPassword.test.tsx`, `CambioPasswordObligatorio.test.tsx`, `PasswordTab.test.tsx` | Sin E2E dedicado | ✅ (sin E2E) |
| HU-005 | Perfil del cliente y foto | `test_s6_auth_cuentas_integracion.py`, `test_t1_1_archivos.py` | `Perfil.test.tsx`, `AvatarFoto.test.tsx`, `CampoEmail.test.tsx` | Sin E2E dedicado | ✅ (sin E2E) |
| HU-006 | Solicitud de eliminación de cuenta | Resolución admin en `test_api_contrato.py`; creación desde cliente sin prueba HTTP dedicada | `Perfil.test.tsx` solo verifica el estado inicial de la solicitud | Sin E2E | ◐ |
| HU-007 | Catálogo público, detalle y disponibilidad | `test_disponibilidad_productos.py`, `test_bloque_2.py` | `ProductosPublicos.test.tsx`, `ProductoCard.test.tsx`, `ProductoDetalle.integration.test.tsx` | `metros.e2e.spec.ts` (medidas), `cart-checkout.e2e.spec.ts` (compra) | ✅ |
| HU-008 | Tarifas y cálculo de precios | `test_precio_service.py` | `CitasPage.test.tsx` (selección de servicio) | Sin E2E dedicado | ✅ (sin E2E) |
| HU-009/010/012 | Solicitud, confirmación y modificación/cancelación de citas | `test_s6_citas_integracion.py`, `test_citas_reembolsos_admin.py` | `CitasPage.test.tsx`, `AdminInstalaciones.test.tsx`, `TecnicoCitas.test.tsx` | `admin-paginacion.e2e.spec.ts`, `semana5-admin.e2e.spec.ts` | ✅ |
| HU-011 | Seguimiento de pedidos y citas | `test_s6_pedidos_instalacion_integracion.py`, `test_s6_citas_integracion.py` | `OrdersTab.test.tsx`, `ServiciosTab.test.tsx` | `cart-checkout.e2e.spec.ts` verifica el pedido creado | ✅ (sin E2E de seguimiento dedicado) |
| HU-013 | Checkout, pagos aprobados/rechazados/pendientes | `test_checkout_metros_http.py`, `test_t2_pago_pendiente.py`, `test_s5_pagos_reloj.py` | `CarritoPage.test.tsx`, `CheckoutPage.pse.test.tsx`, `CheckoutPage.tarjeta.test.tsx`, `CardPaymentInput.test.tsx` | `cart-checkout.e2e.spec.ts` | ✅ |
| HU-014 | Factura y descarga de PDF | `test_factura_descarga_http.py`, `test_factura_pdf_logo.py` | `FacturasTab.test.tsx`, `AdminFacturas.test.tsx` | Sin E2E de factura (sí de reporte PDF) | ✅ (sin E2E de factura) |
| HU-015/024 | Calificación de servicios y consulta del técnico | `test_s5_calificaciones_especializaciones_http.py` | `ReviewsTab.test.tsx`, `TechnicianDashboard.test.tsx` | Sin E2E dedicado | ✅ (sin E2E) |
| HU-016 | Notificaciones en bandeja y correo | `test_t1_1_archivos.py`, `test_s5_notificaciones_plantillas.py` | `Notificaciones.test.tsx`, `NotificacionesBell.test.tsx`, `useNotificaciones.test.tsx`, `useAdminNotificaciones.test.tsx` | `session.e2e.spec.ts` (campana/sesión) | ✅ |
| HU-017/027 | Mensajería cliente–técnico y respuestas del admin | `test_s6_devoluciones_novedades_reembolsos_integracion.py`, `test_api_novedades_reports.py` | `TecnicoMensajes.test.tsx`, `MessagesTab.test.tsx`, `NuevaNovedadModal.test.tsx` | `semana5-tecnico.e2e.spec.ts` (novedades) | ◐ (no hay chat en tiempo real) |
| HU-018 | Recordatorios programados de citas | `test_s5_scheduler_tareas.py`, `test_s5_notificaciones_plantillas.py` | Sin componente propio | Sin E2E (depende del reloj) | ✅ (sin E2E) |
| HU-019 | Acceso multidispositivo web/móvil | Suite web completa; móvil sin pruebas automatizadas | Web cubierta; móvil fuera de alcance | Sin E2E móvil | ◐ |
| HU-020/022/023 | Citas, entregas, transiciones y evidencias del técnico | `test_entregas_comportamiento.py`, `test_s6_tecnicos_entregas_integracion.py`, `test_foto_perfil_tecnico.py`, `test_t1_2_minio.py` | `TechnicianDashboard.test.tsx`, `TechnicianEntregas.test.tsx`, `TecnicoCitas.test.tsx`, `TecnicoPerfil.test.tsx` | `foto-tecnico.e2e.spec.ts`, `semana5-tecnico.e2e.spec.ts` | ✅ |
| HU-021 | Detalle de tarea y productos de la cita | `test_s6_citas_integracion.py` | `TecnicoCitas.test.tsx` | `semana5-tecnico.e2e.spec.ts` | ✅ |
| HU-025 | Reportes de desempeño para técnico | No existe endpoint específico (solo admin) | — | — | N/A |
| HU-026 | Disponibilidad laboral del técnico | `test_s5_recomendacion_tecnicos.py`, `test_bloque_2.py` | `CitasPage.test.tsx` (selección de franjas) | `admin-paginacion.e2e.spec.ts` (agenda) | ◐ (sin prueba dedicada de autogestión) |
| HU-028/029 | Alta y edición de técnicos por admin | `test_t1_1_cuentas.py`, `test_s6_auth_cuentas_integracion.py` | `AdminTecnicos.test.tsx` | `admin-paginacion.e2e.spec.ts` | ✅ |
| HU-030 | Asignación y reasignación de técnicos | `test_reasignacion_transacciones.py`, `test_s6_citas_integracion.py` | `AdminInstalaciones.test.tsx` | `semana5-admin.e2e.spec.ts` | ✅ |
| HU-031/032/033 | Baja, reactivación y resolución de solicitudes de cuenta | `test_api_contrato.py` (`/admin/account-requests`) | `AdminClientes.test.tsx`, `AdminConsultas.test.tsx` | Sin E2E dedicado | ✅ (sin E2E) |
| HU-034 | Administración de todos los servicios | `test_citas_reembolsos_admin.py`, `test_entregas_comportamiento.py`, `test_s6_*_integracion.py` | `AdminPedidos.test.tsx`, `AdminInstalaciones.test.tsx` | `admin-paginacion.e2e.spec.ts`, `semana5-admin.e2e.spec.ts` | ✅ |
| HU-035 | Monitoreo de pagos y transacciones | `test_api_novedades_reports.py`, `test_reportes_ventas.py` | `AdminFacturas.test.tsx`, `AdminDashboard.test.tsx` | `reporte-ventas.e2e.spec.ts` | ✅ |
| HU-036 | Gestión de catálogo, productos y proveedores | `test_api_productos_admin.py`, `test_disponibilidad_productos.py` | `AdminProductos.test.tsx`, `AdminProductoDetalle.test.tsx`, `AdminCatalogo.test.tsx`, `AdminProveedores.test.tsx` | `admin-paginacion.e2e.spec.ts` | ✅ |
| HU-037 | Promociones y cupones | `test_api_novedades_reports.py` (crear/validar/duplicado/agotado), `test_s6_devoluciones_novedades_reembolsos_integracion.py` | `AdminNovedades.test.tsx`, `ClienteNovedades.test.tsx` | Sin E2E dedicado | ✅ (sin E2E) |
| HU-038 | Alertas de reclamos al equipo | `test_api_novedades_reports.py`, `test_s5_notificaciones_plantillas.py`, `test_s6_devoluciones_novedades_reembolsos_integracion.py` | `AdminNovedades.test.tsx`, `TecnicoNovedades.test.tsx`, `ClienteNovedades.test.tsx` | `semana5-tecnico.e2e.spec.ts` | ✅ |
| HU-039 | Copias de seguridad automáticas | Solo respaldo manual (`scripts/respaldar.sh`) y respaldo de usuarios en registro; sin prueba del ciclo completo | — | — | ○ |
| HU-040 | Configuración de horarios generales | No existe módulo de configuración; horarios fijados en código | — | — | N/A |
| HU-041 | Roles y permisos | `test_t1_3_permisos.py`, `test_t1_identidad.py`, `test_auth_session.py` | `ProtectedRoute.test.tsx`, `RoleRoute.test.tsx` | `session.e2e.spec.ts` | ✅ |
| HU-042 | Comunicados masivos | No existe endpoint de envío masivo | — | — | N/A |
| HU-043 | Reportes de ventas JSON/PDF | `test_reportes_ventas.py`, `test_s6_reportes_integracion.py` | `AdminReportes.test.tsx`, `AdminDashboard.test.tsx` | `reporte-ventas.e2e.spec.ts` | ✅ |
| HU-044 | Historial de pedidos y servicios | `test_s6_pedidos_instalacion_integracion.py`, `test_s6_citas_integracion.py` | `OrdersTab.test.tsx`, `ServiciosTab.test.tsx`, `TecnicoHistorial.test.tsx` | `cart-checkout.e2e.spec.ts` | ✅ |

### Resumen

| Indicador | Valor |
|---|---|
| Requisitos analizados | 44 (agrupados en la tabla por flujos afines) |
| Filas de la matriz | 35 |
| Cubiertos (✅) | 26 |
| Parciales (◐) | 5 |
| Brechas (○) | 1 |
| No aplica (N/A) | 3 |

Las brechas y coberturas parciales se detallan en la sección 3.

## 2. Defectos corregidos y su regresión

| ID | Severidad | Causa raíz | Corrección | Prueba de regresión | Estado |
|---|---|---|---|---|---|
| H-1 | Bloqueante | `routers/novedades.py` usaba `\n` en un f-string anidado (solo válido en Python 3.12) | Expresión compatible con la versión del proyecto | Importación de la suite + `test_api_novedades_reports.py` | Cerrado |
| H-2 | Mayor | `email-validator==2.1.0` rechaza TLD reservados usados por fixtures (`.test`) | Fixtures y orquestadores migrados a `@example.com` | Suite completa BE/E2E | Cerrado |
| H-3 | Mayor | Timeouts de 3 pruebas FE bajo instrumentación de cobertura v8 | Ventanas de espera y workers ajustados en Vitest | Dos corridas completas de cobertura FE | Cerrado |
| H-4 | Crítico | Listados admin devolvían 500 si una fila traía `email` inválido o `precio` NULL | Serialización tolerante (`_sin_fugas`) y contrato robusto | Caso de precio NULL en `test_api_productos_admin.py`; listados en `test_api_contrato.py` | Cerrado |
| H-5 | Mayor | `Register.tsx` iniciaba `tipo_documento=2` (CE) mientras el select mostraba CC | Valor inicial corregido a 1 | `Register.test.tsx` | Cerrado |
| H-6 | Crítico | `pagos_service._pagar_tarjeta` aplicaba `"aprobado"` por defecto y pisaba el rechazo de tarjetas `...0001` | `por_defecto=estado` | `test_s5_pagos_reloj.py` | Cerrado |
| H-7 | Crítico | `routers/pedidos.py` usaba `f.cita.id_cliente_c` (campo inexistente) | `f.cita.id_cliente` | `test_s6_pedidos_instalacion_integracion.py` | Cerrado |
| H-8 | Crítico | La orden de instalación y sus detalles no eran visibles dentro de la transacción | `flush()` antes e interno de la cita | `test_s6_pedidos_instalacion_integracion.py` | Cerrado |
| H-9 | Alto | `routers/novedades.py` usaba `evidencia.novedad.id_cliente_n` | `evidencia.novedad.id_cliente` | `test_s6_devoluciones_novedades_reembolsos_integracion.py` | Cerrado |
| H-10 | Alto | `novedades.fecha_reporte_novedad` quedaba NULL | `datetime.now()` explícito en `crear_novedad` y `_crear_novedad_bd` | `test_s6_devoluciones_novedades_reembolsos_integracion.py` | Cerrado |
| H-11 | Alto | Login permitía dos envíos síncronos y duplicaba la petición | Guarda síncrona con `useRef` (`enviandoRef`) | `Login.test.tsx` | Cerrado |
| H-12 | Medio | El error de subida de evidencia se sobrescribía con el mensaje de éxito | Se conserva el aviso de error y se evita el doble toast | `NuevaNovedadModal.test.tsx` | Cerrado |

## 3. Brechas y cobertura parcial declaradas

| Área | Estado | Evidencia actual | Riesgo | Próximo paso sugerido |
|---|---|---|---|---|
| HU-006: solicitud de eliminación desde el cliente | ◐ | `Perfil.test.tsx` simula `/clients/me/cuenta-solicitud`; la resolución admin sí está en `test_api_contrato.py` | Medio: el cliente podría no poder solicitar la baja | Prueba HTTP de `POST /clients/me/cuenta-solicitud` + E2E de solicitud |
| HU-003: cierre de sesión | ◐ | Cierre en cliente probado; JWT sin revocación | Medio: un token robado sigue válido hasta expirar | Prueba de expiración/revocación si se implementa |
| HU-017/027: mensajería | ◐ | Mensajes dentro de novedades cubiertos; no hay chat en tiempo real | Bajo/medio: expectativa de chat no satisfecha | Probar el flujo de mensajes con `cliente_visible` en E2E |
| HU-019: móvil | ◐ | Web completa; móvil sin runner | Medio: regresiones solo en Expo | Añadir pruebas de componentes/contrato para `movil/` |
| HU-026: autogestión de disponibilidad | ◐ | Disponibilidad usada en agenda/recomendación, sin prueba de UI de autogestión | Bajo | Prueba de la pantalla de disponibilidad del técnico |
| HU-039: respaldos | ○ | Solo script manual y respaldo de usuarios | Alto si se promete recuperación | Probar restauración en entorno aislado |
| HU-025/040/042 | N/A | Funcionalidad no implementada | — | No aplica hasta que exista requisito implementado |
| E2E de factura individual | ◐ | API/PDF y componentes cubiertos; el E2E existente descarga el reporte de ventas | Bajo | Añadir descarga de factura al E2E admin |
| Cross-browser, carga, accesibilidad, mutación | ○ | Fuera del alcance de esta ejecución | Medio en producción | Planificar en el siguiente ciclo |

## 4. Cómo verificar esta matriz

1. **Backend**: ejecutar la suite completa con el comando de
   `CONFIGURACION_TESTING.md`; debe terminar `582 passed, 0 skipped` y
   cobertura ≥ 80.
2. **Frontend**: `pnpm exec vitest run --coverage --minWorkers=1
   --maxWorkers=4 --testTimeout=60000`; debe terminar 572/572 y EXIT 0 con los
   umbrales 80/78/65/80.
3. **E2E**: ejecutar `scripts/e2e_login.py`, `scripts/e2e_cart_checkout.py` y
   `scripts/e2e_admin_paginacion.py`; revisar los verificadores de BD y la
   limpieza de fixtures.
4. **Trazabilidad**: cada fila remite a un archivo ejecutable; si un archivo
   se renombra, esta matriz y la RTM deben actualizarse en el mismo cambio.
5. **Evidencia**: los resultados de la sesión están en
   `C:\Users\valet\AppData\Local\Temp\opencode\baseline\` y en
   `docs/testing/PROGRESO_BOOTCAMP.md`.