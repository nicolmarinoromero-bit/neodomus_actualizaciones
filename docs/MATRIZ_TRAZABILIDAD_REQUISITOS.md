# Matriz de trazabilidad de requisitos (RTM)

Relaciona las historias de usuario documentadas en [`docs/requisitos/HUs/`](requisitos/HUs/) con su implementación real (código backend/frontend/móvil) y con las pruebas automatizadas que la verifican.

- **Fecha de elaboración:** 12 de noviembre de 2026.
- **Fuente de requisitos:** historias de usuario HU-001 a HU-044 (y sus RF asociados) en [`docs/requisitos/`](requisitos/).
- **Fuente de pruebas:** módulos de `be/app/tests/` (unittest), `fe/src/**/*.test.tsx` (Vitest) y orquestadores de `tests/` / `scripts/`.
- **Verificación real de esta sesión (12/11/2026):** suite backend **291 pruebas OK, 15 skipped** (194,8 s; los skips corresponden a pruebas de MinIO sin buckets de prueba configurados, comportamiento documentado en `be/app/tests/testdb.py`); suite frontend **108 pruebas OK**. No se fabrican resultados: los estados «Aprobada» se apoyan en esa ejecución o en las evidencias de [`docs/qa/PEN-10/evidencias/`](qa/PEN-10/evidencias/INDEX.md).

Estados de implementación: **Implementado**, **Parcialmente implementado**, **Pendiente**, **No verificable**.
Estados de prueba: **Aprobada**, **Fallida**, **Pendiente**, **No existe prueba**, **No verificable**.

## Matriz

