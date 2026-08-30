# HU-011 — Visualización del estado de mis solicitudes

<!--
  ¿Qué? El usuario puede ver el estado actual de cada servicio que ha solicitado.
  ¿Para qué? Hacer seguimiento a mis servicios (pendiente, confirmado, en_progreso, etc.).
  ¿Impacto? Transparencia y reducción de consultas a soporte.
-->

## Identificación

| Campo            | Valor                                      |
| ---------------- | ------------------------------------------ |
| **ID**           | HU-011                                     |
| **Título**       | Visualización del estado de mis solicitudes |
| **Módulo**       | Servicios (Citas)                          |
| **Prioridad**    | Alta                                       |
| **Estado**       | Propuesta                                  |
| **RF asociados** | RF-009                                     |

## Historia

**Como** usuario autenticado,  
**quiero** visualizar el estado de mis solicitudes (pendiente, en proceso, finalizado o cancelado),  
**para** hacer seguimiento a mis servicios y saber en qué punto se encuentran.

## Criterios de aceptación

### CA-011.1 — Pantalla "Mis servicios"
- **Dado que** estoy autenticado,
- **cuando** accedo a `/mis-servicios`,
- **entonces** veo una lista de todas mis citas ordenadas por fecha (las más próximas primero).

### CA-011.2 — Información de cada servicio
- **Dado que** veo la lista,
- **cuando** reviso una cita,
- **entonces** veo: tipo de servicio, fecha, hora, dirección, técnico asignado (si lo hay), estado actual y un botón "Ver detalles".

### CA-011.3 — Estados posibles
- **Dado que** la cita tiene un estado,
- **cuando** lo visualizo,
- **entonces** puede ser:
  - `pendiente` (amarillo): esperando aprobación del administrador
  - `confirmada` (verde claro): aprobada y técnico asignado
  - `en_progreso` (azul): el técnico ya comenzó el trabajo
  - `completada` (verde oscuro): servicio finalizado
  - `cancelada` (rojo): cancelada por mí o por el administrador

### CA-011.4 — Filtros por estado
- **Dado que** hay muchos servicios,
- **cuando** selecciono un filtro de estado (ej. "pendiente"),
- **entonces** la lista se actualiza mostrando solo las citas con ese estado.

### CA-011.5 — Actualización automática
- **Dado que** el técnico o administrador cambia el estado de mi servicio,
- **cuando** estoy en la pantalla de `mis-servicios`,
- **entonces** la lista debe actualizarse automáticamente (sin que yo recargue la página).

### CA-011.6 — Acceso a detalle
- **Dado que** hago clic en "Ver detalles" de una cita,
- **cuando** se abre la página de detalle,
- **entonces** puedo ver toda la información, incluyendo el historial de cambios y la posibilidad de calificar (si está completada).