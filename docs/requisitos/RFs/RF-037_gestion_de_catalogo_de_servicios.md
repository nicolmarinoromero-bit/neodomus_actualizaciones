
---

## RF-037_gestion_de_catalogo_de_servicios.md

```markdown
# RF-037 — Gestión del catálogo de servicios

<!--
  ¿Qué? El administrador puede crear, editar o eliminar servicios del catálogo.
  ¿Para qué? Mantener actualizada la oferta del sistema.
  ¿Impacto? Permite lanzar nuevos servicios o retirar los obsoletos.
-->

## Identificación

| Campo         | Valor                                      |
| ------------- | ------------------------------------------ |
| **ID**        | RF-037                                     |
| **Nombre**    | Gestión del catálogo de servicios          |
| **Módulo**    | Administrador                              |
| **Prioridad** | Alta                                       |
| **Estado**    | Propuesta                                  |
| **Fecha**     | Mayo 2026                                  |

> **Actualización 2026-08:** Catálogo es **productos** `POST /productos` `productos.py:798`, `PUT /productos/{id}` `854`, `DELETE` soft `969`. Campos: `nombre/marca/venta_por_metros/referencia/precio_compra/venta/categoria/proveedor/descripcion/colores/stock/descuento/promocion/es_nuevo/tecnicos_requeridos/dificultad/tiempo/especializaciones` `productos.py:102`. Proveedores `POST /productos/proveedores` `488`, reabastecimiento `549`.

## Descripción

El sistema debe permitir al administrador crear, editar o eliminar servicios del catálogo de servicios. La eliminación solo debe ser posible si el servicio no tiene citas asociadas.

## Entradas

Para creación/edición:

| Campo              | Tipo    | Obligatorio | Validaciones                              |
| ------------------ | ------- | ----------- | ----------------------------------------- |
| `nombre`           | string  | Sí          | Mínimo 3 caracteres, máximo 100           |
| `descripcion`      | string  | Sí          | Mínimo 10 caracteres                      |
| `descripcion_larga`| string  | No          | -                                         |
| `precio_base`      | decimal | Sí          | > 0                                       |
| `duracion_estimada`| int     | Sí          | > 0 (minutos)                             |
| `categoria`        | string  | Sí          | `instalacion`, `mantenimiento`, `automatizacion`, `asesoria` |
| `imagen_url`       | string  | No          | URL válida (opcional)                     |
| `is_active`        | boolean | Sí          | Para ocultar sin eliminar                 |


---

## RF-037_gestion_de_catalogo_de_servicios.md

```markdown
# RF-037 — Gestión del catálogo de servicios

<!--
  ¿Qué? El administrador puede crear, editar o eliminar servicios del catálogo.
  ¿Para qué? Mantener actualizada la oferta del sistema.
  ¿Impacto? Permite lanzar nuevos servicios o retirar los obsoletos.
-->

## Identificación

| Campo         | Valor                                      |
| ------------- | ------------------------------------------ |
| **ID**        | RF-037                                     |
| **Nombre**    | Gestión del catálogo de servicios          |
| **Módulo**    | Administrador                              |
| **Prioridad** | Alta                                       |
| **Estado**    | Propuesta                                  |
| **Fecha**     | Mayo 2026                                  |

> **Actualización 2026-08:** Catálogo es **productos** `POST /productos` `productos.py:798`, `PUT /productos/{id}` `854`, `DELETE` soft `969`. Campos: `nombre/marca/venta_por_metros/referencia/precio_compra/venta/categoria/proveedor/descripcion/colores/stock/descuento/promocion/es_nuevo/tecnicos_requeridos/dificultad/tiempo/especializaciones` `productos.py:102`. Proveedores `POST /productos/proveedores` `488`, reabastecimiento `549`.

## Descripción

El sistema debe permitir al administrador crear, editar o eliminar servicios del catálogo de servicios. La eliminación solo debe ser posible si el servicio no tiene citas asociadas.

## Entradas

Para creación/edición:

