# HU-043 — Exportación de reportes de desempeño general (administrador)

<!--
  ¿Qué? El administrador puede generar reportes estadísticos.
  ¿Para qué? Evaluar el crecimiento y la eficiencia del sistema.
  ¿Impacto? Permite la toma de decisiones basada en datos.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-043                                               |
| **Título**       | Exportación de reportes de desempeño general         |
| **Módulo**       | Administrador                                        |
| **Prioridad**    | Media                                                |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-044                                               |

## Historia

**Como** administrador,  
**quiero** ver estadísticas y reportes de desempeño general mediante PDF/Excel,  
**para** evaluar el crecimiento y la eficiencia del sistema y tomar decisiones estratégicas.

## Criterios de aceptación

### CA-043.1 — Panel de reportes
- **Dado que** estoy en `/admin/reportes`,
- **cuando** se carga,
- **entonces** veo métricas clave en tarjetas: total de servicios este mes, ingresos, técnicos más activos, satisfacción promedio.

### CA-043.2 — Selección de tipo y período
- **Dado que** quiero un reporte detallado,
- **cuando** selecciono tipo de reporte (servicios, pagos, técnicos, satisfacción) y rango de fechas,
- **entonces** se generan gráficos y tablas.

### CA-043.3 — Exportación
- **Dado que** hago clic en "Exportar a PDF" o "Exportar a Excel",
- **cuando** el sistema genera el archivo,
- **entonces** descargo un documento con los datos del reporte actual.

### CA-043.4 — Programación de reportes
- **Dado que** quiero recibir reportes por correo automáticamente,
- **cuando** configuro una suscripción (ej. reporte mensual),
- **entonces** el sistema envía el reporte a mi correo el primer día de cada mes.

### CA-043.5 — Datos anonimizados
- **Dado que** el reporte incluye datos sensibles,
- **cuando** lo exporto,
- **entonces** los nombres de clientes y técnicos aparecen parcialmente (ej. "Carlos G.") o se pueden excluir según configuración.