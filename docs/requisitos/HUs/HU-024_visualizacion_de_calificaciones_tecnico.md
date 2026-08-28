# HU-024 — Visualización de calificaciones y comentarios (técnico)

<!--
  ¿Qué? El técnico puede ver las calificaciones que los usuarios le han dejado.
  ¿Para qué? Conocer su nivel de desempeño y mejorar.
  ¿Impacto? Retroalimentación para la mejora continua.
-->

## Identificación

| Campo            | Valor                                              |
| ---------------- | -------------------------------------------------- |
| **ID**           | HU-024                                             |
| **Título**       | Visualización de calificaciones y comentarios (técnico) |
| **Módulo**       | Técnico                                            |
| **Prioridad**    | Media                                              |
| **Estado**       | Propuesta                                          |
| **RF asociados** | RF-025                                             |

## Historia

**Como** técnico autenticado,  
**quiero** ver las calificaciones y comentarios que los usuarios han dejado sobre mis servicios,  
**para** conocer mi nivel de desempeño y detectar áreas de mejora.

## Criterios de aceptación

### CA-024.1 — Pantalla "Mis calificaciones"
- **Dado que** estoy autenticado como técnico,
- **cuando** accedo a `/tech/mis-calificaciones`,
- **entonces** veo mi calificación promedio (con representación de estrellas) y el total de calificaciones recibidas.

### CA-024.2 — Lista de calificaciones
- **Dado que** veo la lista,
- **cuando** reviso cada calificación,
- **entonces** veo: nombre del usuario (parcial, ej. "Carlos G."), puntuación (1-5 estrellas), comentario escrito, fecha y servicio asociado.

### CA-024.3 — Ordenamiento
- **Dado que** las calificaciones se muestran,
- **cuando** cargo la página,
- **entonces** están ordenadas por fecha descendente (las más recientes primero).

### CA-024.4 — Reporte de comentario inapropiado
- **Dado que** considero que un comentario es abusivo o falso,
- **cuando** hago clic en "Reportar comentario",
- **entonces** se envía una alerta al administrador para que lo revise.

### CA-024.5 — Notificación de nueva calificación
- **Dado que** un usuario me califica,
- **cuando** se guarda la calificación,
- **entonces** recibo una notificación in-app (y opcionalmente un correo) informándome.