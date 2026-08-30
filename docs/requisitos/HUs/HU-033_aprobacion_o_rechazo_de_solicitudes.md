# HU-033 — Aprobación o rechazo de solicitudes de servicios

<!--
  ¿Qué? El administrador revisa las solicitudes de servicio y decide si aprobarlas o no.
  ¿Para qué? Controlar la calidad y viabilidad de los servicios.
  ¿Impacto? Asegura que solo solicitudes válidas sean procesadas.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-033                                               |
| **Título**       | Aprobación o rechazo de solicitudes de servicios     |
| **Módulo**       | Administrador                                        |
| **Prioridad**    | Alta                                                 |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-033                                               |

## Historia

**Como** administrador,  
**quiero** aprobar o rechazar las solicitudes de servicios (citas en estado `pendiente`),  
**para** asegurar una correcta gestión del flujo de trabajo y garantizar que los técnicos estén disponibles.

## Criterios de aceptación

### CA-033.1 — Lista de solicitudes pendientes
- **Dado que** estoy en `/admin/solicitudes`,
- **cuando** veo la lista filtrada por estado `pendiente`,
- **entonces** cada fila muestra: cliente, servicio, fecha, hora, dirección y botones "Aprobar" y "Rechazar".

### CA-033.2 — Aprobación con asignación de técnico
- **Dado que** hago clic en "Aprobar",
- **cuando** se abre un modal para asignar técnico,
- **entonces** puedo elegir un técnico manualmente (lista filtrada por disponibilidad) o seleccionar "Asignar automáticamente".

### CA-033.3 — Rechazo con motivo
- **Dado que** hago clic en "Rechazar",
- **cuando** se abre un modal donde debo ingresar un motivo,
- **entonces** el sistema cambia la cita a `cancelada` y envía un correo al usuario explicando el motivo.

### CA-033.4 — Notificaciones
- **Dado que** apruebo la solicitud,
- **cuando** se asigna el técnico y la cita pasa a `confirmada`,
- **entonces** el usuario recibe un correo de confirmación, y el técnico recibe una notificación de nueva tarea.

### CA-033.5 — Sin técnico disponible
- **Dado que** intento aprobar una solicitud y no hay técnicos disponibles en esa fecha/hora,
- **cuando** el sistema lo detecta,
- **entonces** me muestra un error: "No hay técnicos disponibles en ese horario" y me permite rechazar o reprogramar.