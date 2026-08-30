# HU-027 — Comunicación con el usuario desde la plataforma (técnico)

<!--
  ¿Qué? El técnico puede chatear con el cliente.
  ¿Para qué? Coordinar horarios o resolver dudas.
  ¿Impacto? Mejora la comunicación y la satisfacción.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-027                                               |
| **Título**       | Comunicación con el usuario desde la plataforma (técnico) |
| **Módulo**       | Chat                                                 |
| **Prioridad**    | Media                                                |
| **Estado**       | Propuesta (No implementado — futuro)                                            |
| **RF asociados** | RF-027                                               |

> **Nota 2026-08 — Estado real:** Esta HU describe chat/fecha/disponibilidad. **No implementado** como flujo bidireccional en `be/app/routers/` (sin `chat.py`/`disponibilidad`). Real: notificaciones `notificaciones.py:41` + `consultas.py:71` + `ChatBotWidget` FAQ. Se mantiene como requisito futuro / opcional, no bloquea presentación. Ver `RF-027` nota.

## Historia

**Como** técnico autenticado,  
**quiero** comunicarme con el usuario desde la plataforma (chat),  
**para** resolver dudas, coordinar horarios o detalles del servicio.

## Criterios de aceptación

### CA-027.1 — Acceso al chat desde la tarea
- **Dado que** estoy en el detalle de una tarea asignada,
- **cuando** hago clic en "Chatear con el cliente",
- **entonces** se abre la misma interfaz de chat que usa el cliente, mostrando el historial (si existe).

### CA-027.2 — Contexto del servicio visible
- **Dado que** abro el chat,
- **cuando** veo el encabezado,
- **entonces** aparece la información del servicio: fecha, hora, dirección y tipo.

### CA-027.3 — Envío de mensajes
- **Dado que** escribo un mensaje y presiono enviar,
- **cuando** el backend lo guarda,
- **entonces** el cliente lo recibe en su chat y recibe una notificación in-app (y correo).

### CA-027.4 — Notificación al técnico de nuevos mensajes
- **Dado que** el cliente me envía un mensaje mientras yo no estoy en el chat,
- **cuando** recibo el mensaje,
- **entonces** veo una notificación in-app (y opcionalmente un correo resumen).

### CA-027.5 — Solo participantes autorizados
- **Dado que** intento acceder al chat de una tarea que no me pertenece,
- **cuando** lo hago,
- **entonces** el sistema devuelve error 403.