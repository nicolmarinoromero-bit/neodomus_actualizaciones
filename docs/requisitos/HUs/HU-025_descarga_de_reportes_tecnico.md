# HU-025 — Descarga de reportes de servicios realizados (técnico)

<!--
  ¿Qué? El técnico puede exportar un reporte de su trabajo.
  ¿Para qué? Llevar un control personal de servicios y desempeño.
  ¿Impacto? Facilita la autogestión y la presentación de informes.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-025                                               |
| **Título**       | Descarga de reportes de servicios realizados         |
| **Módulo**       | Técnico                                              |
| **Prioridad**    | Baja                                                 |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-026                                               |

## Historia

**Como** técnico autenticado,  
**quiero** descargar reportes de los servicios que he realizado en un período de tiempo,  
**para** llevar un control de mi trabajo, ingresos y desempeño.

## Criterios de aceptación

### CA-025.1 — Acceso a la pantalla de reportes
- **Dado que** estoy autenticado como técnico,
- **cuando** accedo a `/tech/reportes`,
- **entonces** veo un formulario con campos para seleccionar fecha de inicio, fecha de fin y formato de descarga (PDF o Excel).

### CA-025.2 — Selección de rango de fechas
- **Dado que** selecciono un rango de fechas válido (ej. desde el 1 de mayo hasta el 31 de mayo),
- **cuando** hago clic en "Generar reporte",
- **entonces** el sistema genera un archivo con los servicios completados en ese período.

### CA-025.3 — Contenido del reporte
- **Dado que** abro el reporte generado,
- **cuando** lo reviso,
- **entonces** contiene:
  - Mi nombre y período seleccionado
  - Lista de servicios: fecha, cliente, dirección, tipo de servicio, monto (si aplica)
  - Estadísticas: total de servicios, promedio de calificaciones, ingresos totales

### CA-025.4 — Formato PDF y Excel
- **Dado que** elijo formato PDF,
- **cuando** descargo,
- **entonces** recibo un archivo con diseño de tabla legible y gráficos (opcional).
- **Dado que** elijo formato Excel,
- **cuando** descargo,
- **entonces** recibo un archivo .xlsx con datos en bruto para procesamiento.

### CA-025.5 — Reportes grandes (asíncronos)
- **Dado que** el rango de fechas abarca más de 3 meses (más de 100 servicios),
- **cuando** solicito el reporte,
- **entonces** el sistema lo genera en segundo plano y me envía un enlace de descarga por correo cuando esté listo.