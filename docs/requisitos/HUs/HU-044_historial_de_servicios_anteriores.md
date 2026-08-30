# HU-044 — Historial de servicios anteriores (usuario)

<!--
  ¿Qué? El usuario puede ver servicios que ya realizó en el pasado.
  ¿Para qué? Consultar técnicos que lo atendieron y repetir servicios fácilmente.
  ¿Impacto? Fidelización y facilidad para contratar nuevamente.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-044                                               |
| **Título**       | Historial de servicios anteriores                    |
| **Módulo**       | Servicios (Citas)                                    |
| **Prioridad**    | Media                                                |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-016                                               |

## Historia

**Como** usuario autenticado,  
**quiero** consultar mi historial de servicios anteriores (los que ya fueron completados o cancelados),  
**para** ver qué técnicos me han atendido y qué servicios he contratado, y poder repetirlos fácilmente.

## Criterios de aceptación

### CA-044.1 — Acceso al historial
- **Dado que** estoy autenticado,
- **cuando** accedo a `/historial-servicios`,
- **entonces** veo una lista de mis citas en estado `completada` o `cancelada`, ordenadas de más reciente a más antigua.

### CA-044.2 — Información mostrada
- **Dado que** veo un elemento del historial,
- **cuando** lo reviso,
- **entonces** veo: servicio, fecha, hora, técnico asignado (si lo hubo), monto pagado, calificación que dejé (si la hay), y un botón "Contratar de nuevo".

### CA-044.3 — Contratar de nuevo
- **Dado que** hago clic en "Contratar de nuevo",
- **cuando** soy redirigido al formulario de solicitud,
- **entonces** se precargan el servicio y mi dirección actual, y solo debo seleccionar nueva fecha/hora.

### CA-044.4 — Búsqueda y filtros
- **Dado que** tengo muchos servicios en el historial,
- **cuando** puedo filtrar por rango de fechas o por tipo de servicio,
- **entonces** la lista se actualiza según los filtros.

### CA-044.5 — Ver detalle
- **Dado que** hago clic en una entrada del historial,
- **cuando** se abre el detalle,
- **entonces** puedo ver toda la información, incluyendo las fotos de evidencia subidas por el técnico (si existían).