| ID | Historia de usuario / Requisito | Criterio de aceptación | Módulo o funcionalidad | Archivo o componente donde se implementa | Prueba asociada | Estado de implementación | Estado de prueba |
|---|---|---|---|---|---|---|---|
| HU-001 | Registro de cuenta | El cliente se registra y verifica su correo con código de 6 dígitos | Autenticación | `be/app/services/auth_service.py` (`register_client`, `verify_client_email`); `be/app/routers/auth.py`; `fe/src/auth/Register.tsx`; `movil/app/registro.tsx` | `test_auth.py`; `test_t1_1_cuentas.py` (registro + verificación + reenvío) | Implementado | Aprobada |
| HU-002 | Inicio de sesión | Login con correo/contraseña, tokens JWT y control de sesión | Autenticación | `be/app/services/auth_service.py` (`login`); `be/app/routers/auth.py`; `fe/src/auth/Login.tsx`; `movil/app/login.tsx` | `test_auth_session.py` (sesión, cookies, expiración); `test_t1_identidad.py` | Implementado | Aprobada |
| HU-003 | Cierre de sesión | El usuario cierra sesión y pierde el acceso | Autenticación | Cierre en el cliente (`fe/src` context de autenticación; `movil/app/login.tsx`) | Sin endpoint de revocación de tokens en el backend (JWT sin estado) | Parcialmente implementado | No existe prueba |
| HU-004 | Recuperación de contraseña | Solicitud de código, verificación y cambio de contraseña | Autenticación | `be/app/services/auth_service.py` (`request_password_reset`, `verify_password_reset_code`, `reset_password`); `fe/src/auth/ForgotPassword.tsx`, `ResetPassword.tsx`; `movil/app/recuperar-password.tsx` | `test_t1_1_cuentas.py` (flujo completo de recuperación y uso único del código) | Implementado | Aprobada |
| HU-005 | Edición de datos personales | Actualizar perfil, teléfono, dirección y foto | Clientes | `be/app/routers/clientes.py` (`PUT /me`, `POST /me/foto`); `fe/src/pages/cliente/Perfil.tsx` | `fe/src/pages/cliente/Perfil.test.tsx` (FE); sin prueba backend dedicada | Implementado | Aprobada (alcance: componente de perfil en frontend) |
| HU-006 | Eliminación de cuenta | El cliente solicita la eliminación y el administrador la decide | Clientes / Solicitudes | `be/app/routers/clientes.py` (`POST /me/cuenta-solicitud`); `be/app/routers/solicitudes.py`; `fe/src/pages/cliente/Perfil.tsx` | Sin prueba automatizada del ciclo de eliminación | Implementado | No existe prueba |
| HU-007 | Visualización de catálogo | Ver productos disponibles con detalles y variantes | Catálogo | `be/app/routers/productos.py`; `be/app/services/disponibilidad_service.py`; `fe/src/pages/public/ProductosPublicos.tsx`, `ProductoDetalle.tsx`; `movil/app/(tabs)/productos.tsx` | `test_disponibilidad_productos.py`; `fe/src/components/productos/ProductoCard.test.tsx` | Implementado | Aprobada |
| HU-008 | Consulta de detalles de servicio | Ver tarifa y duración del servicio técnico | Tarifas | `be/app/routers/tarifas.py`; `be/app/services/precio_service.py`; `fe/src/pages/cliente/TecnicosPage.tsx` | `test_precio_service.py` (cálculo de precios; sin E2E del flujo) | Implementado | Aprobada (alcance: cálculo de tarifa) |
| HU-009 | Solicitud de servicio | El cliente agenda una cita con los datos del servicio | Citas | `be/app/routers/citas.py` (`POST ""`, `/horas-disponibles`); `fe/src/pages/cliente/CitasPage.tsx`; `movil/app/(tabs)/citas-tab.tsx` | Ciclo administrativo en `test_citas_reembolsos_admin.py`; sin prueba HTTP dedicada de la solicitud por cliente | Implementado | Pendiente |
| HU-010 | Confirmación de servicio | Confirmar la realización del servicio agendado | Citas | Estados de cita en `be/app/routers/citas.py` y `be/app/services/asignacion_service.py` | Cobertura parcial (cancelación/reembolso admin) en `test_citas_reembolsos_admin.py` | Implementado | Pendiente |
| HU-011 | Visualización de estado de solicitudes | Consultar el estado de citas y pedidos | Citas / Pedidos | `citas.py` (`/mis-citas`); `pedidos.py` (`/seguimiento`); `movil/app/(tabs)/seguimiento.tsx` | Sin prueba dedicada del panel de seguimiento | Implementado | No existe prueba |
| HU-012 | Modificación o cancelación de servicio | Modificar o cancelar una cita | Citas | `be/app/routers/citas.py` (`PUT /{cita_id}`, `DELETE /{cita_id}`) | Cancelación y reembolso administrativos en `test_citas_reembolsos_admin.py` | Implementado | Pendiente |
| HU-013 | Realización de pagos | Checkout con pago aprobado, rechazado o pendiente y reintento | Pedidos / Pagos | `be/app/services/pedidos_service.py` (`crear_pedido`); `be/app/services/pagos_service.py`; `fe/src/pages/public/CheckoutPage.tsx` | `test_checkout_metros_http.py`; `test_t2_pago_pendiente.py`; `fe/src/pages/public/CheckoutPage.pse.test.tsx` | Implementado | Aprobada |
| HU-014 | Descarga de comprobantes | Descargar factura en PDF | Facturación | `be/app/services/factura_service.py`; `be/app/routers/pedidos.py` (`GET /{id}/factura`) | `test_factura_descarga_http.py`; `test_factura_pdf_logo.py` | Implementado | Aprobada |
| HU-015 | Calificación de servicio | El cliente califica el servicio del técnico | Calificaciones | `be/app/routers/calificaciones.py`; `movil/app/(tabs)/resenas.tsx` | Sin prueba automatizada del flujo de calificación | Implementado | No existe prueba |
| HU-016 | Notificación de cambios de estado | Recibir notificaciones en bandeja y correo | Notificaciones | `be/app/services/notificaciones.py`; `be/app/routers/notificaciones.py`; `fe/src/pages/public/Notificaciones.tsx` | `test_t1_1_archivos.py` (bandeja, marcado de leídas); `fe/src/pages/public/Notificaciones.test.tsx` | Implementado | Aprobada |
| HU-017 | Comunicación con técnico | Mensajear directamente con el técnico asignado | Comunicación | Mensajería dentro de novedades (`be/app/routers/novedades.py`) | No existe chat en tiempo real cliente–técnico | Parcialmente implementado | No existe prueba |
| HU-018 | Recordatorios de servicio | Recordatorios programados antes de la cita | Tareas programadas | `be/app/services/scheduler.py`; `tareas_programadas.py`; `notificaciones.py` (`notificar_recordatorio_cita`) | Sin prueba automatizada del scheduler | Implementado | No existe prueba |
| HU-019 | Acceso multidispositivo | Usar la plataforma desde web y móvil | Plataformas | `fe/` (web) y `movil/` (Expo) | Evidencias de `typecheck`/`lint` móvil en `docs/qa/PEN-08/evidencias/`; sin E2E móvil automatizado | Implementado | Pendiente |
| HU-020 | Visualización de servicios asignados (técnico) | El técnico ve sus citas y entregas asignadas | Técnico | `be/app/routers/tecnicos.py`; `be/app/services/asignacion_service.py`; `fe/src/pages/tecnico/TechnicianDashboard.tsx`, `TecnicoCitas.tsx`; `movil/app/(tecnico)/citas.tsx` | `test_reasignacion_transacciones.py` (flujo de asignaciones y reasignaciones) | Implementado | Aprobada |
| HU-021 | Consulta de detalles de tarea | Ver detalle y productos de la cita asignada | Técnico | `be/app/routers/citas.py` (`/{cita_id}/productos`); `fe/src/pages/tecnico/TecnicoCitas.tsx` | Sin prueba dedicada del detalle de tarea | Implementado | No existe prueba |
| HU-022 | Actualización de estado de servicio (técnico) | El técnico avanza estados con reglas de transición válidas | Entregas / Citas | `be/app/services/estados_entrega.py` (`validar_transicion_tecnico`); `be/app/routers/tecnicos.py` | `test_entregas_comportamiento.py` | Implementado | Aprobada |
| HU-023 | Subida de fotos y observaciones | Adjuntar evidencias al servicio | Técnico / Archivos | `be/app/routers/tecnicos.py` (evidencias); `be/app/services/minio_service.py` (bucket privado) | `test_t1_1_archivos.py` (descarga autorizada); `test_t1_2_minio.py` (skipped sin MinIO de pruebas); `test_foto_perfil_tecnico.py` | Implementado | Aprobada (pruebas MinIO omitidas en la ejecución por falta de buckets de prueba) |
| HU-024 | Visualización de calificaciones (técnico) | El técnico consulta sus calificaciones | Calificaciones | `be/app/routers/calificaciones.py`; `fe/src/pages/tecnico/TecnicoClientes.tsx` | Sin prueba dedicada | Implementado | No existe prueba |
| HU-025 | Descarga de reportes (técnico) | El técnico descarga reportes de su desempeño | Reportes | `be/app/routers/reports.py` (restringido a administrador) | No existe endpoint de reportes para técnico; `test_t1_3_permisos.py` confirma la restricción | Pendiente | No existe prueba |
| HU-026 | Registro de disponibilidad laboral | El técnico registra su disponibilidad | Disponibilidad | `be/app/services/disponibilidad_service.py`; `be/app/routers/tecnicos.py` | Sin prueba dedicada | Implementado | No existe prueba |
| HU-027 | Chat con usuario desde plataforma | El administrador responde al usuario | Novedades | `be/app/routers/novedades.py` (`/{id}/mensaje-cliente`, `/{id}/responder`) | Respuestas dentro del flujo de reclamos; sin chat general | Parcialmente implementado | No existe prueba |
| HU-028 | Registro de nuevos técnicos por admin | Crear cuenta de técnico | Usuarios | `be/app/routers/users.py` (`POST ""`); `be/app/services/notificaciones.py` (`notificar_bienvenida_tecnico`) | Sin prueba dedicada del alta de técnico | Implementado | No existe prueba |
| HU-029 | Edición de técnicos por admin | Editar datos del técnico | Usuarios | `be/app/routers/users.py` (`PUT /{user_id}`) | Sin prueba dedicada | Implementado | No existe prueba |
| HU-030 | Asignación manual de técnicos | Asignar/reasignar técnico a cita o entrega | Asignación | `be/app/services/asignacion_service.py` (`reasignar_cita_automatica`, `reasignar_entrega`); `be/app/routers/citas.py` (`/admin/{id}/reasignar`) | `test_reasignacion_transacciones.py`; `test_citas_reembolsos_admin.py` | Implementado | Aprobada |
| HU-031 | Eliminación de usuarios o técnicos | Desactivar/eliminar cuentas | Usuarios | `be/app/routers/users.py` (`DELETE /{user_id}`); `be/app/routers/clientes.py` (`PUT /{id}/inhabilitar`) | Sin prueba dedicada del ciclo completo | Implementado | No existe prueba |
| HU-032 | Reactivación de usuarios suspendidos | Aprobar solicitud de habilitación | Solicitudes de cuenta | `be/app/services/auth_service.py` (`solicitar_habilitacion`); `be/app/routers/solicitudes.py` (`/habilitar-cuenta`, `/empleados/{id}/aprobar`) | Sin prueba dedicada de reactivación | Implementado | No existe prueba |
| HU-033 | Aprobación o rechazo de solicitudes | El administrador aprueba/rechaza solicitudes | Solicitudes de cuenta | `be/app/routers/solicitudes.py` (`/{id}/aprobar`, `/{id}/rechazar`); `fe/src` panel de administración | Sin prueba dedicada del panel de solicitudes | Implementado | No existe prueba |
| HU-034 | Visualización de todos los servicios | El administrador consulta todas las citas/pedidos | Administración | `be/app/routers/citas.py` (`/all-admin`); `be/app/routers/pedidos.py` (`/all-admin`, `/admin/entregas`); `fe/src/pages/admin/AdminPedidos.tsx`, `AdminInstalaciones.tsx` | Cobertura parcial en `test_citas_reembolsos_admin.py` y `test_entregas_comportamiento.py` | Implementado | Pendiente |
| HU-035 | Monitoreo de pagos y transacciones | Consultar pagos y su estado | Pedidos / Pagos | `be/app/routers/pedidos.py` (`/admin/facturas`, `_serializar_pago`); `be/app/routers/reports.py` (`/resumen`) | `test_citas_reembolsos_admin.py` (comparación de `/reports/resumen`) | Implementado | Aprobada (alcance: resumen de ingresos) |
| HU-036 | Gestión de catálogo de servicios | CRUD de productos/servicios por el admin | Catálogo | `be/app/routers/productos.py` (administración); `be/app/routers/tarifas.py`; `fe/src/pages/admin/AdminProductos.tsx`, `AdminProductoDetalle.tsx` | `test_disponibilidad_productos.py` (visibilidad administrativa); `fe/src/pages/admin/AdminProductoDetalle.test.tsx` | Implementado | Aprobada (alcance: visibilidad y componentes admin) |
| HU-037 | Gestión de promociones | Crear y validar cupones/promociones | Novedades / Cupones | `be/app/routers/novedades.py` (`/{id}/cupon`, `/cupones/validar`, `/cliente/mis-cupones`); `be/app/services/novedades_service.py` (`validar_cupon`) | Sin prueba dedicada de cupones | Implementado | No existe prueba |
| HU-038 | Alertas de reclamos | Notificar al equipo los reclamos del cliente | Novedades | `be/app/services/novedades_service.py` (`crear_novedad`); `be/app/services/notificaciones.py` (`notificar_admin_*`) | Sin prueba dedicada | Implementado | No existe prueba |
| HU-039 | Copias de seguridad automáticas | Respaldos programados de datos | Operaciones | `scripts/respaldar.sh` (manual); `be/app/utils/respaldo_usuarios.py` (respaldo de usuarios en registro) | Sin respaldo automático completo programado | Parcialmente implementado | No existe prueba |
| HU-040 | Configuración de horarios generales | Definir horarios laborales generales del negocio | Configuración | No existe módulo de configuración; los horarios laborales están fijados en `be/app/services/especialidades.py` | — | Pendiente | No existe prueba |
| HU-041 | Gestión de roles y permisos | Asignar roles y restringir accesos | Seguridad | `be/app/models/roles_usuario.py`; dependencias de rol en routers; `be/app/middleware/`; `fe/src` guardas por rol | `test_t1_3_permisos.py`; `test_t1_identidad.py` | Implementado | Aprobada |
| HU-042 | Envío de comunicados masivos | Enviar comunicaciones a todos los usuarios | Notificaciones | No existe endpoint de envío masivo en `be/app/routers/notificaciones.py` | — | Pendiente | No existe prueba |
| HU-043 | Exportación de reportes de desempeño | Exportar reportes de ventas (JSON/PDF) | Reportes | `be/app/routers/reports.py` (`/ventas`, `/ventas/pdf`); `be/app/services/reportes_service.py`; `fe/src/pages/admin/AdminReportes.tsx` | `test_reportes_ventas.py` (JSON y PDF, permisos, validación de fechas) | Implementado | Aprobada |
| HU-044 | Historial de servicios anteriores | Consultar el historial de servicios del cliente | Pedidos / Citas | `be/app/routers/pedidos.py` (`/mis-pedidos`); `citas.py` (`/mis-citas`); `fe/src/components/profile/OrdersTab.tsx` | `fe/src/components/profile/OrdersTab.test.tsx` | Implementado | Aprobada |

