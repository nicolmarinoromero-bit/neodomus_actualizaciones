# HU-012 — Modificación o cancelación de un servicio antes de su confirmación

<!--
  ¿Qué? El usuario puede cambiar o anular un servicio pendiente.
  ¿Para qué? Tener flexibilidad en caso de cambios de plan.
  ¿Impacto? Mejora la satisfacción y reduce cancelaciones de última hora.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-012                                               |
| **Título**       | Modificación o cancelación de un servicio antes de su confirmación |
| **Módulo**       | Servicios (Citas)                                    |
| **Prioridad**    | Alta                                                 |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-010                                               |

## Historia

**Como** usuario autenticado,  
**quiero** modificar o cancelar un servicio antes de que sea confirmado por el administrador,  
**para** tener flexibilidad en caso de cambios de plan y siempre que respete la regla de 48 horas de anticipación.

## Criterios de aceptación

### CA-012.1 — Acciones disponibles en estado pendiente
- **Dado que** tengo una cita en estado `pendiente`,
- **cuando** veo la tarjeta en `mis-servicios`,
- **entonces** debo ver los botones "Modificar" y "Cancelar".

### CA-012.2 — Modificación de fecha/hora/dirección
- **Dado que** hago clic en "Modificar",
- **cuando** se abre un formulario con los campos editables (fecha, hora, dirección, comentarios),
- **entonces** puedo cambiar los datos y guardar. La cita se actualiza y permanece en `pendiente`.

### CA-012.3 — Validaciones en modificación
- **Dado que** intento modificar a una fecha con menos de 24 horas de anticipación,
- **cuando** envío,
- **entonces** veo el error: "La fecha debe ser al menos 24 horas posterior a hoy".

### CA-012.4 — Cancelación con al menos 48 horas
- **Dado que** la fecha de la cita es al menos 48 horas posterior a la fecha actual,
- **cuando** hago clic en "Cancelar" y confirmo,
- **entonces** la cita cambia a estado `cancelada`, se notifica al técnico (si ya estaba asignado), y recibo un correo de cancelación.

### CA-012.5 — Cancelación sin anticipación suficiente
- **Dado que** faltan menos de 48 horas para la cita,
- **cuando** intento cancelar,
- **entonces** veo el error: "No se puede cancelar con menos de 48 horas de anticipación. Contacta con soporte".

### CA-012.6 — Cancelación imposible si ya fue confirmada
- **Dado que** la cita ya está `confirmada` o `en_progreso`,
- **cuando** intento cancelar,
- **entonces** no veo la opción; debo contactar al administrador.

### CA-012.7 — Confirmación de cambio
- **Dado que** modifico o cancelo exitosamente,
- **cuando** recibo la respuesta,
- **entonces** veo un mensaje de éxito y la lista se actualiza automáticamente.