# RF-031 — Eliminación definitiva de usuarios o técnicos

<!--
  ¿Qué? El administrador puede eliminar usuarios o técnicos inactivos o con faltas graves.
  ¿Para qué? Mantener la integridad de la base de datos y cumplir con normativas.
  ¿Impacto? Permite depurar cuentas no deseadas.
-->

## Identificación

| Campo         | Valor                                          |
| ------------- | ---------------------------------------------- |
| **ID**        | RF-031                                         |
| **Nombre**    | Eliminación definitiva de usuarios o técnicos |
| **Módulo**    | Administrador                                  |
| **Prioridad** | Alta                                           |
| **Estado**    | Propuesta                                      |
| **Fecha**     | Mayo 2026                                      |

## Descripción

El sistema debe permitir al administrador eliminar definitivamente usuarios o técnicos inactivos o con faltas graves, borrando físicamente sus registros de la base de datos (o anonimizándolos según la política de datos).

## Entradas

| Parámetro | Tipo   | Obligatorio | Descripción                 |
| --------- | ------ | ----------- | --------------------------- |
| `id`      | int    | Sí          | ID del usuario/técnico      |
| `confirmacion` | boolean | Sí      | Debe ser `true`              |

## Proceso

1. El administrador accede a `/admin/usuarios` o `/admin/tecnicos`.
2. Hace clic en "Eliminar" en una cuenta.
3. Se muestra un diálogo de confirmación con advertencia de que la acción es irreversible.
4. El administrador confirma.
5. El backend verifica que la cuenta no tenga citas pendientes o futuras.
6. Si está todo en orden, procede a:
   - Eliminar físicamente el registro de la tabla `usuarios` (o marcar como `deleted_at` y anonimizar).
   - Eliminar registros relacionados (citas, pagos, etc.) según las reglas de negocio.
7. Se registra la acción en `audit_log`.

## Salidas

| Escenario                     | Código HTTP | Respuesta                         |
| ----------------------------- | ----------- | --------------------------------- |
| Eliminación exitosa           | 200         | `"Cuenta eliminada definitivamente"` |
| Cuenta con citas pendientes   | 400         | `"No se puede eliminar: tiene citas pendientes. Cancélelas primero."` |

## Endpoints asociados

| Método | Ruta                              | Auth  | Descripción                           |
| ------ | --------------------------------- | ----- | ------------------------------------- |
| DELETE | `/api/v1/admin/usuarios/{id}`     | Sí (admin) | Elimina permanentemente a un usuario  |
| DELETE | `/api/v1/admin/tecnicos/{id}`     | Sí (admin) | Elimina permanentemente a un técnico  |

## Reglas de negocio

- **RN-072:** Antes de eliminar, se debe verificar que el usuario/técnico no tenga citas en estado `pendiente` o `confirmada`.
- **RN-073:** La eliminación es física (borrado de la BD) o anonimizada según la normativa de protección de datos.
- **RN-074:** Se debe registrar el motivo en `audit_log` (aunque no se pida en el formulario, se puede añadir un campo opcional).