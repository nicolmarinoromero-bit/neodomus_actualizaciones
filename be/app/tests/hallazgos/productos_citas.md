# Hallazgos — tests de `productos` y `citas`

Auditoría de los routers `be/app/routers/productos.py` y
`be/app/routers/citas.py` mediante los archivos
`be/app/tests/test_productos.py` (75 tests) y
`be/app/tests/test_citas.py` (80 tests).

Comando de ejecución (desde la raíz del repo, BD de pruebas propia):

```bash
docker compose exec -e TEST_DATABASE_URL="mysql+pymysql://neodomus:neodomus123@db:3306/neodomus_test_2?charset=utf8mb4" \
  api uv run pytest app/tests/test_productos.py app/tests/test_citas.py -q --no-cov
```

Resultado: **155 passed** (75 + 80). No se modificó código de producción ni
`conftest.py`, `factories.py`, `pytest.ini`, compose ni `.env`.

---

## 1. BUG: `POST /productos/proveedores/{id}/solicitar-reabastecimiento` siempre falla (500)

- **Archivo:** `be/app/routers/productos.py`, líneas 598–620.
- **Síntoma:** con al menos un ítem válido (`items` no vacío y proveedor con
  correo), la petición termina en `TypeError` y el servidor responde 500.
- **Causa:** la plantilla de la fila HTML usa **6 marcadores `%s`** pero se
  le pasan **7 argumentos**:

  ```python
  "<tr style='background:%s'>%s%s%s%s%s</tr>" % (fondo, celda1, celda2, celda3, celda4, celda5, celda6)
  ```

  → `TypeError: not all arguments converted during string formatting`.
- **Impacto:** la solicitud de reabastecimiento a proveedores **no puede
  completarse nunca** con productos seleccionados; solo se alcanzan los
  caminos de error (404 proveedor, 400 sin correo, 400 sin ítems, 401 sin
  token), que sí funcionan.
- **Cobertura:** `test_reabastecimiento_responde_500_por_error_de_formato`
  documenta el comportamiento ACTUAL con `pytest.raises(TypeError)` (la
  excepción se propaga en el cliente de pruebas ASGI en lugar de convertirse
  en respuesta 500).

## 2. Los productos con `id <= 10` no se pueden eliminar (`eliminado: false`)

- **Archivo:** `be/app/routers/productos.py`, líneas 986–997 (`eliminar_producto`).
- **Causa:** la migración base `be/alembic/versions/0001_baseline_esquema_inicial.py`
  crea las tablas `bodega_et` (línea 524) e `inventario_f` y las siembra con
  filas que referencian `productos.id_producto` **1..10** (líneas 538–540 y
  486–488). Esas dos tablas **no tienen modelo SQLAlchemy**, por lo que no
  entran en `TODAS_LAS_TABLAS` (`conftest.py:55`) y el `TRUNCATE` entre tests
  (`conftest.py:139`) **no las limpia**: sus filas quedan como "huérfanas"
  cada vez que se vacía `productos`.
- **Comportamiento actual:** `DELETE /productos/{id}` con un producto que
  tiene filas referenciadas lanza `IntegrityError` → 200 con
  `{"eliminado": false, "msg": "...(tiene historial asociado)"}` y deja el
  producto en `estado_producto = "inactivo"` (borrado lógico, no físico).
- **Cobertura:** `test_eliminar_producto_exito` (crea productos de relleno
  hasta salir del rango 1..10 y verifica el borrado físico) y
  `test_eliminar_producto_con_historial_lo_desactiva` (verifica el borrado
  lógico con `eliminado: false`).
- **Nota de mantenimiento:** durante la depuración se eliminaron por error
  las filas de seed con `id_producto_* = 1` de `bodega_et` e `inventario_f`;
  se **restauraron** con los valores exactos de la migración 0001
  (`bodega_et (1,1,10)`, `inventario_f (1,1,50)`) para dejar la BD de pruebas
  idéntica a una instalación recién migrada.

## 3. `POST /citas`: la rama "el técnico no está disponible" es casi inalcanzable

- **Archivo:** `be/app/routers/citas.py`.
- **Orden de validaciones en `crear_cita`:**
  1. fecha/hora de anticipación (líneas 581–590),
  2. `_validar_franja_cita` (línea 592),
  3. **`slot_tomado`** → *"Esa fecha y hora ya fue reservada por otro
     cliente"* (líneas 595–599),
  4. tarifa y método de pago (600–611),
  5. **`_validar_tecnico_cita` → `tecnico_ocupado`** → *"El técnico
     seleccionado no está disponible en esa fecha y hora"* (líneas 616 y 480–484).
- **Problema:** `slot_tomado` considera **cualquier** cita activa de la
  fecha (`especialidades.py:244-274`), mientras `tecnico_ocupado` solo mira
  las citas del técnico (`especialidades.py:327`). Si el técnico elegido ya
  tiene una cita que se cruza, esa misma cita también dispara `slot_tomado`
  **primero**, así que el usuario siempre ve el mensaje de "franja ya
  reservada" y el mensaje específico del técnico jamás aparece por culpa de
  una cita.
