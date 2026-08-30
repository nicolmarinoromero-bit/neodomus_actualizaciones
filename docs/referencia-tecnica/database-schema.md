# Esquema de Base de Datos — Neodomus

<!--
  ¿Qué? Documentación del esquema relacional de Neodomus.
  ¿Para qué? Que cualquier desarrollador entienda tablas, relaciones, índices y decisiones de diseño sin leer todos los modelos SQLAlchemy.
  ¿Impacto? Facilita onboarding, migraciones Alembic y auditorías de integridad referencial.
-->

> **Motor:** MySQL 8.0+ InnoDB (`docker-compose.yml:3` `mysql:8.0`, `RBD-001`)  
> **ORM:** SQLAlchemy 2.0+ (`be/app/models/` 29 modelos)  
> **Migraciones:** Alembic 48 versiones (`be/alembic/versions/0001_*.py` → `0047_visible_cliente_productos.py`)  
> **Charset:** `utf8mb4` (`be/app/config.py:14` `?charset=utf8mb4`)  
> **Esquema referencia:** `scripts/init_db.sql:1` (~1100 líneas, idempotente `CREATE IF NOT EXISTS` + `INSERT IGNORE`)

---

## Diagrama Entidad-Relación (resumen)

```
usuarios (empleados) ──┐
  id (PK)              │ 1:1
  email (UNIQUE, INDEX)│── tegnicos.id_usuario (FK)
  password_hash        │     certificacion, foto_url, is_active
  id_rol_u (FK→roles)  │
  is_active            │
                       │
clientes ──────────────┤
  id_cliente (PK)      │ 1:N
  email (UNIQUE)       ├─ citas.id_cliente (FK, INDEX)
  documento_cliente    ├─ pedidos.id_cliente (FK)
  is_active            ├─ calificaciones.id_cliente
  auth_provider        ├─ notificaciones.id_cliente
                       ├─ devoluciones.id_cliente
                       └─ solicitudes_cuenta.id_cliente

productos ─────────────┐
  id_producto (PK)     │ 1:N
  referencia (UNIQUE)  ├─ producto_variante.id_producto (FK, cascade delete)
  stock_producto       ├─ cita_producto.id_producto
  categoria_id (FK)    ├─ pedido_detalle.id_producto (pedido.py)
  proveedor_id (FK)    └─ calificacion_producto.id_producto
  visible_cliente (BOOL, 0047)
  venta_por_metros (BOOL)
  precio_venta_producto (Float→Numeric)
  descuento_activo, promocion_hasta, es_nuevo

citas ─────────────────┐
  id_cita (PK)         │ 1:N
  id_cliente (FK)      ├─ cita_producto (N:M productos por cita)
  id_tecnico, id_tecnico_2, id_tecnico_3 (INT, sin FK - multi-técnico)
  tipo_servicio, costo_cita (Numeric 12,2)
  estado (Pendiente/Confirmada/Finalizada/Cancelada)
  recordatorio_enviado (BOOL, scheduler)
                       ├─ ofertas_horario (gap cancelación)
                       ├─ evidencias (FK cita)
                       └─ calificaciones (1:1 por cita)

pedidos ───────────────┐
  id_pedido (PK)       │ 1:N
  fecha_peedido (sic)  ├─ pedido_detalle (id_producto, cantidad, metros, color, variante)
  id_cliente (FK)      ├─ pagos (1:N, estado: aprobado/pendiente/rechazado)
  estado_pedido/entrega├─ facturas (1:1, pdf_url, enviada_por_correo)
  id_tecnico_entrega   └─ devoluciones / reembolsos

categorias (10)        proveedores (10)      tarifas_servicio
  id_cate_pr (PK)        id_proveedor (PK)     tipo_servicio (PK), costo
  nombre_categoria       nombre, contacto      duracion_estimada_cita

especializaciones      tecnico_especializacion (N:M)
  id (PK)                id_tecnico, id_especializacion
  nombre (UNIQUE)

otros: roles_usuario (admin, tecnico), notificaciones, contacto, ubicacion_tecnico,
       password_reset_tokens, email_verification_tokens, pending_registrations
```

---

## Tablas principales (29 modelos en `be/app/models/`)

