# RF-011 — Realización de pagos

<!--
  ¿Qué? El usuario puede pagar sus servicios directamente desde la plataforma.
  ¿Para qué? Evitar desplazamientos y pagar de forma segura.
  ¿Impacto? Es el cierre del ciclo comercial: la monetización del servicio.
-->

## Identificación

| Campo         | Valor                        |
| ------------- | ---------------------------- |
| **ID**        | RF-011                       |
| **Nombre**    | Realización de pagos         |
| **Módulo**    | Pagos                        |
| **Prioridad** | Alta                         |
| **Estado**    | Propuesta                    |
| **Fecha**     | Mayo 2026                    |

> **Actualización 2026-08:** Pagos son **simulador académico** `pagos_service.py:5` `PAYMENT_PROVIDER=simulator`. Cita pago sincrónico `citas.py:609`; productos `POST /pedidos` `pedidos.py:198` con `ItemCarrito(metros/color/variante)` `pedidos.py:39` + `ServicioCheckout` + `DatosPago` `pedidos.py:59`. Métodos `GET /pedidos/metodos-pago` `pedidos.py:186`. No webhook/abono.

## Descripción

El sistema debe permitir al usuario realizar pagos directamente desde la plataforma, de forma segura, mediante integración con una pasarela de pagos (MercadoPago, Stripe, etc.). El pago puede ser total o parcial (abonos).

## Entradas

| Campo           | Tipo   | Obligatorio | Validaciones                             |
| --------------- | ------ | ----------- | ---------------------------------------- |
| `cita_id`       | int    | Sí          | La cita debe existir y pertenecer al usuario |
| `monto`         | float  | Sí          | > 0, ≤ total pendiente del pedido        |
| `metodo_pago`   | string | Sí          | `tarjeta`, `transferencia`               |
| `tipo`          | string | Sí          | `completo` o `abono`                     |

# RF-011 — Realización de pagos

<!--
  ¿Qué? El usuario puede pagar sus servicios directamente desde la plataforma.
  ¿Para qué? Evitar desplazamientos y pagar de forma segura.
  ¿Impacto? Es el cierre del ciclo comercial: la monetización del servicio.
-->

## Identificación

| Campo         | Valor                        |
| ------------- | ---------------------------- |
| **ID**        | RF-011                       |
| **Nombre**    | Realización de pagos         |
| **Módulo**    | Pagos                        |
| **Prioridad** | Alta                         |
| **Estado**    | Propuesta                    |
| **Fecha**     | Mayo 2026                    |

> **Actualización 2026-08:** Pagos son **simulador académico** `pagos_service.py:5` `PAYMENT_PROVIDER=simulator`. Cita pago sincrónico `citas.py:609`; productos `POST /pedidos` `pedidos.py:198` con `ItemCarrito(metros/color/variante)` `pedidos.py:39` + `ServicioCheckout` + `DatosPago` `pedidos.py:59`. Métodos `GET /pedidos/metodos-pago` `pedidos.py:186`. No webhook/abono.

## Descripción

El sistema debe permitir al usuario realizar pagos directamente desde la plataforma, de forma segura, mediante integración con una pasarela de pagos (MercadoPago, Stripe, etc.). El pago puede ser total o parcial (abonos).

## Entradas

| Campo           | Tipo   | Obligatorio | Validaciones                             |
| --------------- | ------ | ----------- | ---------------------------------------- |
| `cita_id`       | int    | Sí          | La cita debe existir y pertenecer al usuario |
| `monto`         | float  | Sí          | > 0, ≤ total pendiente del pedido        |
| `metodo_pago`   | string | Sí          | `tarjeta`, `transferencia`               |
| `tipo`          | string | Sí          | `completo` o `abono`                     |

## Proceso

