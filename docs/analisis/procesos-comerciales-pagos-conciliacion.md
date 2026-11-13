# Análisis de procesos comerciales, pagos y conciliación

## Base del análisis

Descripción del código consultado en `be/app/routers/pedidos.py`, `be/app/services/pedidos_service.py`, `be/app/services/pagos_service.py`, `be/app/routers/reembolsos.py` y modelos de pedido/pago/factura. Las funciones visibles no demuestran que exista procesamiento bancario externo ni operación en producción. El proveedor predeterminado documentado es `simulator`.

## Flujo comercial comprobable

1. Catálogo público ofrece productos y variantes; el cliente agrega líneas al carrito web/móvil.
2. El cliente autenticado envía `POST /api/v1/pedidos`. El servicio valida líneas, precios/cantidades y disponibilidad; registra pedido, pago simulado y efectos del checkout.
3. Resultado aprobado permite completar pedido; resultado rechazado deja el pedido en estado de pago rechazado; algunos métodos pueden dejarlo pendiente y usar `POST /api/v1/pedidos/{id}/confirmar-pago` para reintentar.
4. La confirmación pendiente bloquea pedido/pago y recursos de inventario, registra aprobación, descuenta stock y crea factura y asignaciones de entrega/instalación en una transacción local. La documentación de T2 registra marcador `confirmacion_completa` e idempotencia.
5. El cliente consulta sus pedidos, estado y factura; administración consulta pedidos y gestiona etapas de entrega por rutas protegidas.

Este flujo representa la implementación del simulador y las rutas presentes; no acredita una orden a un proveedor financiero.

## Pagos y estados

El servicio simulado ofrece métodos cuyos códigos y disponibilidad dependen de `pagos_service.py` y del endpoint `GET /api/v1/pedidos/metodos-pago`. El inventario exacto debe actualizarse al cambiar ese código; el checkout documenta tarjeta débito/crédito, PSE, PayPal y punto de pago. Esos nombres identifican simulaciones locales, no integraciones activas.

Estados observados en el código/documentación: `pendiente`, `aprobado`, `rechazado`; el pedido usa, entre otros, `Pago pendiente`, `Pagado` y `Pago rechazado`. No se encontró un estado comercial general `cancelado` para todo pago/pedido en el flujo de checkout; las cancelaciones de cita y devolución son dominios relacionados pero diferentes.

| Caso | Comportamiento observado | Límite |
|---|---|---|
| Aprobado | Registra estado local aprobado; en checkout crea efectos locales asociados. | No hay evidencia de captura bancaria. |
| Rechazado | Registra rechazo y permite reintento conforme a la ruta de pago. | No equivale a rechazo emitido por adquirente externo. |
| Pendiente | Puede confirmarse mediante endpoint autenticado del pedido propio. | No hay webhook bancario comprobado. |
| Repetido | Confirmación completa se maneja idempotentemente; pago aprobado sin marcador completo da conflicto para revisión. | Hay estados históricos ambiguos documentados en T2. |

## Conciliación, duplicados y devoluciones

- La conciliación implementada es **interna**: coherencia entre pago, pedido, inventario y factura, incluyendo marcador de confirmación completa. No existe conciliación con extracto bancario comprobada.
- `docs/T2_consistencia_pago_pendiente.md` documenta que estados heredados aprobados sin el marcador completo deben enviarse a conciliación manual; no se resuelven automáticamente.
- Bloqueos, transacción local e idempotencia reducen duplicación de stock/factura en la confirmación. No resuelven duplicados de cargos externos porque no hay proveedor conectado.
- Para pedidos pagados se puede solicitar reembolso; administración procesa manualmente. `reembolso_service.py` usa el simulador. Reembolso externo real no está comprobado.
- Reembolsos relacionados con pedidos/citas guardan monto, estado y referencia disponible; la completitud de auditoría de cada cambio administrativo debe confirmarse en logs y datos de la instancia.

## Responsabilidades según permisos observados

| Etapa | Actor de sistema comprobado | Evidencia de acceso |
|---|---|---|
| Crear pedido / consultar lo propio | Cliente autenticado propietario | `pedidos.py`, filtros de propiedad; ver `T1_identidad_permisos.md`. |
| Consultar lista general, facturas administrativas y entrega | Administrador | Dependencia `_admin` en router. |
| Confirmar pago pendiente propio | Cliente autenticado propietario | Endpoint y servicio validan dueño del pedido. |
| Solicitar reembolso de pedido propio | Cliente autenticado propietario | `reembolsos.py`, validación de propietario/estado. |
| Procesar/reprocesar reembolso | Administrador | Dependencia `_admin`. |
| Conciliar diferencias financieras externas | No hay rol/flujo externo específico comprobado | PENDIENTE DE DEFINICIÓN operativa. |

## Riesgos y preguntas operativas

| Riesgo | Control actual observado | Pendiente |
|---|---|---|
| Doble finalización local | Locks, transacción, marcador e idempotencia en T2. | Operar y monitorear errores/conflictos heredados. |
| Diferencia entre pago y banco | Ninguna conciliación bancaria comprobada. | Definir proveedor, archivo/fuente de referencia y responsable. |
| Pago aprobado sin finalización completa | El sistema produce conflicto para conciliación. | Definir procedimiento manual autorizado y evidencia requerida. |
| Estado desactualizado de pasarela | No hay webhook de pasarela real identificado. | Pendiente de integración futura, fuera del alcance actual. |
| Reembolso duplicado o no trazable | Validaciones de reembolso activo y registros propios. | Confirmar con datos de entorno y definir doble control operativo. |
| Operación dependiente de ajuste manual | Reprocesamiento administrativo disponible para estados permitidos. | Definir quién autoriza, registra y revisa el resultado. |

## Mejoras recomendadas (no implementadas)

1. Definir un procedimiento operativo de conciliación interna para `409` por pago aprobado sin confirmación completa.
2. Separar en reportes los resultados del simulador de cualquier dato financiero real.
3. Si se decide integrar proveedor real, acordar referencias idempotentes, webhooks firmados, reversos, ventanas de conciliación y tratamiento contable antes de especificar cambios.
4. Definir roles humanos de preparación/revisión de conciliación fuera del conjunto de roles implementados.
