# HU-026 — Registro de disponibilidad laboral (técnico)

<!--
  ¿Qué? El técnico puede configurar sus días y horas de trabajo.
  ¿Para qué? Que el administrador sepa cuándo asignarle servicios.
  ¿Impacto? Optimización de la asignación y respeto por la disponibilidad real.
-->

## Identificación

| Campo            | Valor                                            |
| ---------------- | ------------------------------------------------ |
| **ID**           | HU-026                                           |
| **Título**       | Registro de disponibilidad laboral (técnico)     |
| **Módulo**       | Técnico                                          |
| **Prioridad**    | Media                                            |
| **Estado**       | Propuesta                                        |
| **RF asociados** | RF-028                                           |

> **Nota 2026-08 — Estado real:** Esta HU describe chat/fecha/disponibilidad. **No implementado** como flujo bidireccional en `be/app/routers/` (sin `chat.py`/`disponibilidad`). Real: notificaciones `notificaciones.py:41` + `consultas.py:71` + `ChatBotWidget` FAQ. Se mantiene como requisito futuro / opcional, no bloquea presentación. Ver `RF-027` nota.

## Historia

**Como** técnico autenticado,  
**quiero** registrar mi disponibilidad laboral (días y horas en que puedo trabajar),  
**para** que el administrador solo me asigne servicios en esos horarios.

## Criterios de aceptación

### CA-026.1 — Pantalla de disponibilidad
- **Dado que** estoy autenticado como técnico,
- **cuando** accedo a `/tech/disponibilidad`,
- **entonces** veo un formulario con los 7 días de la semana, cada uno con:
  - Un toggle (activo/inactivo)
  - Hora de inicio (selector)
  - Hora de fin (selector)

### CA-026.2 — Configuración típica
- **Dado que** quiero trabajar de lunes a viernes de 9 a 18, y los sábados de 10 a 14,
- **cuando** configuro los toggles y horas correspondientes,
- **entonces** puedo guardar la configuración.

### CA-026.3 — Validación de horarios
- **Dado que** selecciono una hora de inicio mayor o igual que la hora de fin,
- **cuando** intento guardar,
- **entonces** veo el mensaje: "La hora de inicio debe ser anterior a la hora de fin".

### CA-026.4 — Guardado exitoso
- **Dado que** la configuración es válida,
- **cuando** hago clic en "Guardar",
- **entonces** el sistema almacena la disponibilidad en mi perfil y me muestra un mensaje de éxito.

### CA-026.5 — Disponibilidad por defecto
- **Dado que** nunca he configurado mi disponibilidad,
- **cuando** el administrador intenta asignarme un servicio,
- **entonces** el sistema asume lunes a viernes de 9 a 18 (o muestra una advertencia para que la configure).

### CA-026.6 — Impacto en asignaciones futuras
- **Dado que** modifico mi disponibilidad,
- **cuando** el administrador asigna nuevos servicios,
- **entonces** solo puedo ser asignado en los nuevos horarios. Los servicios ya asignados no se ven afectados.