## Resumen de la matriz

Los totales se calculan directamente sobre los 44 registros de la tabla anterior (cada HU cuenta exactamente una vez).

| Indicador | Valor |
|---|---|
| Total de requisitos identificados | 44 |
| Requisitos implementados | 37 |
| Requisitos parcialmente implementados | 4 (HU-003, HU-017, HU-027, HU-039) |
| Requisitos pendientes | 3 (HU-025, HU-040, HU-042) |
| No verificables | 0 |
| Pruebas aprobadas | 18 |
| Pruebas fallidas | 0 |
| Pruebas pendientes (cobertura parcial) | 5 (HU-009, HU-010, HU-012, HU-019, HU-034) |
| Requisitos sin prueba asociada | 21 |

### Qué falta por completar (síntesis)

1. **HU-025 / HU-040 / HU-042:** reportes de desempeño para técnico, configuración de horarios generales y comunicados masivos no tienen implementación propia (HU-025 parcialmente cubierta por reportes de administrador).
2. **HU-003 / HU-017 / HU-027 / HU-039:** cierre de sesión con revocación de tokens, chat directo cliente–técnico y respaldos automáticos completos quedan como alcance parcial o manual.
3. **Pruebas:** 21 requisitos carecen de prueba automatizada y 5 solo tienen cobertura parcial; se recomienda priorizar los flujos de dinero y agenda (HU-009, HU-010, HU-012, HU-034).

### Cómo comprobar la trazabilidad

1. **Qué se solicitó:** columna «Historia de usuario / Requisito» (documentos en `docs/requisitos/HUs/`).
2. **Dónde se desarrolló:** columna «Archivo o componente donde se implementa».
3. **Cómo se puede comprobar:** columna «Prueba asociada» (módulos ejecutables descritos en [`tests/README.md`](../tests/README.md)).
4. **Si está funcionando:** ejecutar la suite correspondiente; la última ejecución verificable es del 12/11/2026 (291 OK backend / 108 OK frontend) y las históricas están en [`docs/qa/PEN-10/evidencias/`](qa/PEN-10/evidencias/INDEX.md).
5. **Qué falta:** sección anterior y estados «Pendiente» / «No existe prueba».