1. Usuario accede al checkout de pago asociado a una cita.
2. El frontend muestra el resumen (total, abonado, pendiente).
3. Usuario ingresa monto (si es abono) y método.
4. El backend crea una intención de pago con la pasarela.
5. Usuario completa el pago en el entorno de la pasarela.
6. La pasarela notifica al webhook `POST /api/v1/pagos/webhook`.
7. El backend actualiza el estado del pedido:
   - Si es abono: incrementa `abonado_total`. Si `abonado_total >= total` → estado `pagado`.
   - Si es completo: estado `pagado`.
8. Se genera un comprobante (ver RF-012) y se notifica al usuario.

## Salidas

| Escenario                       | Código HTTP | Respuesta                                       |
| ------------------------------- | ----------- | ----------------------------------------------- |
| Inicio de pago exitoso          | 200         | `{ "payment_intent_id": "...", "client_secret": "..." }` |
| Webhook procesado correctamente | 200         | `{ "received": true }`                          |
| Error de pasarela               | 400         | `"Error al procesar el pago, intente nuevamente"` |
| Monto inválido                  | 400         | `"El monto no puede ser mayor al pendiente"`    |

## Endpoints asociados

| Método | Ruta                         | Auth | Descripción                                    |
| ------ | ---------------------------- | ---- | ---------------------------------------------- |
| POST   | `/api/v1/pagos/iniciar`      | Sí   | Crea una intención de pago en la pasarela      |
| POST   | `/api/v1/pagos/webhook`      | No*  | Recibe notificaciones de la pasarela (con firma)|
| POST   | `/api/v1/pagos/abono`        | Sí   | Registra un pago parcial (abono)               |

## Reglas de negocio

- **RN-026:** El `client_secret` nunca se expone en logs ni en respuestas no seguras.
- **RN-027:** Los abonos se acumulan; cuando `abonado_total >= total`, el pedido pasa automáticamente a `pagado`.
- **RN-028:** En desarrollo se usa sandbox; en producción, credenciales reales.

1. Usuario accede al checkout de pago asociado a una cita.
2. El frontend muestra el resumen (total, abonado, pendiente).
3. Usuario ingresa monto (si es abono) y método.
4. El backend crea una intención de pago con la pasarela.
5. Usuario completa el pago en el entorno de la pasarela.
6. La pasarela notifica al webhook `POST /api/v1/pagos/webhook`.
7. El backend actualiza el estado del pedido:
   - Si es abono: incrementa `abonado_total`. Si `abonado_total >= total` → estado `pagado`.
   - Si es completo: estado `pagado`.
8. Se genera un comprobante (ver RF-012) y se notifica al usuario.

## Salidas

| Escenario                       | Código HTTP | Respuesta                                       |
| ------------------------------- | ----------- | ----------------------------------------------- |
| Inicio de pago exitoso          | 200         | `{ "payment_intent_id": "...", "client_secret": "..." }` |
| Webhook procesado correctamente | 200         | `{ "received": true }`                          |
| Error de pasarela               | 400         | `"Error al procesar el pago, intente nuevamente"` |
| Monto inválido                  | 400         | `"El monto no puede ser mayor al pendiente"`    |

## Endpoints asociados

| Método | Ruta                         | Auth | Descripción                                    |
| ------ | ---------------------------- | ---- | ---------------------------------------------- |
| POST   | `/api/v1/pagos/iniciar`      | Sí   | Crea una intención de pago en la pasarela      |
| POST   | `/api/v1/pagos/webhook`      | No*  | Recibe notificaciones de la pasarela (con firma)|
| POST   | `/api/v1/pagos/abono`        | Sí   | Registra un pago parcial (abono)               |

## Reglas de negocio

- **RN-026:** El `client_secret` nunca se expone en logs ni en respuestas no seguras.
- **RN-027:** Los abonos se acumulan; cuando `abonado_total >= total`, el pedido pasa automáticamente a `pagado`.
- **RN-028:** En desarrollo se usa sandbox; en producción, credenciales reales.