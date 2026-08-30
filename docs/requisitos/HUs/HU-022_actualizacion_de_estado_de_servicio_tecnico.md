# HU-022 — Actualización del estado del servicio (técnico)

<!--
  ¿Qué? El técnico puede cambiar el estado de la tarea mientras la realiza.
  ¿Para qué? Mantener actualizado el progreso del trabajo.
  ¿Impacto? El cliente y el administrador pueden hacer seguimiento en tiempo real.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-022                                               |
| **Título**       | Actualización del estado del servicio (técnico)      |
| **Módulo**       | Técnico                                              |
| **Prioridad**    | Alta                                                 |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-023                                               |

## Historia

**Como** técnico autenticado,  
**quiero** cambiar el estado del servicio (pendiente, en proceso o completado),  
**para** que el cliente y el administrador sepan en qué etapa está mi trabajo.

## Criterios de aceptación

### CA-022.1 — Botones según estado actual
- **Dado que** estoy en el detalle de la tarea,
- **cuando** veo los botones de acción,
- **entonces** según el estado actual:
  - Si `pendiente`: veo un botón "Comenzar servicio" (cambia a `en_progreso`).
  - Si `en_progreso`: veo un botón "Finalizar servicio" (cambia a `completado`).
  - Si `completado`: no veo botones de cambio.

### CA-022.2 — Confirmación para completar
- **Dado que** hago clic en "Finalizar servicio",
- **cuando** el sistema muestra un diálogo de confirmación,
- **entonces** debo confirmar para evitar clics accidentales.

### CA-022.3 — Validación de secuencia
- **Dado que** intento pasar de `pendiente` a `completado` directamente,
- **cuando** la solicitud llega al backend,
- **entonces** el sistema devuelve un error 400: "No se puede saltar de pendiente a completado".

### CA-022.4 — Requisito de evidencias para completar
- **Dado que** intento marcar como `completado` sin haber subido al menos una foto de evidencia,
- **cuando** envío la solicitud,
- **entonces** veo un error: "Debes subir al menos una foto antes de completar el servicio".

### CA-022.5 — Notificación al cliente
- **Dado que** cambio el estado a `en_progreso` o `completado`,
- **cuando** la transacción se guarda,
- **entonces** el cliente recibe una notificación (correo + in-app) del nuevo estado.

### CA-022.6 — Registro en auditoría
- **Dado que** cambio el estado,
- **cuando** se guarda,
- **entonces** el sistema registra en `audit_log` quién hizo el cambio y desde qué estado a cuál.