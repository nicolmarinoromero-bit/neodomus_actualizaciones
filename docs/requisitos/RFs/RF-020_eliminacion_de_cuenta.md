# RF-020 — Eliminación de cuenta

<!--
  ¿Qué? El usuario puede eliminar su cuenta voluntariamente.
  ¿Para qué? Tener control sobre sus datos personales.
  ¿Impacto? Cumplimiento de RGPD y confianza.
-->

## Identificación

| Campo         | Valor                          |
| ------------- | ------------------------------ |
| **ID**        | RF-020                         |
| **Nombre**    | Eliminación de cuenta          |
| **Módulo**    | Perfil de usuario              |
| **Prioridad** | Media                          |
| **Estado**    | Propuesta                      |
| **Fecha**     | Mayo 2026                      |

> **Actualización 2026-08:** Eliminación vía `POST /clients/me/cuenta-solicitud` `SolicitudCuenta` `inhabilitar/habilitar` `clientes.py:91` pendiente admin `clientes.py:101,149`, no soft delete inmediato 30 días. Empleado `DELETE /users/{id}` soft `is_active=False` `users.py:371` + `desactivar_tecnico_proceso` `users.py:367`.

## Descripción

El sistema debe permitir al usuario eliminar su cuenta de forma voluntaria, siguiendo un proceso de confirmación y aplicando una eliminación blanda (soft delete) que permita la recuperación durante un período de gracia (30 días).

## Entradas

| Campo         | Tipo    | Obligatorio | Validaciones               |
| ------------- | ------- | ----------- | -------------------------- |
| `confirmacion`| boolean | Sí          | Debe ser `true`             |
| `password`    | string  | Sí          | Contraseña actual correcta |

# RF-020 — Eliminación de cuenta

<!--
  ¿Qué? El usuario puede eliminar su cuenta voluntariamente.
  ¿Para qué? Tener control sobre sus datos personales.
  ¿Impacto? Cumplimiento de RGPD y confianza.
-->

## Identificación

| Campo         | Valor                          |
| ------------- | ------------------------------ |
| **ID**        | RF-020                         |
| **Nombre**    | Eliminación de cuenta          |
| **Módulo**    | Perfil de usuario              |
| **Prioridad** | Media                          |
| **Estado**    | Propuesta                      |
| **Fecha**     | Mayo 2026                      |

> **Actualización 2026-08:** Eliminación vía `POST /clients/me/cuenta-solicitud` `SolicitudCuenta` `inhabilitar/habilitar` `clientes.py:91` pendiente admin `clientes.py:101,149`, no soft delete inmediato 30 días. Empleado `DELETE /users/{id}` soft `is_active=False` `users.py:371` + `desactivar_tecnico_proceso` `users.py:367`.

## Descripción

El sistema debe permitir al usuario eliminar su cuenta de forma voluntaria, siguiendo un proceso de confirmación y aplicando una eliminación blanda (soft delete) que permita la recuperación durante un período de gracia (30 días).

## Entradas

| Campo         | Tipo    | Obligatorio | Validaciones               |
| ------------- | ------- | ----------- | -------------------------- |
| `confirmacion`| boolean | Sí          | Debe ser `true`             |
| `password`    | string  | Sí          | Contraseña actual correcta |

## Proceso

1. Usuario accede a `/perfil` y hace clic en "Eliminar mi cuenta".
2. Se muestra una advertencia con consecuencias.
3. Usuario ingresa su contraseña para confirmar.
4. Backend verifica la contraseña.
5. Marca `is_active = false` y `deleted_at = now()` en la tabla `usuarios`.
6. Las citas pendientes o futuras se cancelan automáticamente.
7. Se envía un correo de confirmación con instrucciones para restaurar la cuenta dentro de 30 días.

## Salidas

| Escenario                     | Código HTTP | Respuesta |
| ----------------------------- | ----------- | --------- |
| Eliminación exitosa           | 200         | `"Tu cuenta ha sido marcada para eliminación. Tienes 30 días para cancelar."` |
| Contraseña incorrecta         | 400         | `"Contraseña incorrecta"` |

## Endpoints asociados

| Método | Ruta                    | Auth | Descripción                     |
| ------ | ----------------------- | ---- | ------------------------------- |
| DELETE | `/api/v1/users/me`      | Sí   | Marca la cuenta para eliminación |

## Reglas de negocio

- **RN-047:** Pasados los 30 días, un proceso batch elimina físicamente los datos (o los anonimiza).
- **RN-048:** El usuario puede cancelar la eliminación contactando a soporte dentro de los 30 días.
- **RN-049:** El técnico no puede eliminar su cuenta si tiene citas asignadas en el futuro.

1. Usuario accede a `/perfil` y hace clic en "Eliminar mi cuenta".
2. Se muestra una advertencia con consecuencias.
3. Usuario ingresa su contraseña para confirmar.
4. Backend verifica la contraseña.
5. Marca `is_active = false` y `deleted_at = now()` en la tabla `usuarios`.
6. Las citas pendientes o futuras se cancelan automáticamente.
7. Se envía un correo de confirmación con instrucciones para restaurar la cuenta dentro de 30 días.

## Salidas

| Escenario                     | Código HTTP | Respuesta |
| ----------------------------- | ----------- | --------- |
| Eliminación exitosa           | 200         | `"Tu cuenta ha sido marcada para eliminación. Tienes 30 días para cancelar."` |
| Contraseña incorrecta         | 400         | `"Contraseña incorrecta"` |

## Endpoints asociados

| Método | Ruta                    | Auth | Descripción                     |
| ------ | ----------------------- | ---- | ------------------------------- |
| DELETE | `/api/v1/users/me`      | Sí   | Marca la cuenta para eliminación |

## Reglas de negocio

- **RN-047:** Pasados los 30 días, un proceso batch elimina físicamente los datos (o los anonimiza).
- **RN-048:** El usuario puede cancelar la eliminación contactando a soporte dentro de los 30 días.
- **RN-049:** El técnico no puede eliminar su cuenta si tiene citas asignadas en el futuro.