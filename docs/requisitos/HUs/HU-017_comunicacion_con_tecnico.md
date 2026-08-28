# HU-017 — Comunicación directa con el técnico asignado

<!--
  ¿Qué? El usuario puede chatear con el técnico que realizará su servicio.
  ¿Para qué? Coordinar detalles o resolver dudas antes del servicio.
  ¿Impacto? Mejora la satisfacción y reduce malentendidos.
-->

## Identificación

| Campo            | Valor                                          |
| ---------------- | ---------------------------------------------- |
| **ID**           | HU-017                                         |
| **Título**       | Comunicación directa con el técnico asignado   |
| **Módulo**       | Chat                                           |
| **Prioridad**    | Media                                          |
| **Estado**       | Propuesta                                      |
| **RF asociados** | RF-015, RF-027                                 |

## Historia

**Como** usuario autenticado,  
**quiero** comunicarme directamente con el técnico asignado a mi servicio,  
**para** coordinar detalles o resolver dudas antes de la visita.

## Criterios de aceptación

### CA-017.1 — Acceso al chat
- **Dado que** mi cita tiene un técnico asignado (estado `confirmada` o `en_progreso`),
- **cuando** voy al detalle de la cita,
- **entonces** veo un botón "Chatear con el técnico".

### CA-017.2 — Interfaz de chat
- **Dado que** abro el chat,
- **cuando** se carga la conversación,
- **entonces** veo:
  - El historial de mensajes (si los hay)
  - Un campo para escribir
  - Un encabezado con el contexto del servicio (fecha, hora, dirección, tipo de servicio)

### CA-017.3 — Envío de mensajes
- **Dado que** escribo un mensaje y presiono "Enviar",
- **cuando** el backend lo guarda,
- **entonces** aparece en el chat para ambos (yo y el técnico), con la hora exacta.

### CA-017.4 — Notificación de nuevos mensajes
- **Dado que** el técnico me responde mientras yo no estoy en el chat,
- **cuando** recibo el mensaje,
- **entonces** me llega una notificación in-app (y un correo resumen, si lo tengo configurado).

### CA-017.5 — Seguridad
- **Dado que** intento acceder al chat de una cita en la que no soy el cliente ni el técnico asignado,
- **cuando** lo hago,
- **entonces** el sistema devuelve error 403 (prohibido).