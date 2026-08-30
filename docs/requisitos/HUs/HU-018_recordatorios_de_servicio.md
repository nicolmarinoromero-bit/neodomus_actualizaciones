# HU-018 — Recordatorios automáticos antes del servicio

<!--
  ¿Qué? El sistema recuerda al usuario la fecha del servicio.
  ¿Para qué? Evitar olvidos o ausencias.
  ¿Impacto? Reduce cancelaciones de última hora y mejora la puntualidad.
-->

## Identificación

| Campo            | Valor                                    |
| ---------------- | ---------------------------------------- |
| **ID**           | HU-018                                   |
| **Título**       | Recordatorios automáticos antes del servicio |
| **Módulo**       | Notificaciones                           |
| **Prioridad**    | Media                                    |
| **Estado**       | Propuesta                                |
| **RF asociados** | RF-018                                   |

## Historia

**Como** usuario autenticado,  
**quiero** recibir recordatorios automáticos (por correo) antes de la fecha programada del servicio,  
**para** no olvidarme y poder cancelar con tiempo si es necesario.

## Criterios de aceptación

### CA-018.1 — Recordatorio de 24 horas
- **Dado que** tengo una cita confirmada en estado `confirmada` o `en_progreso`,
- **cuando** faltan exactamente 24 horas para la fecha/hora,
- **entonces** recibo un correo de recordatorio con los detalles de la cita.

### CA-018.2 — Contenido del recordatorio
- **Dado que** abro el correo de recordatorio,
- **cuando** lo leo,
- **entonces** contiene: tipo de servicio, fecha, hora, dirección, técnico asignado, y un enlace para cancelar (si aún es posible).

### CA-018.3 — Recordatorio de 1 hora (opcional)
- **Dado que** tengo habilitada esta opción en mis preferencias,
- **cuando** faltan 60 minutos para la cita,
- **entonces** recibo otro recordatorio (correo o solo in-app).

### CA-018.4 — Cancelación de recordatorios al cancelar la cita
- **Dado que** la cita es cancelada antes de los recordatorios programados,
- **cuando** el administrador o yo la cancelamos,
- **entonces** los recordatorios pendientes no se envían.

### CA-018.5 — Configuración
- **Dado que** accedo a `/perfil/preferencias`,
- **cuando** puedo activar/desactivar los recordatorios de 1 hora,
- **entonces** el sistema guarda mi preferencia.