# HU-035 — Monitoreo de pagos y transacciones (administrador)

<!--
  ¿Qué? El administrador puede ver todos los pagos realizados.
  ¿Para qué? Llevar un control financiero transparente.
  ¿Impacto? Permite conciliar ingresos y detectar anomalías.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-035                                               |
| **Título**       | Monitoreo de pagos y transacciones                   |
| **Módulo**       | Administrador                                        |
| **Prioridad**    | Alta                                                 |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-036                                               |

## Historia

**Como** administrador,  
**quiero** monitorear todos los pagos y transacciones realizadas en la plataforma,  
**para** llevar un control financiero transparente y detectar posibles fraudes.

## Criterios de aceptación

### CA-035.1 — Panel de pagos
- **Dado que** estoy en `/admin/pagos`,
- **cuando** se carga la página,
- **entonces** veo una tabla con todas las transacciones: fecha, usuario, monto, método, estado (aprobado/rechazado), y un enlace al comprobante.

### CA-035.2 — Filtros
- **Dado que** quiero ver solo pagos aprobados de un período,
- **cuando** aplico filtros por estado y rango de fechas,
- **entonces** la tabla se actualiza.

### CA-035.3 — Resumen de ingresos
- **Dado que** veo el panel,
- **cuando** reviso el resumen superior,
- **entonces** veo: total de ingresos del día/semana/mes, promedio de tickets, cantidad de transacciones.

### CA-035.4 — Exportación
- **Dado que** quiero un reporte financiero,
- **cuando** hago clic en "Exportar a Excel",
- **entonces** descargo un archivo con todas las transacciones filtradas.

### CA-035.5 — Detalle de un pago
- **Dado que** hago clic en una fila,
- **cuando** se abre el detalle,
- **entonces** veo el comprobante completo y los datos asociados al servicio.