| Campo              | Tipo    | Obligatorio | Validaciones                              |
| ------------------ | ------- | ----------- | ----------------------------------------- |
| `nombre`           | string  | Sí          | Mínimo 3 caracteres, máximo 100           |
| `descripcion`      | string  | Sí          | Mínimo 10 caracteres                      |
| `descripcion_larga`| string  | No          | -                                         |
| `precio_base`      | decimal | Sí          | > 0                                       |
| `duracion_estimada`| int     | Sí          | > 0 (minutos)                             |
| `categoria`        | string  | Sí          | `instalacion`, `mantenimiento`, `automatizacion`, `asesoria` |
| `imagen_url`       | string  | No          | URL válida (opcional)                     |
| `is_active`        | boolean | Sí          | Para ocultar sin eliminar                 |

## Proceso

1. El administrador accede a `/admin/servicios/catalogo`.
2. Puede ver la lista de servicios existentes.
3. Para crear: hace clic en "Nuevo servicio", completa el formulario y guarda.
4. Para editar: hace clic en "Editar" de un servicio, modifica y guarda.
5. Para eliminar: hace clic en "Eliminar", el sistema verifica que no haya citas asociadas.
6. Si hay citas, no permite eliminar (solo puede desactivar con `is_active = false`).

## Salidas

| Escenario                     | Código HTTP | Respuesta                          |
| ----------------------------- | ----------- | ---------------------------------- |
| Creación exitosa              | 201         | Datos del nuevo servicio           |
| Edición exitosa               | 200         | `"Servicio actualizado"`           |
| Eliminación exitosa           | 204         | Sin contenido                      |
| Servicio con citas asociadas  | 400         | `"No se puede eliminar: tiene citas asociadas"` |

## Endpoints asociados

| Método | Ruta                          | Auth  | Descripción                       |
| ------ | ----------------------------- | ----- | --------------------------------- |
| POST   | `/api/v1/admin/servicios`     | Sí (admin) | Crea un nuevo servicio          |
| PUT    | `/api/v1/admin/servicios/{id}`| Sí (admin) | Actualiza un servicio existente |
| DELETE | `/api/v1/admin/servicios/{id}`| Sí (admin) | Elimina un servicio (si es posible) |

## Reglas de negocio

- **RN-085:** La eliminación física solo se permite si el servicio no ha sido solicitado nunca.
- **RN-086:** Si tiene citas pasadas o futuras, solo se puede desactivar (`is_active = false`), no eliminar.

1. El administrador accede a `/admin/servicios/catalogo`.
2. Puede ver la lista de servicios existentes.
3. Para crear: hace clic en "Nuevo servicio", completa el formulario y guarda.
4. Para editar: hace clic en "Editar" de un servicio, modifica y guarda.
5. Para eliminar: hace clic en "Eliminar", el sistema verifica que no haya citas asociadas.
6. Si hay citas, no permite eliminar (solo puede desactivar con `is_active = false`).

## Salidas

| Escenario                     | Código HTTP | Respuesta                          |
| ----------------------------- | ----------- | ---------------------------------- |
| Creación exitosa              | 201         | Datos del nuevo servicio           |
| Edición exitosa               | 200         | `"Servicio actualizado"`           |
| Eliminación exitosa           | 204         | Sin contenido                      |
| Servicio con citas asociadas  | 400         | `"No se puede eliminar: tiene citas asociadas"` |

## Endpoints asociados

| Método | Ruta                          | Auth  | Descripción                       |
| ------ | ----------------------------- | ----- | --------------------------------- |
| POST   | `/api/v1/admin/servicios`     | Sí (admin) | Crea un nuevo servicio          |
| PUT    | `/api/v1/admin/servicios/{id}`| Sí (admin) | Actualiza un servicio existente |
| DELETE | `/api/v1/admin/servicios/{id}`| Sí (admin) | Elimina un servicio (si es posible) |

## Reglas de negocio

- **RN-085:** La eliminación física solo se permite si el servicio no ha sido solicitado nunca.
- **RN-086:** Si tiene citas pasadas o futuras, solo se puede desactivar (`is_active = false`), no eliminar.