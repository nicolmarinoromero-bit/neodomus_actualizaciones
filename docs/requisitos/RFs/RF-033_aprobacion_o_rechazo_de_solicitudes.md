# RF-033 — Aprobación o rechazo de solicitudes de servicios

<!--
  ¿Qué? El administrador puede aprobar o rechazar las solicitudes de servicio.
  ¿Para qué? Controlar el flujo de trabajo y garantizar la calidad.
  ¿Impacto? Asegura que solo solicitudes válidas sean procesadas.
-->

## Identificación

| Campo         | Valor                                          |
| ------------- | ---------------------------------------------- |
| **ID**        | RF-033                                         |
| **Nombre**    | Aprobación o rechazo de solicitudes de servicios |
| **Módulo**    | Administrador                                  |
| **Prioridad** | Alta                                           |
| **Estado**    | Propuesta                                      |
| **Fecha**     | Mayo 2026                                      |

## Descripción

El sistema debe permitir al administrador aprobar o rechazar las solicitudes de servicios (citas en estado `pendiente`). Al aprobar, se debe asignar un técnico (automática o manualmente, ver RF-034). Al rechazar, se debe indicar un motivo.

## Entradas

| Parámetro | Tipo   | Obligatorio | Descripción                         |
| --------- | ------ | ----------- | ----------------------------------- |
| `id`      | int    | Sí          | ID de la cita                       |
| `tecnico_id` (opcional) | int | No        | Para aprobación con asignación manual |
| `motivo`  | string | Sí (para rechazo) | Motivo del rechazo                  |

## Proceso

1. El administrador accede a `/admin/solicitudes`.
2. Ve una lista de citas en estado `pendiente`.
3. Selecciona una y hace clic en "Aprobar" o "Rechazar".
4. Si aprueba:
   - Asigna un técnico (si no se proporciona, se usa asignación automática basada en disponibilidad).
   - Cambia estado de `pendiente` a `confirmada`.
   - Notifica al usuario y al técnico.
5. Si rechaza:
   - Solicita un motivo.
   - Cambia estado a `cancelada`.
   - Notifica al usuario con el motivo.

## Salidas

| Escenario                     | Código HTTP | Respuesta                              |
| ----------------------------- | ----------- | -------------------------------------- |
| Aprobación exitosa            | 200         | `"Solicitud aprobada y técnico asignado"` |
| Rechazo exitoso               | 200         | `"Solicitud rechazada"`                |
| No hay técnico disponible     | 400         | `"No hay técnicos disponibles en el horario solicitado"` |

## Endpoints asociados

| Método | Ruta                                   | Auth  | Descripción                          |
| ------ | -------------------------------------- | ----- | ------------------------------------ |
| PUT    | `/api/v1/admin/solicitudes/{id}/aprobar` | Sí (admin) | Aprueba la solicitud                |
| PUT    | `/api/v1/admin/solicitudes/{id}/rechazar`| Sí (admin) | Rechaza la solicitud con motivo      |

## Reglas de negocio

- **RN-077:** Una vez aprobada, la cita no puede ser modificada por el usuario (solo cancelada con 48h).
- **RN-078:** El administrador puede anular una aprobación solo si el servicio aún no fue comenzado por el técnico.