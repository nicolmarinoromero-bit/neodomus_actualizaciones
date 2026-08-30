# RF-039 — Alertas automáticas sobre reclamos o fallas

<!--
  ¿Qué? El administrador recibe alertas automáticas cuando un usuario reporta un reclamo.
  ¿Para qué? Resolver incidencias rápidamente.
  ¿Impacto? Mejora la satisfacción y la capacidad de respuesta.
-->

## Identificación

| Campo         | Valor                                      |
| ------------- | ------------------------------------------ |
| **ID**        | RF-039                                     |
| **Nombre**    | Alertas automáticas sobre reclamos o fallas |
| **Módulo**    | Administrador / Notificaciones             |
| **Prioridad** | Media                                      |
| **Estado**    | Propuesta                                  |
| **Fecha**     | Mayo 2026                                  |

## Descripción

El sistema debe enviar al administrador alertas automáticas por medio de la aplicación (notificación in-app) o correo electrónico cuando un usuario registre un reclamo o falle un servicio.

## Entradas

| Campo         | Tipo   | Descripción                               |
| ------------- | ------ | ----------------------------------------- |
| `reclamo_id`  | int    | ID del reclamo creado                     |
| `tipo`        | string | `reclamo`, `falla_tecnica`, `pago_rechazado` |

## Proceso

1. Un usuario crea un reclamo desde el detalle de un servicio.
2. El sistema detecta el evento y genera una notificación.
3. Se envía un correo al administrador (y una notificación in-app si está conectado).
4. El administrador puede acceder al reclamo desde el panel y tomar acciones.

## Salidas

| Escenario                     | Código HTTP | Respuesta (efecto secundario) |
| ----------------------------- | ----------- | ----------------------------- |
| Alerta enviada                | (automático) | No visible para el usuario   |

## Endpoints asociados

| Método | Ruta                             | Auth  | Descripción                       |
| ------ | -------------------------------- | ----- | --------------------------------- |
| POST   | `/api/v1/reclamos`               | Sí    | Usuario crea un reclamo (no detallado en RFs previos, pero implícito) |

## Reglas de negocio

- **RN-090:** El administrador debe poder marcar un reclamo como "resuelto" desde el panel.
- **RN-091:** Los reclamos pueden ser anónimos o con datos del usuario, según configuración.