# RF-014 — Notificación de cambios de estado

<!--
  ¿Qué? El usuario recibe notificaciones cuando el estado de su servicio cambia.
  ¿Para qué? Estar informado sin necesidad de ingresar al sistema.
  ¿Impacto? Mejora la comunicación y reduce incertidumbre.
-->

## Identificación

| Campo         | Valor                                |
| ------------- | ------------------------------------ |
| **ID**        | RF-014                               |
| **Nombre**    | Notificación de cambios de estado    |
| **Módulo**    | Notificaciones                       |
| **Prioridad** | Alta                                 |
| **Estado**    | Propuesta                            |
| **Fecha**     | Mayo 2026                            |

## Descripción

El sistema debe notificar al usuario, por correo electrónico y mediante notificaciones in-app (campana), cada vez que el estado de su servicio cambie (confirmado, en_progreso, completado, cancelado).

## Entradas

| Campo         | Tipo   | Descripción                               |
| ------------- | ------ | ----------------------------------------- |
| `cita_id`     | int    | ID de la cita cuyo estado cambió          |
| `estado_anterior` | string | Estado previo al cambio                   |
| `estado_nuevo`    | string | Estado después del cambio                 |

## Proceso

1. Un cambio de estado se produce (por técnico o administrador).
2. Un trigger en la BD o el servicio correspondiente dispara una notificación.
3. El backend envía un correo al usuario con:
   - Servicio, fecha, hora, nuevo estado y enlace a detalle.
4. Se crea un registro en la tabla `notificaciones` (in-app).

## Salidas

| Escenario                          | Código HTTP | Respuesta (efecto secundario) |
| ---------------------------------- | ----------- | ----------------------------- |
| Notificación enviada correctamente | 200         | (No visible para el usuario)  |
| Fallo en el envío de correo        | 500 log     | Se registra en logs y se reintenta |

## Endpoints asociados

| Método | Ruta                                  | Auth | Descripción                          |
| ------ | ------------------------------------- | ---- | ------------------------------------ |
| GET    | `/api/v1/notifications/mis-notificaciones` | Sí | Lista notificaciones del usuario     |
| PUT    | `/api/v1/notifications/{id}/leida`    | Sí   | Marca una notificación como leída    |

## Reglas de negocio

- **RN-034:** Las notificaciones por correo se envían de forma asíncrona para no bloquear la respuesta.
- **RN-035:** El usuario puede desactivar las notificaciones por correo (dejando solo in-app) desde su configuración.