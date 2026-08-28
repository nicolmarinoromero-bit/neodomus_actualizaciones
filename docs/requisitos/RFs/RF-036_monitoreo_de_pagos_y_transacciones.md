
---

## RF-036_monitoreo_de_pagos_y_transacciones.md

```markdown
# RF-036 — Monitoreo de pagos y transacciones

<!--
  ¿Qué? El administrador puede monitorear todos los pagos realizados en la plataforma.
  ¿Para qué? Llevar un control financiero transparente.
  ¿Impacto? Permite conciliar ingresos y detectar anomalías.
-->

## Identificación

| Campo         | Valor                                      |
| ------------- | ------------------------------------------ |
| **ID**        | RF-036                                     |
| **Nombre**    | Monitoreo de pagos y transacciones         |
| **Módulo**    | Administrador                              |
| **Prioridad** | Alta                                       |
| **Estado**    | Propuesta                                  |
| **Fecha**     | Mayo 2026                                  |

## Descripción

El sistema debe permitir al administrador monitorear todos los pagos y transacciones realizadas en la plataforma, con filtros por fecha, usuario, estado, y exportación a reportes.

## Entradas

| Parámetro   | Tipo   | Obligatorio | Descripción                  |
| ----------- | ------ | ----------- | ---------------------------- |
| `fecha_desde` | date | No          | Fecha de inicio              |
| `fecha_hasta` | date | No          | Fecha de fin                 |
| `estado`    | string | No          | `iniciado`, `aprobado`, `rechazado`, `reembolsado` |
| `usuario_id` | int   | No          | Filtrar por usuario          |

## Proceso

1. El administrador accede a `/admin/pagos`.
2. Ve una tabla con todas las transacciones.
3. Puede ver el detalle de cada pago y su comprobante asociado.
4. Puede filtrar y exportar a CSV/Excel.
5. Si hay pagos rechazados, puede contactar al usuario para resolver.

## Salidas

```json
{
  "pagos": [
    {
      "id": 1001,
      "usuario_nombre": "Carlos Gómez",
      "monto": 25000.00,
      "estado": "aprobado",
      "fecha": "2026-05-27"
    }
  ]
}
Endpoints asociados
Método	Ruta	Auth	Descripción
GET	/api/v1/admin/pagos	Sí (admin)	Lista todas las transacciones
Reglas de negocio
RN-083: No se pueden modificar pagos ya aprobados (solo reembolsar si la política lo permite).

RN-084: Los pagos rechazados pueden ser reintentados por el usuario; el administrador puede ver el motivo.
