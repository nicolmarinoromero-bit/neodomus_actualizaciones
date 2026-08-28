# HU-013 — Realización de pagos desde la plataforma

<!--
  ¿Qué? El usuario puede pagar sus servicios en línea.
  ¿Para qué? Evitar desplazamientos y pagar de forma segura.
  ¿Impacto? Es el cierre del ciclo comercial.
-->

## Identificación

| Campo            | Valor                                |
| ---------------- | ------------------------------------ |
| **ID**           | HU-013                               |
| **Título**       | Realización de pagos desde la plataforma |
| **Módulo**       | Pagos                                |
| **Prioridad**    | Alta                                 |
| **Estado**       | Propuesta                            |
| **RF asociados** | RF-011                               |

## Historia

**Como** usuario autenticado,  
**quiero** realizar el pago directamente desde la plataforma, de forma segura,  
**para** evitar desplazamientos y pagar sin riesgos.

## Criterios de aceptación

### CA-013.1 — Acceso al checkout
- **Dado que** tengo una cita en estado `pendiente` o `confirmada`,
- **cuando** voy al detalle de la cita o al listado `mis-servicios`,
- **entonces** veo un botón "Pagar ahora" que me lleva al checkout.

### CA-013.2 — Resumen de pago
- **Dado que** entro al checkout,
- **cuando** veo la pantalla,
- **entonces** me muestra: servicio, fecha, monto total, cuánto he abonado (si corresponde) y cuánto falta.

### CA-013.3 — Métodos de pago
- **Dado que** selecciono un método,
- **cuando** elijo entre tarjeta de crédito/débito o transferencia,
- **entonces** se abre el entorno seguro de la pasarela (MercadoPago, Stripe, etc.).

### CA-013.4 — Pago exitoso
- **Dado que** el pago es exitoso,
- **cuando** la pasarela confirma,
- **entonces** veo un mensaje de éxito, recibo un correo con el comprobante y la cita se actualiza (si era pago completo, queda lista para confirmar; si era abono, se registra el abono).

### CA-013.5 — Pagos parciales (abonos)
- **Dado que** no quiero pagar el total de una vez,
- **cuando** selecciono la opción "Pagar solo un abono" e ingreso un monto,
- **entonces** puedo pagar parcialmente. El sistema registra el abono y queda reflejado el saldo pendiente.

### CA-013.6 — Error de pago
- **Dado que** el pago es rechazado (fondo insuficiente, tarjeta inválida, etc.),
- **cuando** la pasarela informa el error,
- **entonces** veo un mensaje claro y puedo reintentar con otro método.

### CA-013.7 — Seguridad
- **Dado que** estoy en el proceso de pago,
- **cuando** ingreso los datos de mi tarjeta,
- **entonces** nunca veo ni guardo esos datos en Neodomus; la pasarela maneja todo de forma segura.