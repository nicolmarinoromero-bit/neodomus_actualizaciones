# HU-016 — Notificaciones de cambios de estado del servicio

<!--
  ¿Qué? El usuario recibe alertas cuando su servicio cambia de estado.
  ¿Para qué? Estar informado sin necesidad de ingresar al sistema.
  ¿Impacto? Mejora la comunicación y reduce la ansiedad.
-->

## Identificación

| Campo            | Valor                                          |
| ---------------- | ---------------------------------------------- |
| **ID**           | HU-016                                         |
| **Título**       | Notificaciones de cambios de estado del servicio |
| **Módulo**       | Notificaciones                                 |
| **Prioridad**    | Alta                                           |
| **Estado**       | Propuesta                                      |
| **RF asociados** | RF-014, RF-018                                 |

## Historia

**Como** usuario autenticado,  
**quiero** recibir notificaciones por correo electrónico o WhatsApp sobre los cambios en el estado de mi servicio,  
**para** estar informado sin tener que ingresar al sistema constantemente.

## Criterios de aceptación

### CA-016.1 — Disparadores de notificación
- **Dado que** mi cita cambia de estado a:
  - `confirmada` (aprobada por admin)
  - `en_progreso` (el técnico comenzó)
  - `completada` (servicio finalizado)
  - `cancelada` (por mí o por admin)
- **cuando** el cambio se registra,
- **entonces** recibo una notificación por correo electrónico y una notificación in-app (campana).

### CA-016.2 — Contenido de la notificación
- **Dado que** recibo un correo de notificación,
- **cuando** lo leo,
- **entonces** contiene: tipo de servicio, fecha, hora, nuevo estado, y un enlace para ver los detalles.

### CA-016.3 — Notificación de recordatorio
- **Dado que** faltan 24 horas para mi cita confirmada,
- **cuando** el proceso programado se ejecuta,
- **entonces** recibo un recordatorio por correo con los detalles y un enlace para modificar/cancelar (si todavía es posible).

### CA-016.4 — Configuración de preferencias
- **Dado que** accedo a mi perfil,
- **cuando** voy a la sección "Preferencias de notificación",
- **entonces** puedo elegir si quiero recibir notificaciones por correo, solo in-app, o desactivarlas para ciertos tipos (ej. recordatorios).

### CA-016.5 — Campana in-app
- **Dado que** estoy autenticado en la plataforma,
- **cuando** recibo una notificación,
- **entonces** el ícono de campana muestra un número con las no leídas. Al abrir el panel, puedo ver la lista y marcar como leídas.