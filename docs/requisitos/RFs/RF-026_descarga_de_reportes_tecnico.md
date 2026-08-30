
---

## RF-026_descarga_de_reportes_tecnico.md

```markdown
# RF-026 — Descarga de reportes de servicios realizados por el técnico

<!--
  ¿Qué? El técnico puede descargar un reporte de sus servicios completados.
  ¿Para qué? Llevar un control personal de su trabajo y desempeño.
  ¿Impacto? Facilita la autogestión y la presentación de informes.
-->

## Identificación

| Campo         | Valor                                              |
| ------------- | -------------------------------------------------- |
| **ID**        | RF-026                                             |
| **Nombre**    | Descarga de reportes de servicios realizados      |
| **Módulo**    | Técnico                                            |
| **Prioridad** | Baja                                               |
| **Estado**    | Propuesta                                          |
| **Fecha**     | Mayo 2026                                          |

> **Nota 2026-08 — No implementado para rol técnico:** No existe `GET /tech/reportes` (`reports.py` solo admin `GET /reports/*` `reports.py:43` `_admin`). Técnico ve `GET /tecnicos/comisiones` (`tecnicos.py:698`) y `GET /calificaciones/mis` (`calificaciones.py:206`). Reportes PDF solo admin (`reports.py:872` `ventas/pdf`). RF futuro.

## Descripción

El sistema debe permitir al técnico descargar reportes de los servicios realizados en un rango de fechas, en formato PDF o Excel, para llevar un control personal.

## Entradas

| Parámetro | Tipo   | Obligatorio | Descripción                     |
| --------- | ------ | ----------- | ------------------------------- |
| `desde`   | date   | Sí          | Fecha de inicio                 |
| `hasta`   | date   | Sí          | Fecha de fin                    |
| `formato` | string | No          | `pdf` o `excel` (default `pdf`) |

## Proceso

1. El técnico accede a `/tech/reportes`, selecciona rango de fechas y formato.
2. El backend consulta las citas completadas en ese rango.
3. Genera un archivo (PDF o XLSX) con:
   - Cabecera: nombre del técnico, período.
   - Lista de servicios: fecha, cliente, dirección, tipo, monto (si aplica).
   - Estadísticas: total de servicios, promedio de calificaciones, ingresos generados.
4. Retorna el archivo para descarga.

## Salidas

| Escenario                     | Código HTTP | Respuesta                         |
| ----------------------------- | ----------- | --------------------------------- |
| Reporte generado              | 200         | Archivo binario (PDF/XLSX)        |
| Rango de fechas inválido      | 400         | `"La fecha desde debe ser anterior a la fecha hasta"` |

## Endpoints asociados

| Método | Ruta                         | Auth | Descripción                        |
| ------ | ---------------------------- | ---- | ---------------------------------- |
| GET    | `/api/v1/tech/reportes`      | Sí   | Descarga reporte en PDF o Excel    |

## Reglas de negocio

- **RN-062:** El técnico solo puede descargar reportes de sus propios servicios.
- **RN-063:** Para rangos mayores a 3 meses, el reporte se genera asíncronamente y se envía por correo.