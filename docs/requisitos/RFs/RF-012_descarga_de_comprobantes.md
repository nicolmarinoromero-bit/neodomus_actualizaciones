# RF-012 — Descarga de comprobantes

<!--
  ¿Qué? El usuario puede ver y descargar comprobantes de pago.
  ¿Para qué? Llevar un control de sus transacciones.
  ¿Impacto? Transparencia financiera y cumplimiento fiscal.
-->

## Identificación

| Campo         | Valor                          |
| ------------- | ------------------------------ |
| **ID**        | RF-012                         |
| **Nombre**    | Descarga de comprobantes       |
| **Módulo**    | Pagos                          |
| **Prioridad** | Media                          |
| **Estado**    | Propuesta                      |
| **Fecha**     | Mayo 2026                      |

> **Actualización 2026-08:** Facturas `GET /pedidos/{id}/factura` cliente `pedidos.py:740` y `GET /pedidos/admin/facturas` admin `pedidos.py:578`, streaming PDF `factura_service.generar_factura_pdf`. También `POST /citas` genera factura `citas.py:647`. `pdf_url` en `mis-pedidos` `pedidos.py:275`.

## Descripción

El sistema debe permitir al usuario visualizar y descargar comprobantes de pago o facturas en formato PDF para cada transacción realizada.

## Entradas

| Parámetro | Tipo | Obligatorio | Descripción          |
| --------- | ---- | ----------- | -------------------- |
| `pago_id` | int  | Sí          | ID del pago a consultar |

# RF-012 — Descarga de comprobantes

<!--
  ¿Qué? El usuario puede ver y descargar comprobantes de pago.
  ¿Para qué? Llevar un control de sus transacciones.
  ¿Impacto? Transparencia financiera y cumplimiento fiscal.
-->

## Identificación

| Campo         | Valor                          |
| ------------- | ------------------------------ |
| **ID**        | RF-012                         |
| **Nombre**    | Descarga de comprobantes       |
| **Módulo**    | Pagos                          |
| **Prioridad** | Media                          |
| **Estado**    | Propuesta                      |
| **Fecha**     | Mayo 2026                      |

> **Actualización 2026-08:** Facturas `GET /pedidos/{id}/factura` cliente `pedidos.py:740` y `GET /pedidos/admin/facturas` admin `pedidos.py:578`, streaming PDF `factura_service.generar_factura_pdf`. También `POST /citas` genera factura `citas.py:647`. `pdf_url` en `mis-pedidos` `pedidos.py:275`.

## Descripción

El sistema debe permitir al usuario visualizar y descargar comprobantes de pago o facturas en formato PDF para cada transacción realizada.

## Entradas

| Parámetro | Tipo | Obligatorio | Descripción          |
| --------- | ---- | ----------- | -------------------- |
| `pago_id` | int  | Sí          | ID del pago a consultar |

## Proceso

1. Usuario accede a `/mis-pagos` → lista de transacciones.
2. Selecciona un pago y hace clic en "Ver comprobante".
3. El backend genera dinámicamente un PDF con los datos:
   - Logo de Neodomus
   - Datos del usuario (nombre, dirección)
   - Datos del servicio (fecha, tipo, monto)
   - Número de transacción y estado
4. Retorna el archivo PDF o una vista previa embebida.

## Salidas

| Escenario               | Código HTTP | Respuesta                          |
| ----------------------- | ----------- | ---------------------------------- |
| Comprobante generado    | 200         | Archivo PDF (`application/pdf`)    |
| Pago no encontrado      | 404         | `"Comprobante no encontrado"`      |
| Usuario no autorizado   | 403         | `"No tienes permiso"`              |

## Endpoints asociados

| Método | Ruta                             | Auth | Descripción                          |
| ------ | -------------------------------- | ---- | ------------------------------------ |
| GET    | `/api/v1/pagos/{id}/comprobante` | Sí   | Descarga el comprobante en PDF       |

## Reglas de negocio

- **RN-029:** El comprobante se genera bajo demanda a partir de datos de la BD (no se almacena como archivo).
- **RN-030:** Solo el usuario propietario del pago o el administrador pueden acceder.

1. Usuario accede a `/mis-pagos` → lista de transacciones.
2. Selecciona un pago y hace clic en "Ver comprobante".
3. El backend genera dinámicamente un PDF con los datos:
   - Logo de Neodomus
   - Datos del usuario (nombre, dirección)
   - Datos del servicio (fecha, tipo, monto)
   - Número de transacción y estado
4. Retorna el archivo PDF o una vista previa embebida.

## Salidas

| Escenario               | Código HTTP | Respuesta                          |
| ----------------------- | ----------- | ---------------------------------- |
| Comprobante generado    | 200         | Archivo PDF (`application/pdf`)    |
| Pago no encontrado      | 404         | `"Comprobante no encontrado"`      |
| Usuario no autorizado   | 403         | `"No tienes permiso"`              |

## Endpoints asociados

| Método | Ruta                             | Auth | Descripción                          |
| ------ | -------------------------------- | ---- | ------------------------------------ |
| GET    | `/api/v1/pagos/{id}/comprobante` | Sí   | Descarga el comprobante en PDF       |

## Reglas de negocio

- **RN-029:** El comprobante se genera bajo demanda a partir de datos de la BD (no se almacena como archivo).
- **RN-030:** Solo el usuario propietario del pago o el administrador pueden acceder.