| Tabla | Modelo | PK | FK principales | Índices | Notas |
|---|---|---|---|---|---|
| `usuarios` | `user.py:6` | `id` | `id_rol_u → roles_usuario` | `email` UNIQUE | Empleados (admin/tecnico). `foto_url`, `password_reset_required` |
| `clientes` | `cliente.py:10` | `id_cliente` | — | `email` UNIQUE, `documento_cliente` UNIQUE | `is_active False` hasta `verify_client_email`, `google_id` UNIQUE nullable |
| `roles_usuario` | `roles_usuario.py:8` | `id_rol` | — | `nombre_rol` | Valores: `administrador`, `tecnico` |
| `productos` | `producto.py:5` | `id_producto` | `categoria_id`, `proveedor_id` | `referencia_producto` UNIQUE | `visible_cliente` (0047), `venta_por_metros` INT 0/1, `stock_producto` CHECK ≥0 (0037), variantes cascade |
| `producto_variante` | `producto_variante.py` | `id` | `id_producto` (FK) | — | `color`, `tamaño`, `ancho_cm`, `etiqueta_medida`, `stock` |
| `categorias` | `categoria.py` | `id_cate_pr` | — | — | 10 categorías `sensores..interfaces` (`init_db.sql:84`) |
| `proveedores` | `proveedor.py` | `id_proveedor` | — | — | 10 proveedores, reabastecimiento `productos.py:549` |
| `citas` | `cita.py:9` | `id_cita` | `id_cliente` (FK) | `id_tecnico`, `fecha`, `estado` (RBD-005) | `costo_cita Numeric(12,2)`, `nombre_tecnico` denormalizado, `recordatorio_enviado` |
| `cita_producto` | `cita_producto.py` | `id` | `id_cita`, `id_producto` | — | N:M, cantidad + metros |
| `oferta_horario` | `oferta_horario.py` | `id` | `id_cita_cancelada` | — | Gap 6h tras cancelación (`citas.py:64`) |
| `pedidos` | `pedido.py:7` | `id_pedido` | `id_cliente`, `id_tecnico_entrega` (sin FK) | `fecha_peedido` (typo) | `estado_pedido` + `estado_entrega` separados |
| `pagos` | `pago.py` | `id` | `id_pedido`, `id_cita` | `pedido_id` (RBD-005) | `estado` aprobado/pendiente/rechazado, `metodo` simulador |
| `facturas` | `factura.py` | `id` | `id_pedido`, `id_cita` | — | `numero_factura` UNIQUE, `pdf_url`, `enviada_por_correo` |
| `tarifas_servicio` | `tarifa_servicio.py` | `tipo_servicio` | — | — | `costo`, `duracion_estimada_cita` |
| `tecnicos` | `tecnico.py` | `id_tecnico` | `id_usuario` (FK 1:1) | — | `certificacion`, ficha extendida |
| `especializaciones` | `especializacion.py` | `id` | — | `nombre` UNIQUE | Catálogo + N:M con técnicos |
| `calificaciones` | `calificacion.py` | `id` | `id_cita`, `id_tecnico`, `id_cliente` | — | 1 por cita Finalizada, `puntaje` 1-5 |
| `calificacion_producto` | `calificacion_producto.py` | `id` | `id_pedido`, `id_producto` | — | Foto MinIO `calificaciones_productos` |
| `evidencias` | `evidencia.py` | `id` | `id_cita`, `id_pedido` | — | `url` MinIO `evidencias_citas` / `recogidas` |
| `notificaciones` | `notificacion.py` | `id` | `id_cliente` / `id_usuario` | — | `tipo`, `leida`, `timestamp` |
| `devoluciones` / `solicitud_devolucion` | `devolucion.py` / `solicitud_devolucion.py` | `id` | `id_pedido`, `id_cliente` | — | Pipeline 6 estados |
| `contacto` | `contacto.py` | `id` | — | — | `categoria` reclamo/sugerencia |
| `ubicacion_tecnico` | `ubicacion_tecnico.py` | `id` | `id_tecnico` | — | `latitud`, `longitud` (seguimiento) |
| `otros` | `otros.py` | — | — | — | `Comision`, `TipoDocumento` |

---

