# HU-030 — Asignación manual de técnicos a servicios

<!--
  ¿Qué? El administrador puede asignar técnicos a las solicitudes.
  ¿Para qué? Garantizar atención inmediata al cliente.
  ¿Impacto? Mayor control sobre la distribución del trabajo.
-->

## Identificación

| Campo            | Valor                                          |
| ---------------- | ---------------------------------------------- |
| **ID**           | HU-030                                         |
| **Título**       | Asignación manual de técnicos a servicios      |
| **Módulo**       | Administrador                                  |
| **Prioridad**    | Alta                                           |
| **Estado**       | Propuesta                                      |
| **RF asociados** | RF-034                                         |

## Historia

**Como** administrador,  
**quiero** asignar técnicos manualmente a los servicios (al aprobar una solicitud o en cualquier momento antes de que empiece),  
**para** garantizar que cada servicio tenga un profesional adecuado.

## Criterios de aceptación

### CA-030.1 — Asignación desde la lista de solicitudes
- **Dado que** estoy en `/admin/solicitudes`,
- **cuando** veo una cita en estado `pendiente`,
- **entonces** puedo hacer clic en "Asignar técnico" directamente.

### CA-030.2 — Selección del técnico
- **Dado que** abro el modal de asignación,
- **cuando** el sistema me muestra una lista de técnicos disponibles (que estén activos y con disponibilidad horaria para la fecha/hora de la cita),
- **entonces** selecciono uno y confirmo.

### CA-030.3 — Asignación automática como alternativa
- **Dado que** quiero aprobar una solicitud sin seleccionar técnico manualmente,
- **cuando** hago clic en "Aprobar y asignar automáticamente",
- **entonces** el sistema elige un técnico disponible según su carga de trabajo y disponibilidad.

### CA-030.4 — Reasignación
- **Dado que** una cita ya tiene técnico pero el servicio aún no comenzó (estado `confirmada` o `en_progreso`),
- **cuando** el administrador puede reasignar a otro técnico (por enfermedad, etc.),
- **entonces** el técnico original recibe una notificación de desasignación, y el nuevo recibe la notificación de asignación.

### CA-030.5 — Notificación al técnico
- **Dado que** asigno un técnico,
- **cuando** se guarda la asignación,
- **entonces** el técnico recibe un correo y una notificación in-app: "Nuevo servicio asignado".

### CA-030.6 — Validación de disponibilidad
- **Dado que** intento asignar un técnico que no está disponible en el horario de la cita,
- **cuando** lo selecciono,
- **entonces** el sistema me muestra una advertencia y no permite la asignación.