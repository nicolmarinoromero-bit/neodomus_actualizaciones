# RF-009 — Visualización del estado de las solicitudes

<!--
  ¿Qué? El usuario puede ver el estado de sus servicios (pendiente, confirmado, en_progreso, completado, cancelado).
  ¿Para qué? Hacer seguimiento a sus solicitudes.
  ¿Impacto? Transparencia y reducción de consultas a soporte.
-->

## Identificación

| Campo         | Valor                                      |
| ------------- | ------------------------------------------ |
| **ID**        | RF-009                                     |
| **Nombre**    | Visualización del estado de las solicitudes |
| **Módulo**    | Servicios (Citas)                          |
| **Prioridad** | Alta                                       |
| **Estado**    | Propuesta                                  |
| **Fecha**     | Mayo 2026                                  |

## Descripción

El sistema debe permitir al usuario visualizar el estado de sus solicitudes (pendiente, confirmada, en_progreso, completada, cancelada) en una lista con filtros y actualización automática.

## Entradas

| Parámetro | Tipo   | Obligatorio | Descripción                          |
| --------- | ------ | ----------- | ------------------------------------ |
| `estado`  | string | No          | Filtro por estado                    |

## Proceso

1. Usuario accede a `/mis-servicios`.
2. Backend consulta citas del usuario, con opción de filtro por estado.
3. Retorna lista paginada.
4. El frontend muestra tarjetas con estado, fecha, técnico (si asignado) y acciones.

## Salidas

```json
{
  "citas": [
    {
      "id": 101,
      "servicio_nombre": "Instalación",
      "fecha": "2026-06-15",
      "hora": "10:00",
      "estado": "confirmada",
      "tecnico_nombre": "Juan Técnico"
    }
  ]
}
Endpoints asociados
Método	Ruta	Auth	Descripción
GET	/api/v1/citas/mis-citas	Sí	Lista las citas del usuario actual
Reglas de negocio
RN-021: La lista debe actualizarse automáticamente (polling cada 30s o WebSockets).

RN-022: Los estados se muestran con colores semánticos (verde = completada, rojo = cancelada, etc.).

text

