# HU-038 — Recepción de alertas automáticas sobre reclamos o fallas

<!--
  ¿Qué? El administrador recibe alertas cuando hay reclamos.
  ¿Para qué? Resolver incidencias rápidamente.
  ¿Impacto? Mejora la satisfacción del cliente.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-038                                               |
| **Título**       | Recepción de alertas automáticas sobre reclamos o fallas |
| **Módulo**       | Administrador / Notificaciones                       |
| **Prioridad**    | Media                                                |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-039                                               |

## Historia

**Como** administrador,  
**quiero** recibir alertas automáticas sobre reclamos o fallas por medio de la aplicación o correo electrónico,  
**para** resolver incidencias rápidamente y mantener la calidad del servicio.

## Criterios de aceptación

### CA-038.1 — Creación de reclamo por el usuario
- **Dado que** un usuario crea un reclamo desde el detalle de su servicio (botón "Reportar problema"),
- **cuando** se guarda el reclamo,
- **entonces** el sistema genera una alerta.

### CA-038.2 — Notificación al administrador
- **Dado que** hay un nuevo reclamo,
- **cuando** el sistema lo detecta,
- **entonces** me llega un correo y una notificación in-app con el resumen: usuario, servicio, motivo del reclamo.

### CA-038.3 — Panel de reclamos
- **Dado que** accedo a `/admin/reclamos`,
- **cuando** veo la lista,
- **entonces** puedo ver todos los reclamos, su estado (pendiente/en revisión/resuelto), y tomar acciones.

### CA-038.4 — Marcar como resuelto
- **Dado que** atiendo un reclamo,
- **cuando** lo marco como "Resuelto",
- **entonces** el sistema envía un correo al usuario informándole la resolución.

### CA-038.5 — Escalado
- **Dado que** un reclamo es grave,
- **cuando** selecciono "Escalar a supervisor",
- **entonces** se envía una alerta adicional a otro correo.