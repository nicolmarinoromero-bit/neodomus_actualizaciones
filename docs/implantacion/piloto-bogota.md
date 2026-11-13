# Propuesta de piloto operativo en Bogotá

## Naturaleza de la propuesta

Este documento propone organización y criterios para preparar una prueba operativa. No acredita que existan sede, equipo, proveedor, presupuesto, operación comercial o despliegue en Bogotá. El plan de implantación existente incluye la zona `America/Bogota`; eso solo acredita una referencia de zona horaria en el plan, no presencia física.

## Alcance a aprobar

**Propuesta de alcance controlado:** validar catálogo, registro/autenticación, pedido de prueba, pago simulado, factura/entrega, atención de novedades y permisos por rol en un entorno de ensayo con datos ficticios. Incluir móvil solo si el alcance y los dispositivos se confirman. No usar dinero real ni datos reales de pago mientras `PAYMENT_PROVIDER=simulator` sea el modo de prueba documentado.

Fecha, duración, cobertura geográfica más allá de Bogotá, volumen, usuarios participantes y productos/servicios incluidos: **PENDIENTE DE DEFINICIÓN**.

## Organización propuesta

Estos son puestos funcionales para el piloto; no son roles nuevos del sistema. Los únicos perfiles de empleado observados son administrador y técnico; clientes participan como usuarios del sistema.

| Función propuesta | Responsabilidades durante el piloto | Equivalencia técnica observada |
|---|---|---|
| Administrador del sistema | Preparar cuentas y configuración; revisar accesos, incidencias y operaciones administrativas. | Rol `administrador` implementado; asignación de persona PENDIENTE DE DEFINICIÓN. |
| Personal administrativo | Atender registros, pedidos, solicitudes y comunicaciones según procedimientos aprobados. | Puede requerir acceso de administrador; no existe rol administrativo separado comprobado. |
| Responsable comercial | Definir catálogo/oferta y validar el recorrido comercial y atención al cliente. | PENDIENTE DE DEFINICIÓN; no es rol del sistema identificado. |
| Responsable financiero | Revisar registros del simulador y diferencias internas; confirmar que el ensayo no se presente como recaudo. | PENDIENTE DE DEFINICIÓN; no hay rol financiero separado ni conciliación bancaria comprobados. |
| Personal operativo | Validar asignaciones, entregas, evidencias y novedades de la operación. | Técnico implementado; cobertura exacta según asignación. |
| Soporte técnico | Preparar ambiente, observar disponibilidad y clasificar defectos sin modificar datos productivos. | PENDIENTE DE DEFINICIÓN; no hay rol de soporte separado comprobado. |
| Usuarios participantes | Ejecutar guiones de cliente y reportar resultados de uso. | Identidad cliente implementada. Personas y consentimiento PENDIENTES DE DEFINICIÓN. |

## Requisitos previos

- PSI académico aclarado o marcado explícitamente fuera del criterio de lanzamiento.
- Alcance y ambiente (pruebas/piloto) aprobados por responsables designados.
- Confirmar configuración, respaldo/restauración y responsables con acceso mínimo necesario.
- Crear datos sintéticos; no usar credenciales, tarjetas ni documentos reales en pruebas.
- Verificar disponibilidad de API, web/móvil seleccionados, correo y almacenamiento requeridos.
- Confirmar que el método de pago sea simulador y etiquetar los resultados como simulados.
- Acordar política de tratamiento de datos, soporte, escalamiento y ventana de observación.

## Capacitación y recursos

Capacitación mínima propuesta: autenticación y uso por perfil; recorrido de pedido; lectura de estados; reporte de incidentes; privacidad de credenciales; distinción entre pago simulado y real. Materiales, instructor, duración, dispositivos, conectividad, personal disponible y presupuesto: **PENDIENTE DE DEFINICIÓN**.

## Validaciones de entrada y aceptación

El piloto puede iniciar cuando todos los criterios de entrada siguientes tengan evidencia y responsable designado. Los valores de metas y umbrales no están fijados; deben acordarse antes de la ejecución.

| ID | Criterio | Evidencia | Estado |
|---|---|---|---|
| BOG-01 | Ambiente identificado, respaldado y restaurable en ensayo. | Registro de ambiente y comprobación de restauración. | Pendiente |
| BOG-02 | Usuarios y datos de prueba listos con perfiles comprobados. | Matriz de cuentas ficticias y acceso autorizado/denegado. | Pendiente |
| BOG-03 | Flujos incluidos superan checklist de validación aplicable. | Checklist actualizado con resultados y evidencias. | Pendiente |
| BOG-04 | Pago está claramente marcado como simulado, sin recaudo real. | Configuración verificada y caso de prueba documentado. | Pendiente |
| BOG-05 | Equipo conoce responsabilidades, incidentes y canal de escalamiento. | Asistencia/material y contactos PENDIENTES DE DEFINICIÓN. | Pendiente |
| BOG-06 | Criterios de detener/continuar, metas y ventana de observación aprobados. | Decisión documentada por responsables designados. | Pendiente |

## Indicadores por acordar

Registrar, sin establecer metas numéricas inventadas: finalización del recorrido de prueba; fallos por etapa; pedidos con estado incoherente; diferencias entre pago simulado y pedido; defectos de autorización; incidencias por severidad y tiempo de resolución; disponibilidad del servicio en ventana acordada; tasa de tareas completadas por participantes; observaciones de usabilidad. Definición de cálculo, fuente, periodicidad, umbral y responsable: **PENDIENTE DE DEFINICIÓN**.

## Gestión de incidentes y decisión

Cada incidente debe registrar identificador, fecha/hora local `America/Bogota`, ambiente, perfil, pasos reproducibles, impacto, evidencia saneada, responsable asignado y resolución. No incluir secretos ni datos de pago.

**Detener temporalmente** ante exposición de datos, acceso no autorizado, corrupción o pérdida de datos, operación presentada como cobro real, o incapacidad de recuperar el ambiente. **Continuar** cuando el responsable designado confirme contención, integridad, evidencia y autorización para reanudar. **Cerrar exitosamente** cuando se cumplan los criterios aprobados, no queden incidentes bloqueantes y haya decisión documentada de responsables. Roles nominales, niveles de severidad y umbrales: **PENDIENTE DE DEFINICIÓN**.

## Decisiones que faltan

Responsables y participantes; entorno y alojamiento; duración; alcance geográfico/funcional; metas cuantitativas; conectividad/dispositivos; política de datos; criterios institucionales PSI; aprobación operativa; procedimiento financiero; soporte y canal de incidentes. Sin esas decisiones no se afirma que el piloto esté listo para lanzamiento.
