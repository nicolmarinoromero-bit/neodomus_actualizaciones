# HU-042 — Envío de comunicados o mensajes masivos (administrador)

<!--
  ¿Qué? El administrador puede enviar comunicados a todos o a un grupo.
  ¿Para qué? Mantener comunicación constante y oficial.
  ¿Impacto? Difundir información importante rápidamente.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-042                                               |
| **Título**       | Envío de comunicados o mensajes masivos              |
| **Módulo**       | Administrador                                        |
| **Prioridad**    | Media                                                |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-043                                               |

## Historia

**Como** administrador,  
**quiero** enviar comunicados o mensajes masivos a técnicos y usuarios,  
**para** mantener comunicación constante sobre novedades, mantenimientos o promociones.

## Criterios de aceptación

### CA-042.1 — Acceso a la herramienta
- **Dado que** estoy en `/admin/comunicados`,
- **cuando** veo el formulario,
- **entonces** tengo campos para: título, mensaje (texto enriquecido), destinatarios (usuarios, técnicos, ambos) y opción de programar envío.

### CA-042.2 — Envío inmediato
- **Dado que** completo el formulario y selecciono "Enviar ahora",
- **cuando** hago clic en enviar,
- **entonces** el sistema envía el comunicado por correo a los destinatarios seleccionados y crea notificaciones in-app.

### CA-042.3 — Programación
- **Dado que** selecciono una fecha y hora futura,
- **cuando** guardo,
- **entonces** el comunicado se envía automáticamente en ese momento.

### CA-042.4 — Vista previa
- **Dado que** escribo el mensaje,
- **cuando** hago clic en "Vista previa",
- **entonces** puedo ver cómo se verá en el correo y en la notificación in-app.

### CA-042.5 — Registro de envíos
- **Dado que** envío un comunicado,
- **cuando** se completa,
- **entonces** queda un registro en `audit_log` con el contenido, destinatarios y fecha.