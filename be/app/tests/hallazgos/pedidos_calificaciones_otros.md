# Hallazgos: pedidos / calificaciones / otros endpoints

Tests que documentan el **comportamiento actual** del código (no se modificó
nada de producción). Archivos: `test_pedidos.py`, `test_calificaciones.py`,
`test_otros_endpoints.py`.

## 1. La factura PDF responde 500 porque falta `app/static/Logo.jpg`

**Dónde:** `app/services/factura_service.py` (generación del PDF con
reportlab) — el endpoint `GET /pedidos/{id}/factura` y
`GET /pedidos/admin/{id}/factura`.

**Efecto:** el checkout **sí crea la factura** (fila en `facturas` y
`factura` en la respuesta del checkout), pero descargarla siempre falla con
**500 «Logo de NEODOMUS no encontrado»**. El archivo `Logo.jpg` no existe en
el repositorio (solo se referencia en el código).

**Tests:** `test_pedidos.py::test_factura_pdf_del_cliente` y
`test_pedidos.py::test_admin_factura_pdf` (comportamiento ACTUAL: 500 con
`"Logo"` en el detalle). `test_factura_pdf_sin_factura_404` y
`test_factura_pdf_de_pedido_ajeno_404` cubren los 404.

## 2. El simulador de pago aprueba por defecto; la tarjeta de prueba ...0001 no surte efecto sola

**Dónde:** `app/services/pagos_service.py` → simulador de pagos
(`procesar_pago`).

**Efecto:** sin el campo `resultado_simulacion` en el cuerpo de pago, el
simulador resuelve **«aprobado»** siempre. La tarjeta de prueba documentada
como rechazo (`...0001`) **no cambia el resultado por sí misma**: un checkout
con esa tarjeta termina en pedido «Aprobado» con factura creada. Para
probar el rechazo hay que enviar explícitamente
`pago.resultado_simulacion = "rechazado"`.

**Tests:** `test_pedidos.py::test_checkout_pago_rechazado` (fuerza el
rechazo con `resultado_simulacion`) y
`test_pedidos.py::test_confirmar_pago_pendiente_genera_factura` (método
`punto_pago` deja el pago pendiente y la confirmación manual lo aprueba).

## 3. `cantidad: 0` en el checkout se coacciona a 1

**Dónde:** `app/services/pedidos_service.py` → `crear_pedidoDesdeCheckout`,
expresión `int(cantidad or 1)`.

**Efecto:** `{"cantidad": 0}` **no** se rechaza: se convierte en 1 y se
cobra/entrega una unidad. La validación real de cantidades solo cubre
negativos (`cantidad < 1` → 400) y el esquema Pydantic no impone `ge=1` en
el item del checkout, así que el 0 nunca llega a esa rama.

**Tests:** `test_pedidos.py::test_checkout_cantidad_invalida_400` (nota en
el docstring: la cantidad 0 es coaccionada, no rechazada).

## 4. `GET /especializaciones?todas=true` está documentado como privado pero es público

**Dónde:** `app/routers/especializaciones.py` → listado con `todas=true`.

**Efecto:** el docstring/summary indica que el parámetro «requiere
autenticación de empleado», pero el endpoint **no tiene ninguna
dependencia de autenticación**: responde **200 sin credenciales** y expone
también las especializaciones inactivas. Cualquier visitante puede ver el
catálogo completo (incluido el flag `activa`).

**Test:** `test_otros_endpoints.py::test_especializaciones_listado_publico`
(comportamiento ACTUAL: 200 sin token con `todas=true`).

## 5. `POST /devoluciones/solicitudes` con un pedido ajeno responde 500 (no 404)

**Dónde:** `app/routers/devoluciones.py` → `crear_solicitud_devolucion()`
llama a `devoluciones_service.elegibilidad_pedido()`, que lanza
`PermissionError("Pedido no encontrado")` cuando el pedido no pertenece al
cliente. El router solo traduce `ItemInvalido` a HTTP.

**Efecto:** el manejador genérico de `app/main.py` convierte la excepción en
**500 «Error interno del servidor»**, mientras que
`GET /devoluciones/elegibilidad/{id}` para **el mismo caso responde 404**.
Inconsistencia de API: el cliente ve un error del servidor en vez de un 404.

**Tests:**
- `test_otros_endpoints.py::test_devoluciones_elegibilidad` (ajeno → 404).
- `test_otros_endpoints.py::test_devoluciones_crear_solicitud` (comportamiento
  ACTUAL: `pytest.raises(PermissionError)` — `ServerErrorMiddleware` relanza
  siempre la excepción, por eso la suite la observa como excepción y no como
  respuesta 500).

## 6. CRÍTICO — El modelo `Novedad` usa 3 columnas que ninguna migración crea: todos los endpoints de `/novedades` fallan con 500

**Dónde:** `app/models/novedad.py` declara
`cliente_visible`, `solucion_cliente` y `mensaje_cliente`; también los usan
`app/services/novedades_service.py` (`crear_novedad`,
`actualizar_mensaje_cliente`, `listar_novedades_*`,
`obtener_novedad`, `cambiar_estado_novedad`) y `app/routers/novedades.py`.

**Evidencia:** ninguna de las migraciones `0001`–`0057`
(`be/alembic/versions/`) ni `scripts/init_db.sql` crea esas tres columnas.
Verificado en el esquema real: **las 6 bases existentes** (`neodomus`,
`neodomus_test`, `neodomus_test_1/2/3`, `neodomus_test_cov`) tienen en
`novedades` exactamente las columnas de `0001 + 0052 + 0055`, sin esas tres.

**Efecto:** cualquier `INSERT` o `SELECT` sobre `novedades` (el ORM selecciona
todas las columnas mapeadas) falla con
`sqlalchemy.exc.OperationalError (1054, "Unknown column 'mensaje_cliente' in 'field list'")`
→ **HTTP 500** en el manejador genérico. Esto afecta a *todo* el módulo,
también en producción (el `Dockerfile` arranca con `alembic upgrade head`,
que no añade las columnas):

- `POST /novedades` (crear), `GET /novedades`, `GET /novedades/mis-novedades`,
  `GET /novedades/cliente/novedades`, `GET /novedades/{id}` (ni siquiera el
  404: la SELECT se ejecuta antes de comprobar que la fila exista),
  `POST /novedades/{id}/mensaje-cliente`, `PUT /novedades/{id}/estado`,
  `POST /novedades/{id}/evidencia`, `GET /novedades/{id}/evidencias`, etc.
- En `POST /novedades/{id}/evidencia` la carga de la novedad ocurre **antes**
  de validar extensión/PIL, así que las validaciones 400 del archivo son
  código inalcanzable hoy.

Sí responden bien (no tocan la tabla): los catálogos
(`/tipos`, `/estados`, `/prioridades`), los permisos 401/403 de las
dependencias `_admin`/`_tecnico`, la validación de catálogo
(`tipo_novedad`, `prioridad`, `nuevo_estado`) y
`GET /novedades/admin/filtros`.

**Tests:** `test_otros_endpoints.py::test_novedades_crear_tecnico`,
`test_novedades_listados_y_permisos` y
`test_novedades_estado_y_evidencia` (comportamiento ACTUAL:
`pytest.raises(OperationalError)` con `db.rollback()` entre llamadas).

**Corrección sugerida:** agregar una migración `0058` con
`op.add_column("novedades", ...)` para las tres columnas (y
`scripts/init_db.sql`), o quitar esos atributos del modelo si no están
pensados aún.
