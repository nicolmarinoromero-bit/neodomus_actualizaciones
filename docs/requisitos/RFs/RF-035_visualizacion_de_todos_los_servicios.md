# RF-035 — Visualización de todos los servicios (activos, cancelados, finalizados)

<!--
  ¿Qué? El administrador puede ver el estado de todos los servicios del sistema.
  ¿Para qué? Supervisar la operación completa.
  ¿Impacto? Permite tomar decisiones informadas y detectar anomalías.
-->

## Identificación

| Campo         | Valor                                              |
| ------------- | -------------------------------------------------- |
| **ID**        | RF-035                                             |
| **Nombre**    | Visualización de todos los servicios              |
| **Módulo**    | Administrador                                      |
| **Prioridad** | Alta                                               |
| **Estado**    | Propuesta                                          |
| **Fecha**     | Mayo 2026                                          |

## Descripción

El sistema debe permitir al administrador visualizar todos los servicios (citas) del sistema, con filtros por estado, fecha, técnico o usuario. Debe poder exportar la lista a CSV/Excel.

## Entradas

| Parámetro   | Tipo   | Obligatorio | Descripción                      |
| ----------- | ------ | ----------- | -------------------------------- |
| `estado`    | string | No          | Filtrar por estado               |
| `fecha_desde` | date | No          | Fecha de inicio                  |
| `fecha_hasta` | date | No          | Fecha de fin                     |
| `tecnico_id` | int   | No          | Filtrar por técnico              |
| `usuario_id` | int   | No          | Filtrar por usuario              |

## Proceso

1. El administrador accede a `/admin/servicios`.
2. Ve una tabla con todas las citas (paginada).
3. Puede aplicar filtros y ordenar por columnas.
4. Al hacer clic en una fila, ve el detalle completo.
5. Puede exportar los resultados filtrados a CSV o Excel.

## Salidas

```json
{
  "citas": [
    {
      "id": 101,
      "usuario_nombre": "Carlos Gómez",
      "tecnico_nombre": "Juan Técnico",
      "fecha": "2026-06-15",
      "estado": "confirmada"
    }
  ]
}
Endpoints asociados
Método	Ruta	Auth	Descripción
GET	/api/v1/admin/servicios	Sí (admin)	Lista todas las citas del sistema
Reglas de negocio
RN-081: El administrador puede ver todos los servicios, incluyendo los cancelados.

RN-082: Los filtros se aplican del lado del servidor para eficiencia.