# HU-034 — Visualización de todos los servicios (activos, cancelados, finalizados)

<!--
  ¿Qué? El administrador puede ver un panel con todos los servicios del sistema.
  ¿Para qué? Supervisar la operación completa.
  ¿Impacto? Permite tomar decisiones informadas y detectar anomalías.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-034                                               |
| **Título**       | Visualización de todos los servicios                 |
| **Módulo**       | Administrador                                        |
| **Prioridad**    | Alta                                                 |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-035                                               |

## Historia

**Como** administrador,  
**quiero** visualizar todos los servicios activos, cancelados o finalizados,  
**para** supervisar la operación completa del sistema y detectar posibles problemas.

## Criterios de aceptación

### CA-034.1 — Panel de servicios
- **Dado que** estoy en `/admin/servicios`,
- **cuando** se carga la página,
- **entonces** veo una tabla paginada con todas las citas del sistema, incluyendo: ID, cliente, técnico (si asignado), fecha, hora, estado y acciones.

### CA-034.2 — Filtros avanzados
- **Dado que** quiero filtrar por estado,
- **cuando** selecciono un estado en el desplegable,
- **entonces** la tabla se actualiza para mostrar solo las citas con ese estado.

### CA-034.3 — Filtros por fecha, técnico, cliente
- **Dado que** ingreso un rango de fechas, selecciono un técnico o un cliente,
- **cuando** aplico los filtros,
- **entonces** la tabla se actualiza en consecuencia.

### CA-034.4 — Exportación
- **Dado que** quiero exportar los datos filtrados,
- **cuando** hago clic en "Exportar a CSV/Excel",
- **entonces** descargo un archivo con la información actual.

### CA-034.5 — Detalle de cada servicio
- **Dado que** hago clic en una fila,
- **cuando** se abre el detalle,
- **entonces** puedo ver toda la información de la cita y, si es necesario, modificar el técnico o el estado (con permisos).