# HU-010 — Confirmación de servicio

<!--
  ¿Qué? El usuario recibe una confirmación de que su solicitud fue recibida.
  ¿Para qué? Estar seguro de que el sistema procesó su pedido.
  ¿Impacto? Reduce la incertidumbre y mejora la confianza.
-->

## Identificación

| Campo            | Valor                          |
| ---------------- | ------------------------------ |
| **ID**           | HU-010                         |
| **Título**       | Confirmación de servicio       |
| **Módulo**       | Notificaciones                 |
| **Prioridad**    | Alta                           |
| **Estado**       | Propuesta                      |
| **RF asociados** | RF-008                         |

## Historia

**Como** usuario,  
**quiero** recibir una confirmación del servicio agendado por medio de la aplicación (notificación in-app) o por correo electrónico,  
**para** saber que mi solicitud fue aceptada correctamente.

## Criterios de aceptación

### CA-010.1 — Mensaje en pantalla
- **Dado que** envío una solicitud de servicio exitosamente,
- **cuando** soy redirigido a `/mis-servicios`,
- **entonces** veo un banner o toast que dice: "Solicitud enviada. Recibirás un correo de confirmación".

### CA-010.2 — Correo de confirmación
- **Dado que** la solicitud se crea,
- **cuando** reviso mi bandeja de entrada,
- **entonces** recibo un correo con los detalles del servicio solicitado (fecha, hora, dirección, tipo de servicio) y un enlace para ver el estado.

### CA-010.3 — Notificación in-app
- **Dado que** estoy autenticado en la plataforma,
- **cuando** se crea la cita,
- **entonces** aparece una notificación en la campana (ícono de campana con un número) indicando que mi solicitud fue recibida.

### CA-010.4 — Confirmación después de aprobación del administrador
- **Dado que** el administrador aprueba mi solicitud y asigna un técnico,
- **cuando** la cita cambia a estado `confirmada`,
- **entonces** recibo otra notificación (correo + in-app) indicando que mi servicio ha sido confirmado y cuál es el técnico asignado.

### CA-010.5 — Contenido del correo
- **Dado que** recibo el correo de confirmación inicial,
- **cuando** lo leo,
- **entonces** contiene: tipo de servicio, fecha, hora, dirección, estado actual ("pendiente de aprobación") y un enlace a `/mis-servicios`.