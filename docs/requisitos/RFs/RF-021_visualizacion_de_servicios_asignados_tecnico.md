# RF-021 — Visualización de servicios asignados al técnico

<!--
  ¿Qué? El técnico puede ver la lista de servicios que le han sido asignados.
  ¿Para qué? Conocer sus tareas programadas.
  ¿Impacto? Es la base de la gestión de trabajo del técnico.
-->

## Identificación

| Campo         | Valor                                    |
| ------------- | ---------------------------------------- |
| **ID**        | RF-021                                   |
| **Nombre**    | Visualización de servicios asignados al técnico |
| **Módulo**    | Técnico                                  |
| **Prioridad** | Alta                                     |
| **Estado**    | Propuesta                                |
| **Fecha**     | Mayo 2026                                |

## Descripción

El sistema debe permitir al técnico visualizar los servicios que le han sido asignados por el administrador, con filtros por estado y ordenamiento por fecha.

## Entradas

| Parámetro | Tipo   | Obligatorio | Descripción                          |
| --------- | ------ | ----------- | ------------------------------------ |
| `estado`  | string | No          | `pendiente`, `confirmada`, `en_progreso`, `completada` |
| `orden`   | string | No          | `fecha_asc` o `fecha_desc` (por defecto ascendente) |

## Proceso

1. El técnico inicia sesión y accede a `/tech/mis-tareas`.
2. El frontend envía `GET /api/v1/tech/mis-tareas` con los filtros.
3. El backend consulta las citas donde `tecnico_id = current_user.id`.
4. Retorna la lista paginada, ordenada por fecha.
5. El frontend muestra las tarjetas con: cliente, dirección, fecha, hora, tipo de servicio y estado.
6. El técnico puede filtrar por estado usando un selector.

## Salidas

```json
{
  "tareas": [
    {
      "id": 101,
      "cliente_nombre": "Carlos Gómez",
      "direccion": "Av. Siempreviva 742",
      "fecha": "2026-06-15",
      "hora": "10:00:00",
      "servicio_nombre": "Instalación domótica",
      "estado": "pendiente"
    }
  ]
}
Endpoints asociados
Método	Ruta	Auth	Descripción
GET	/api/v1/tech/mis-tareas	Sí	Lista las tareas asignadas al técnico
Reglas de negocio
RN-050: El técnico solo ve sus propias tareas; el administrador ve todas.

RN-051: El estado pendiente significa que el técnico aún no comenzó el servicio.

RN-052: Las tareas completadas se muestran en el historial pero no se pueden modificar.