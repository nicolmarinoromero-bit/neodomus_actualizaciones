# HU-020 — Visualización de servicios asignados (técnico)

<!--
  ¿Qué? El técnico puede ver su lista de tareas.
  ¿Para qué? Conocer los servicios que debe realizar.
  ¿Impacto? Es la base de su trabajo diario.
-->

## Identificación

| Campo            | Valor                                          |
| ---------------- | ---------------------------------------------- |
| **ID**           | HU-020                                         |
| **Título**       | Visualización de servicios asignados (técnico) |
| **Módulo**       | Técnico                                        |
| **Prioridad**    | Alta                                           |
| **Estado**       | Propuesta                                      |
| **RF asociados** | RF-021                                         |

## Historia

**Como** técnico autenticado,  
**quiero** ver los servicios que me han sido asignados por el administrador,  
**para** conocer mis tareas programadas y organizarme.

## Criterios de aceptación

### CA-020.1 — Pantalla "Mis tareas"
- **Dado que** inicio sesión con rol `tecnico`,
- **cuando** accedo a `/tech/mis-tareas`,
- **entonces** veo una lista de todas las citas que me han asignado, ordenadas por fecha (las más próximas primero).

### CA-020.2 — Información de cada tarea
- **Dado que** veo la lista,
- **cuando** reviso una tarea,
- **entonces** veo: cliente, dirección, fecha, hora, tipo de servicio y estado actual (`pendiente`, `en_progreso`, `completada`).

### CA-020.3 — Filtro por estado
- **Dado que** quiero ver solo las tareas pendientes,
- **cuando** selecciono el filtro "Pendiente",
- **entonces** la lista se actualiza mostrando solo las tareas con ese estado.

### CA-020.4 — Acción al hacer clic
- **Dado que** hago clic en una tarea,
- **cuando** navego a `/tech/tarea/{id}`,
- **entonces** veo el detalle completo (cliente, teléfono, dirección, comentarios, y acciones para actualizar estado).

### CA-020.5 — Sin tareas asignadas
- **Dado que** no tengo ninguna tarea asignada,
- **cuando** accedo a `/tech/mis-tareas`,
- **entonces** veo un mensaje: "No tienes tareas asignadas por el momento" y un enlace para configurar mi disponibilidad.