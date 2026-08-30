# HU-039 — Copias de seguridad automáticas

<!--
  ¿Qué? El sistema realiza backups automáticos de la información.
  ¿Para qué? Proteger los datos contra pérdidas o desastres.
  ¿Impacto? Garantiza la recuperación de datos en caso de fallo.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-039                                               |
| **Título**       | Copias de seguridad automáticas                      |
| **Módulo**       | Administrador / Infraestructura                      |
| **Prioridad**    | Alta                                                 |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-040                                               |

## Historia

**Como** administrador,  
**quiero** que el sistema realice copias de seguridad automáticas de la información,  
**para** estar preparado ante cualquier pérdida de datos o desastre técnico.

## Criterios de aceptación

### CA-039.1 — Frecuencia de backups
- **Dado que** el sistema está en producción,
- **cuando** pasa un día,
- **entonces** se realiza automáticamente un backup completo de la base de datos y los archivos subidos (fotos, comprobantes) a las 2:00 AM.

### CA-039.2 — Almacenamiento externo
- **Dado que** se genera el backup,
- **cuando** se completa,
- **entonces** se almacena en un servicio externo (AWS S3, Google Cloud Storage, o servidor separado) con retención de 30 días.

### CA-039.3 — Reporte al administrador
- **Dado que** el backup se completa exitosamente,
- **cuando** finaliza,
- **entonces** recibo un correo con el informe (tamaño, duración, ubicación).
- **Dado que** el backup falla,
- **cuando** ocurre el error,
- **entonces** recibo un correo de alerta para que tome medidas.

### CA-039.4 — Restauración manual
- **Dado que** necesito restaurar una copia,
- **cuando** solicito la restauración desde el panel de admin,
- **entonces** el sistema me permite seleccionar una fecha y restaurar la BD a ese estado (previa confirmación).

### CA-039.5 — Backup manual bajo demanda
- **Dado que** estoy en `/admin/backup`,
- **cuando** hago clic en "Realizar backup ahora",
- **entonces** el sistema ejecuta el proceso de forma inmediata.