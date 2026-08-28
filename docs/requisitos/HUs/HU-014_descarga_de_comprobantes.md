# HU-014 — Visualización y descarga de comprobantes de pago

<!--
  ¿Qué? El usuario puede ver y descargar sus facturas.
  ¿Para qué? Llevar un control de los servicios contratados y pagos realizados.
  ¿Impacto? Transparencia financiera y cumplimiento tributario.
-->

## Identificación

| Campo            | Valor                                          |
| ---------------- | ---------------------------------------------- |
| **ID**           | HU-014                                         |
| **Título**       | Visualización y descarga de comprobantes de pago |
| **Módulo**       | Pagos                                          |
| **Prioridad**    | Media                                          |
| **Estado**       | Propuesta                                      |
| **RF asociados** | RF-012                                         |

## Historia

**Como** usuario autenticado,  
**quiero** ver y descargar mis comprobantes de pago o facturas,  
**para** llevar un control de mis servicios contratados y tener respaldo fiscal.

## Criterios de aceptación

### CA-014.1 — Lista de pagos
- **Dado que** accedo a `/mis-pagos`,
- **cuando** se carga la página,
- **entonces** veo una lista de todas mis transacciones con: fecha, monto, método de pago, estado (aprobado/rechazado) y un botón "Ver comprobante".

### CA-014.2 — Visualización en línea
- **Dado que** hago clic en "Ver comprobante",
- **cuando** se abre un modal o nueva pestaña,
- **entonces** puedo ver el comprobante en formato PDF embebido (sin descargar).

### CA-014.3 — Descarga en PDF
- **Dado que** hago clic en "Descargar",
- **cuando** el sistema genera el PDF,
- **entonces** se inicia la descarga de un archivo con nombre `comprobante_{id_pago}.pdf`.

### CA-014.4 — Contenido del comprobante
- **Dado que** abro el PDF descargado,
- **cuando** lo reviso,
- **entonces** contiene: logo de Neodomus, mis datos (nombre, dirección), datos del servicio (fecha, tipo), monto, número de transacción y estado.

### CA-014.5 — Comprobantes solo para el propietario
- **Dado que** intento acceder a un comprobante de otro usuario (cambiando el ID en la URL),
- **cuando** lo solicito,
- **entonces** el sistema me devuelve un error 403 (acceso denegado).