## Decisiones y Restricciones BD (RBD)

| ID | Regla | Estado real |
|---|---|---|
| **RBD-001** InnoDB | Todas InnoDB (transacciones, FK) | ✅ `init_db.sql` `ENGINE=InnoDB`, SQLAlchemy default |
| **RBD-002** Trigger 48h | Cancelación 48h via trigger | ⚠️ **No implementado**; actual **3h** en `citas.py:548` lógica app (`_validar_franja_cita:492`). Trigger opcional futuro. |
| **RBD-003** Vistas | Reportes via vistas | ⚠️ **No implementado**; actual SQLAlchemy en `reports.py:43-1143`. Vistas recomendadas. |
| **RBD-004** ENUMs | `cita.estado`, `pedido.estado`, `roles` como ENUM | 🟡 Parcial: `cita.estado` String capitalizado (`Pendiente/Confirmada/Finalizada/Cancelada` `cita.py:61`), no ENUM MySQL; `roles_usuario.nombre_rol` VARCHAR. |
| **RBD-005** Índices | `usuarios.email`, `numero_documento`, `citas.usuario/tecnico/fecha/estado`, `pagos.pedido_id` | ✅ Parcial: `email` UNIQUE (implícito índice), `citas.id_tecnico` sin FK pero indexado en queries `citas.py:452`; `alembic` crea índices según modelo. |

---

## Almacenamiento de Archivos

| Tipo | Backend | Ruta / Bucket | Validación |
|---|---|---|---|
| Imágenes producto | **MinIO** (`minio:9000`, `MINIO_BUCKET=neodomus-media` `config.py:63`) | `productos/{uuid}.jpg` (`productos.py:794` `subir_imagen`) | `ext {.jpg,.png,.webp,.gif}`, `≤5MB`, `PIL verify` (`productos.py:779`) |
| Evidencias cita | MinIO | `evidencias_citas/{uuid}.jpg` (`tecnicos.py:1111`) | 5MB, `PIL verify` |
| Evidencias entrega | MinIO | `evidencias_entrega/{uuid}.jpg` (`tecnicos.py:1032`) | 5MB |
| Recogidas devolución | MinIO | `recogidas/{uuid}.jpg` (`devoluciones.py:666`) | 5MB |
| Calificación producto | MinIO | `calificaciones_productos/{uuid}.jpg` (`calificaciones.py:424`) | `.jpg/.jpeg/.png/.webp` 5MB |
| Facturas PDF | Stream `reportlab` | `GET /pedidos/{id}/factura` (`pedidos.py:740`) + correo | `generar_factura_pdf` (`factura_service`) |
| Fallback disco | `StaticFiles` | `/uploads` y `/evidencias` (`main.py:72-79`) → migrar a presigned MinIO | Público (riesgo BUG-003) |

---

## Migraciones Alembic

- **Ubicación:** `be/alembic/versions/` 48 archivos `0001_baseline_esquema_inicial.py` → `0047_visible_cliente_productos.py`
- **Ejecución:** `docker-compose.yml:71` `uv run alembic upgrade head` cada arranque `api`
- **Últimas:** `0037_stock_no_negativo` CHECK, `0030_vincular_productos_especializaciones`, `0040_ofertas_horario`, `0019_google_auth_clientes`, `0047_visible_cliente`
- **Comando manual:** `docker exec -it neodomus_api uv run alembic upgrade head`

---

## Integridad y Buenas Prácticas

- **Transacciones:** `pedidos_service` `descontar_stock` con `FOR UPDATE` (`inventario_service.py:64`); `crear_pedido` debe ser atómico (mejora pendiente BUG-014).
- **Charset:** `utf8mb4` para emojis y tildes.
- **Soft vs Hard delete:** `productos` soft `inactivo` si tiene historial (`productos.py:983`), `citas` soft salvo `citas.py:1109` hard (pendiente BUG-012).
- **Denormalización:** `citas.nombre_tecnico` para reportes sin JOIN.
- **Pool:** `database.py:7` `pool_pre_ping=True, pool_recycle=3600`.

> **Ver también:** `docs/referencia-tecnica/architecture.md` (capas), `scripts/init_db.sql` (datos semilla 10 proveedores/categorías/16 productos).
