# HU-009 — Solicitud de servicio

<!--
  ¿Qué? El usuario solicita un servicio con fecha, hora y dirección.
  ¿Para qué? Agendar una atención según su disponibilidad.
  ¿Impacto? Es el paso central para convertir un interés en una cita.
-->

## Identificación

| Campo            | Valor                      |
| ---------------- | -------------------------- |
| **ID**           | HU-009                     |
| **Título**       | Solicitud de servicio      |
| **Módulo**       | Servicios (Citas)          |
| **Prioridad**    | Alta                       |
| **Estado**       | Propuesta                  |
| **RF asociados** | RF-007                     |

## Historia

**Como** usuario autenticado,  
**quiero** solicitar un servicio completando un formulario con fecha, hora y tipo de trabajo,  
**para** agendar una atención según mi disponibilidad.

## Criterios de aceptación

### CA-009.1 — Formulario de solicitud
- **Dado que** estoy en la página de detalle de un servicio,
- **cuando** hago clic en "Solicitar este servicio",
- **entonces** accedo a `/servicios/{id}/solicitar` donde veo un formulario con:
  - Selección de fecha (calendario)
  - Selección de hora (solo horas disponibles)
  - Dirección (precargada de mi perfil, pero editable)
  - Comentarios opcionales

### CA-009.2 — Validación de fecha y hora
- **Dado que** selecciono una fecha anterior al día actual o con menos de 24 horas de anticipación,
- **cuando** intento enviar,
- **entonces** veo un mensaje: "La fecha debe ser al menos 24 horas posterior a hoy".

### CA-009.3 — Horarios disponibles
- **Dado que** selecciono una fecha,
- **cuando** el sistema carga las horas disponibles,
- **entonces** solo se muestran las horas dentro del horario de atención configurado por el administrador (ej. 9:00 a 18:00) y que no estén ya ocupadas por otro servicio del mismo usuario o por otros usuarios (con el mismo técnico eventual).

### CA-009.4 — Sin conflictos de horario
- **Dado que** el usuario ya tiene otra cita en la misma fecha y hora seleccionada,
- **cuando** intenta enviar,
- **entonces** ve un error: "Ya tienes una cita programada en ese horario".

### CA-009.5 — Solicitud exitosa
- **Dado que** todos los datos son válidos,
- **cuando** envío el formulario,
- **entonces** se crea la cita en estado `pendiente` y soy redirigido a `/mis-servicios` con un mensaje de éxito.

### CA-009.6 — Estado de carga
- **Dado que** envío el formulario,
- **cuando** la solicitud está en proceso,
- **entonces** el botón "Enviar solicitud" se deshabilita y muestra "Enviando...".