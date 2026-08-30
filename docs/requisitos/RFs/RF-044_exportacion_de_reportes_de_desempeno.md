# RF-044 — Exportación de reportes de desempeño general

<!--
  ¿Qué? El administrador puede visualizar y exportar reportes de desempeño general.
  ¿Para qué? Evaluar el crecimiento y la eficiencia del sistema.
  ¿Impacto? Permite la toma de decisiones basada en datos.
-->

## Identificación

| Campo         | Valor                                                |
| ------------- | ---------------------------------------------------- |
| **ID**        | RF-044                                               |
| **Nombre**    | Exportación de reportes de desempeño general        |
| **Módulo**    | Administrador                                        |
| **Prioridad** | Media                                                |
| **Estado**    | Propuesta                                            |
| **Fecha**     | Mayo 2026                                            |

## Descripción

El sistema debe permitir al administrador visualizar y exportar reportes de desempeño general en formato PDF o Excel, incluyendo métricas como: servicios realizados por período, ingresos, técnicos más activos, satisfacción promedio, etc.

## Entradas

| Parámetro | Tipo   | Obligatorio | Descripción                            |
| --------- | ------ | ----------- | -------------------------------------- |
| `tipo`    | string | Sí          | `servicios`, `pagos`, `tecnicos`, `satisfaccion` |
| `desde`   | date   | Sí          | Fecha de inicio                        |
| `hasta`   | date   | Sí          | Fecha de fin                           |
| `formato` | string | No          | `pdf` o `excel` (default `pdf`)        |

## Proceso

1. El administrador accede a `/admin/reportes`.
2. Selecciona el tipo de reporte, rango de fechas y formato.
3. El backend consulta la base de datos y genera el reporte:
   - **Servicios**: cantidad de citas por estado, evolución diaria/semanal.
   - **Pagos**: ingresos totales, desglose por método de pago, promedio por servicio.
   - **Técnicos**: ranking por cantidad de servicios completados, calificación promedio.
   - **Satisfacción**: evolución de calificaciones, palabras más usadas en comentarios.
4. Genera el archivo (PDF con tablas y gráficos, o XLSX con datos brutos).
5. Retorna el archivo para descarga.

## Salidas

| Escenario                     | Código HTTP | Respuesta                         |
| ----------------------------- | ----------- | --------------------------------- |
| Reporte generado              | 200         | Archivo binario (PDF/XLSX)        |
| Rango de fechas inválido      | 400         | `"La fecha desde debe ser anterior a la fecha hasta"` |

## Endpoints asociados

| Método | Ruta                               | Auth  | Descripción                            |
| ------ | ---------------------------------- | ----- | -------------------------------------- |
| GET    | `/api/v1/admin/reportes/exportar`  | Sí (admin) | Exporta el reporte en PDF/Excel        |

## Reglas de negocio

- **RN-103:** Para grandes volúmenes de datos (> 10,000 registros), el reporte debe generarse asíncronamente y enviarse por correo.
- **RN-104:** Los reportes pueden guardarse en el historial para consultarlos más tarde.
- **RN-105:** Las métricas de satisfacción excluyen calificaciones reportadas como falsas.
