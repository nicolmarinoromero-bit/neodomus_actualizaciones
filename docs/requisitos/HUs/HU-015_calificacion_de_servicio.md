# HU-015 — Calificación del servicio y comentarios

<!--
  ¿Qué? El usuario puede calificar y comentar el servicio recibido.
  ¿Para qué? Contribuir a la reputación del técnico y de la plataforma.
  ¿Impacto? Mejora la calidad del servicio y genera confianza.
-->

## Identificación

| Campo            | Valor                                    |
| ---------------- | ---------------------------------------- |
| **ID**           | HU-015                                   |
| **Título**       | Calificación del servicio y comentarios  |
| **Módulo**       | Calificaciones                           |
| **Prioridad**    | Media                                    |
| **Estado**       | Propuesta                                |
| **RF asociados** | RF-013                                   |

## Historia

**Como** usuario autenticado,  
**quiero** calificar el servicio recibido (puntuación de 1 a 5 estrellas) y dejar un comentario,  
**para** contribuir a la reputación del técnico y ayudar a otros usuarios a elegir.

## Criterios de aceptación

### CA-015.1 — Acceso a la calificación
- **Dado que** una cita está en estado `completada` y aún no la he calificado,
- **cuando** voy al detalle de esa cita en `mis-servicios`,
- **entonces** veo un botón "Calificar este servicio".

### CA-015.2 — Modal de calificación
- **Dado que** hago clic en calificar,
- **cuando** se abre un modal,
- **entonces** puedo seleccionar de 1 a 5 estrellas (representación visual) y escribir un comentario en un campo de texto (opcional).

### CA-015.3 — Envío exitoso
- **Dado que** selecciono una puntuación y escribo un comentario (opcional),
- **cuando** envío,
- **entonces** la calificación se guarda, el técnico recibe una notificación y el modal se cierra mostrando un mensaje de éxito.

### CA-015.4 — Una sola calificación por servicio
- **Dado que** ya califiqué este servicio,
- **cuando** intento calificarlo de nuevo,
- **entonces** el botón "Calificar" ya no aparece o está deshabilitado.

### CA-015.5 — Visualización de calificaciones previas
- **Dado que** veo el detalle de una cita completada que ya califiqué,
- **cuando** reviso la sección de calificación,
- **entonces** veo la puntuación y mi comentario en modo solo lectura.

### CA-015.6 — Comentarios inapropiados (reporte)
- **Dado que** veo un comentario ofensivo (como técnico o administrador),
- **cuando** hago clic en "Reportar",
- **entonces** se envía una alerta al administrador para que lo revise.