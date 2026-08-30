# RF-034 — Asignación manual de técnicos a los servicios

<!--
  ¿Qué? El administrador puede asignar técnicos manualmente a los servicios.
  ¿Para qué? Garantizar atención inmediata cuando la asignación automática no es suficiente.
  ¿Impacto? Mayor control sobre la distribución del trabajo.
-->

## Identificación

| Campo         | Valor                                        |
| ------------- | -------------------------------------------- |
| **ID**        | RF-034                                       |
| **Nombre**    | Asignación manual de técnicos a los servicios |
| **Módulo**    | Administrador                                |
| **Prioridad** | Alta                                         |
| **Estado**    | Propuesta                                    |
| **Fecha**     | Mayo 2026                                    |

## Descripción

El sistema debe permitir al administrador asignar técnicos manualmente a los servicios, ya sea al aprobar una solicitud o en cualquier momento antes de que el servicio comience.

## Entradas

| Parámetro     | Tipo | Obligatorio | Descripción               |
| ------------- | ---- | ----------- | ------------------------- |
| `cita_id`     | int  | Sí          | ID de la cita             |
| `tecnico_id`  | int  | Sí          | ID del técnico a asignar  |

## Proceso

1. El administrador accede al detalle de una cita en estado `pendiente` o `confirmada` (sin técnico).
2. Hace clic en "Asignar técnico" y selecciona uno de una lista filtrada (solo técnicos disponibles en ese horario).
3. El backend verifica la disponibilidad del técnico en la fecha/hora de la cita.
4. Asigna el técnico (`tecnico_id` en `citas`).
5. Notifica al técnico (correo + in-app) de la nueva tarea.
6. Registra la asignación en `audit_log` con el ID del administrador.

## Salidas

| Escenario                     | Código HTTP | Respuesta                              |
| ----------------------------- | ----------- | -------------------------------------- |
| Asignación exitosa            | 200         | `"Técnico asignado correctamente"`     |
| Técnico no disponible         | 400         | `"El técnico no está disponible en ese horario"` |

## Endpoints asociados

| Método | Ruta                                           | Auth  | Descripción                          |
| ------ | ---------------------------------------------- | ----- | ------------------------------------ |
| POST   | `/api/v1/admin/solicitudes/{id}/asignar-tecnico` | Sí (admin) | Asigna un técnico a la cita         |

## Reglas de negocio

- **RN-079:** La asignación manual respeta la disponibilidad del técnico (ver RF-028).
- **RN-080:** Si la cita ya tiene un técnico, se puede reasignar (si el servicio no comenzó).