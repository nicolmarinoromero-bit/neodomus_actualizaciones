# Documentación de funciones críticas del backend

Estándar aplicado: **docstrings de Python** (estilo Google, en español) directamente en el código fuente. Este documento es el índice de localización; la especificación completa (parámetros, retorno, excepciones y comportamiento) vive en cada docstring. No se duplica su contenido aquí.

Revisión: 12 de noviembre de 2026.

## Funciones documentadas en esta actividad (6)

| # | Función | Ubicación | Rol en NeoDomus |
|---|---|---|---|
| 1 | `login` | [`be/app/services/auth_service.py`](../be/app/services/auth_service.py) | Autenticación unificada de clientes y empleados; emite el par de tokens JWT y registra la auditoría de accesos. |
| 2 | `refresh_access_token` | [`be/app/services/auth_service.py`](../be/app/services/auth_service.py) | Renovación del par de tokens a partir del refresh token; valida identidad y cuenta activa. |
| 3 | `register_client` | [`be/app/services/auth_service.py`](../be/app/services/auth_service.py) | Registro de clientes con verificación de correo por código (tabla `pending_registrations`). |
| 4 | `verify_client_email` | [`be/app/services/auth_service.py`](../be/app/services/auth_service.py) | Creación definitiva de la cuenta del cliente al verificar el correo. |
| 5 | `crear_pedido` | [`be/app/services/pedidos_service.py`](../be/app/services/pedidos_service.py) | Núcleo del checkout: validaciones, cupones, pago simulado, descuento de stock con bloqueo, factura, órdenes de instalación y entrega en un único commit. |
| 6 | `checkout` (endpoint) | [`be/app/routers/pedidos.py`](../be/app/routers/pedidos.py) | Endpoint `POST /api/v1/pedidos` que expone el flujo anterior al cliente web/móvil. |

## Funciones críticas que ya estaban documentadas en el código

Se reutilizan tal cual; no se reescribieron para no duplicar contenido:

| Función | Ubicación | Rol |
|---|---|---|
| `descontar_stock` | [`be/app/services/inventario_service.py`](../be/app/services/inventario_service.py) | Descuento de stock con `SELECT ... FOR UPDATE` y error 409 por stock insuficiente. |
| `reintegrar_stock` | [`be/app/services/inventario_service.py`](../be/app/services/inventario_service.py) | Reintegro exacto de unidades/metros en devoluciones (PEN-10). |
| `elegibilidad_pedido` | [`be/app/services/devoluciones_service.py`](../be/app/services/devoluciones_service.py) | Qué productos de un pedido pueden devolverse (corte completo en venta por metros). |
| `crear_solicitud` | [`be/app/services/devoluciones_service.py`](../be/app/services/devoluciones_service.py) | Creación de solicitudes de devolución con sus reglas de negocio (PEN-09). |
| `procesar_pago` | [`be/app/services/pagos_service.py`](../be/app/services/pagos_service.py) | Pasarela simulada académica: tarjeta, PSE, PayPal y punto de pago. |
| `crear_reembolso` / `procesar_reembolso` | [`be/app/services/reembolso_service.py`](../be/app/services/reembolso_service.py) | Registro y procesamiento de reembolsos con deduplicación por origen (PEN-10). |
| `google_login` / `link_google_employee` | [`be/app/services/auth_service.py`](../be/app/services/auth_service.py) | OAuth 2.0 con Google para clientes y vinculación de empleados. |

## Convenio

Toda función crítica nueva del backend debe incluir un docstring con: propósito, `Args`, `Returns`, `Raises` y el comportamiento que otro desarrollador necesita conocer (transacciones, efectos secundarios, orden de validaciones). Las docstrings anteriores a esta actividad (p. ej. `inventario_service`) ya seguían ese formato parcialmente; las de la tabla principal lo completan.
