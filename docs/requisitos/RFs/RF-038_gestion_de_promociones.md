# RF-038 — Gestión de promociones o descuentos especiales

<!--
  ¿Qué? El administrador puede crear promociones y descuentos.
  ¿Para qué? Atraer más usuarios y fidelizar clientes.
  ¿Impacto? Permite campañas de marketing y aumentos de ventas.
-->

## Identificación

| Campo         | Valor                                      |
| ------------- | ------------------------------------------ |
| **ID**        | RF-038                                     |
| **Nombre**    | Gestión de promociones o descuentos especiales |
| **Módulo**    | Administrador                              |
| **Prioridad** | Media                                      |
| **Estado**    | Propuesta                                  |
| **Fecha**     | Mayo 2026                                  |

## Descripción

El sistema debe permitir al administrador crear, editar y eliminar promociones o descuentos especiales, aplicables a servicios específicos, a categorías enteras, o a todo el catálogo.

## Entradas

| Campo            | Tipo    | Obligatorio | Validaciones                         |
| ---------------- | ------- | ----------- | ------------------------------------ |
| `nombre`         | string  | Sí          | Mínimo 3 caracteres                  |
| `tipo`           | string  | Sí          | `porcentaje` o `monto_fijo`          |
| `valor`          | decimal | Sí          | > 0                                  |
| `aplicable_a`    | string  | Sí          | `servicio`, `categoria`, `todo`      |
| `referencia_id`  | int     | Condicional | Si `aplicable_a = servicio` → ID del servicio; si `categoria` → nombre de categoría |
| `fecha_inicio`   | date    | Sí          | Debe ser ≤ `fecha_fin`               |
| `fecha_fin`      | date    | Sí          | Debe ser ≥ `fecha_inicio`            |

## Proceso

1. El administrador accede a `/admin/promociones`.
2. Lista las promociones activas y pasadas.
3. Crea una nueva promoción, especificando tipo, valor, alcance y vigencia.
4. Al guardar, el sistema valida que no haya superposición con otra promoción activa para el mismo servicio/categoría.
5. Las promociones se aplican automáticamente al calcular precios en el catálogo y en el checkout.

## Salidas

| Escenario                     | Código HTTP | Respuesta                          |
| ----------------------------- | ----------- | ---------------------------------- |
| Promoción creada              | 201         | Datos de la promoción              |
| Superposición de fechas       | 400         | `"Ya existe una promoción activa para este servicio/categoría en ese período"` |

## Endpoints asociados

| Método | Ruta                           | Auth  | Descripción                       |
| ------ | ------------------------------ | ----- | --------------------------------- |
| POST   | `/api/v1/admin/promociones`    | Sí (admin) | Crea una nueva promoción        |
| PUT    | `/api/v1/admin/promociones/{id}`| Sí (admin) | Actualiza una promoción         |
| DELETE | `/api/v1/admin/promociones/{id}`| Sí (admin) | Elimina una promoción           |

## Reglas de negocio

- **RN-087:** Dos promociones activas no pueden solaparse en el mismo servicio/categoría.
- **RN-088:** El descuento porcentual no puede superar el 90% (para evitar abusos).
- **RN-089:** Las promociones expiradas automáticamente dejan de aplicarse.