- **Único camino real:** el bloqueo venga de una **entrega**
  (`Pedido.estado_entrega` ∈ `Asignada` / `Recogido` / `En camino`,
  `especialidades.py:24,366-377`), que `slot_tomado` no considera.
- **Cobertura:** `test_crear_cita_tecnico_ocupado_400` reproduce el único
  camino alcanzable (entrega asignada al técnico en la franja) y deja
  documentada la limitación.

## 4. Credencial de tipo equivocado responde 401 (no 403)

- Token de **cliente** en endpoints de empleado y viceversa → **401**,
  porque `get_current_employee` / `get_current_client` validan el tipo de
  cuenta y no el rol (`be/app/utils/security.py:182`).
- Token de empleado **no administrador** en endpoints `_admin` → **403**.
- Ejemplos cubiertos:
  - `test_listar_citas_admin_cliente_401` (cliente en `/citas/all-admin`),
  - `test_crear_cita_con_token_de_empleado_401`,
  - `test_mis_citas_con_token_de_empleado_401`,
  - `test_editar_cita_con_token_de_empleado_401`,
  - `test_listar_citas_admin_tecnico_403`, `test_admin_actualizar_cita_tecnico_403`,
    `test_reasignar_cita_tecnico_403`.

## 5. Editar/cancelar una cita de OTRO cliente responde 404 (no 403)

- `_get_own_cita` (`be/app/routers/citas.py:560-568`) busca la cita filtrando
  por `id_cliente` y responde 404 si no pertenece al usuario autenticado: la
  API no revela la existencia de recursos ajenos.
- Cobertura: `test_editar_cita_de_otro_cliente_404` y
  `test_cancelar_cita_de_otro_cliente_404`.

## 6. `PUT /citas/admin/{id}` con `estado: "Cancelada"` **borra** la fila de la cita

- `be/app/routers/citas.py:1125-1156`: al pasar a `Cancelada` (desde un
  estado previo distinto) se ejecuta `DELETE FROM citas WHERE id_cita = :id`.
  Antes se desvinculan calificaciones, facturas y comisión; el reembolso y
  el historial se preservan y se generan ofertas del hueco liberado.
- **Consecuencia:** la cita desaparece de `GET /citas/all-admin` y de
  `mis-citas` en lugar de mostrarse como cancelada (a diferencia de
  `PUT /citas/{id}` y `DELETE /citas/{id}` como cliente, que solo cambian el
  estado).
- **Efecto en los tests:** la instancia ORM queda borrada en BD; hay que
  capturar `id_cita` **antes** de la petición para no leer un objeto ya
  eliminado (`ObjectDeletedError`).
- Cobertura: `test_admin_cancelar_cita_elimina_el_registro`.

## 7. `GET /citas/horas-disponibles` devuelve `[]` si no hay técnicos activos

- `be/app/routers/citas.py:778-781`: sin `tecnico_id` la franja es
  agendable si `any(...)` sobre `tecnicos_activos`; con la lista vacía,
  `any([])` es `False`, así que el endpoint responde `[]` sin distinguir
  "no hay disponibilidad" de "no hay técnicos configurados".
- Cobertura: `test_horas_disponibles_sin_tecnicos_activos_vacio`.

---

## Notas de infraestructura de tests (sin modificar `conftest.py` ni `factories.py`)

1. **Colisión de email UNIQUE por factories con kwargs vacías.**
   `crear_cliente` / `crear_empleado` / `crear_producto` derivan el email del
   hash de sus kwargs (`factories.py:25,61,114`); con kwargs vacías el hash
   es constante dentro de una corrida, por lo que:
   - `crear_cliente(db)` sin kwargs choca con el cliente del fixture
     `cliente_logueado`;
   - `crear_empleado(db, rol="administrador")` (fixture `admin_logueado`) y
     `crear_empleado(db, rol="tecnico")` (fixture `tecnico_logueado`) chocoan
     entre sí: **los dos fixtures no pueden usarse en el mismo test**.
   - *Solución local* (mismo criterio que `_otro_cliente` de
     `test_pedidos.py`): helpers `_cliente_unico` y `_tecnico_unico` en
     `test_citas.py`, que pasan email/documento únicos.
2. **Endpoints que borran con SQL crudo.** Cuando un endpoint ejecuta
   `DELETE` directo (p. ej. cancelación admin de la cita), la instancia ORM
   asociada queda invalidada; guardar los ids antes de la petición.
3. **Franjas reales** usadas por los tests: `08:00`, `11:00`, `14:00`,
   `17:00`; solo lunes a sábado; anticipación mínima de 3 horas; tarifa
   obligatoria en `tarifas_servicio.tipo_servicio` (minúsculas); métodos de
   pago aceptados: `tarjeta_debito`, `tarjeta_credito`, `pse`, `paypal`,
   `punto_pago` (→ `estado_pago = "pendiente"`), `paypal` → `"aprobado"`.
