
---

## RF-023_actualizacion_de_estado_de_servicio_tecnico.md

```markdown
# RF-023 — Actualización del estado del servicio por el técnico

<!--
  ¿Qué? El técnico puede cambiar el estado del servicio a lo largo de su ejecución.
  ¿Para qué? Mantener actualizado el progreso del trabajo.
  ¿Impacto? El cliente y el administrador pueden hacer seguimiento en tiempo real.
-->

## Identificación

| Campo         | Valor                                          |
| ------------- | ---------------------------------------------- |
| **ID**        | RF-023                                         |
| **Nombre**    | Actualización del estado del servicio por el técnico |
| **Módulo**    | Técnico                                        |
| **Prioridad** | Alta                                           |
| **Estado**    | Propuesta                                      |
| **Fecha**     | Mayo 2026                                      |

## Descripción

El sistema debe permitir al técnico cambiar el estado del servicio (pendiente, en proceso o completado) según la secuencia lógica. No se permite retroceder a un estado anterior.

## Entradas

| Parámetro | Tipo   | Obligatorio | Validaciones                           |
| --------- | ------ | ----------- | -------------------------------------- |
| `id`      | int    | Sí          | ID de la tarea                         |
| `estado`  | string | Sí          | `en_progreso` o `completado`           |

## Proceso

1. El técnico, en el detalle de la tarea, ve botones según el estado actual:
   - Si `pendiente` → botón "Comenzar servicio" (cambia a `en_progreso`).
   - Si `en_progreso` → botón "Finalizar servicio" (cambia a `completado`), pero requiere evidencias (RF-024).
2. Al hacer clic, se envía `PUT /api/v1/tech/tarea/{id}/estado`.
3. El backend valida la transición (no se puede saltar de `pendiente` a `completado`).
4. Actualiza el estado en la tabla `citas`.
5. Registra en `audit_log` el cambio.
6. Notifica al usuario del nuevo estado (correo + in-app).

## Salidas

| Escenario                     | Código HTTP | Respuesta                              |
| ----------------------------- | ----------- | -------------------------------------- |
| Estado actualizado            | 200         | `"Estado actualizado a en_progreso"`   |
| Transición no permitida       | 400         | `"No se puede pasar de pendiente a completado"` |
| Faltan evidencias             | 400         | `"Debes subir al menos una foto antes de completar"` |

## Endpoints asociados

| Método | Ruta                                 | Auth | Descripción                          |
| ------ | ------------------------------------ | ---- | ------------------------------------ |
| PUT    | `/api/v1/tech/tarea/{id}/estado`     | Sí   | Cambia el estado de la tarea         |

## Reglas de negocio

- **RN-055:** Solo el técnico asignado puede actualizar el estado.
- **RN-056:** Para pasar a `completado`, el técnico debe haber subido al menos una evidencia.
- **RN-057:** No se puede cambiar a `pendiente` después de `en_progreso` (sin intervención de admin).