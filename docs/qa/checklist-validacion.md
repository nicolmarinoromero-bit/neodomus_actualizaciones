# Checklist de validación del proyecto

Este checklist es una guía de verificación, no un resultado de ejecución. Los estados comienzan en **Pendiente**; no se infiere aprobación a partir de que exista una ruta, pantalla, requisito o prueba histórica. Registrar fecha, responsable y enlace a evidencia al ejecutar cada elemento.

Estados permitidos: `Pendiente`, `Aprobado`, `Rechazado`, `No aplica`.

| ID | Descripción | Condición de cumplimiento | Método de validación | Evidencia esperada | Estado |
|---|---|---|---|---|---|
| VAL-001 | Instalación con Docker | Servicios documentados arrancan y quedan saludables con configuración local válida. | Seguir `docs/setup/con-docker.md` en entorno limpio. | Salida de Compose, health checks y versión de entorno. | Pendiente |
| VAL-002 | Instalación sin Docker | Backend, web y móvil pueden instalar dependencias y arrancar según sus guías. | Seguir `docs/setup/sin-docker.md` por componente. | Comandos y salidas, versiones y errores observados. | Pendiente |
| VAL-003 | Configuración | Variables requeridas están documentadas y valores sensibles no se exponen en artefactos públicos. | Comparar ejemplos de entorno, configuración y arranque. | Lista de variables revisada y configuración saneada. | Pendiente |
| VAL-004 | Módulos funcionales | Cada flujo incluido en el alcance responde según su contrato documentado. | Pruebas funcionales por flujo y rol. | Solicitud/respuesta, pasos, entorno y resultado. | Pendiente |
| VAL-005 | Integridad de datos | Restricciones y transacciones mantienen relaciones y estados coherentes. | Casos de creación, actualización, fallo y repetición sobre BD de pruebas. | Consultas antes/después y resultado de pruebas. | Pendiente |
| VAL-006 | Formularios | Datos inválidos se rechazan y valores válidos se conservan según contrato. | Probar límites, faltantes, tipos y formatos en web y móvil. | Payloads/capturas y respuestas observadas. | Pendiente |
| VAL-007 | Autenticación | Credenciales, tokens, expiración y cuentas desactivadas se comportan según configuración actual. | Pruebas HTTP positivas y negativas con datos de prueba. | Respuestas sin secretos y registros de ejecución. | Pendiente |
| VAL-008 | Autorización y propiedad | Roles y propiedad se comprueban en servidor para lecturas y escrituras. | Matriz de acceso: anónimo, cliente dueño/ajeno, técnico y administrador. | Respuestas HTTP y comprobación de ausencia de cambios ante rechazo. | Pendiente |
| VAL-009 | Seguridad de información | Archivos y datos sensibles solo son accesibles según controles aprobados. | Revisar permisos API, almacenamiento MinIO, logs y configuración. | Evidencia de accesos permitidos/denegados y hallazgos. | Pendiente |
| VAL-010 | Flujo comercial | Catálogo, carrito, pedido, pago y entrega conservan estados coherentes. | Recorrido de checkout con simulador y datos ficticios. | Pedido, pago, factura/entrega cuando corresponda y resultado. | Pendiente |
| VAL-011 | Conciliación | Registros que requieren revisión se identifican sin inventar confirmación externa. | Revisar pagos pendientes, estados heredados y reintentos. | Lista de diferencias, identificadores y resolución trazable. | Pendiente |
| VAL-012 | Procesos administrativos | Acciones administrativas se limitan al rol observado y siguen flujos de negocio. | Ejecutar casos autorizados y denegados de administración. | Matriz de resultados por acción y rol. | Pendiente |
| VAL-013 | Auditoría | Eventos relevantes generan registros suficientes para reconstruir el evento. | Inspeccionar logs/modelos y realizar una operación controlada. | Evento, actor disponible, momento y resultado; vacíos identificados. | Pendiente |
| VAL-014 | Pruebas de integración | Componentes conectados cumplen contratos entre cliente, API y persistencia. | Ejecutar suites disponibles en ambiente de prueba limpio. | Comandos, versiones, recuentos y salida íntegra. | Pendiente |
| VAL-015 | Responsive | Pantallas web operativas se pueden usar en anchos objetivo acordados. | Inspección manual en tamaños móvil, tableta y escritorio. | Capturas por tamaño y defectos registrados. | Pendiente |
| VAL-016 | Manejo de errores | Errores esperados son controlados y no filtran secretos ni trazas internas al usuario. | Provocar errores de validación, autorización, dependencia y servidor. | Respuestas, logs saneados y comportamiento de UI. | Pendiente |
| VAL-017 | Recuperación y respaldos | El respaldo puede restaurarse en un entorno aislado y su alcance está definido. | Ejecutar procedimiento documentado de respaldo/restauración. | Artefacto de respaldo, bitácora y verificación posterior. | Pendiente |

## Registro de ejecución

| ID | Fecha y entorno | Responsable | Estado final | Evidencia / incidencia |
|---|---|---|---|---|
| PENDIENTE DE DEFINICIÓN | PENDIENTE DE DEFINICIÓN | PENDIENTE DE DEFINICIÓN | Pendiente | Completar al ejecutar el checklist. |

## Notas de alcance

- El simulador (`PAYMENT_PROVIDER=simulator`) no equivale a una transacción bancaria ni demuestra conciliación real.
- Para seguridad, identidad y pagos ya existen informes de pruebas previas en `docs/T1_identidad_permisos.md`, `docs/T2_consistencia_pago_pendiente.md` y `docs/qa/`; sus resultados corresponden al alcance y entorno de esas ejecuciones, no aprueban automáticamente esta lista ni el estado presente del repositorio.
- Una fila solo pasa a `Aprobado` cuando la verificación se ejecute y su evidencia quede registrada.
