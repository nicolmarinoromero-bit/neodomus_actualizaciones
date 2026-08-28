# RF-032 — Reactivación de usuarios o técnicos suspendidos

<!--
  ¿Qué? El administrador puede reactivar cuentas previamente suspendidas.
  ¿Para qué? Permitir el regreso al sistema tras corregir fallas.
  ¿Impacto? Flexibilidad en la gestión de cuentas.
-->

## Identificación

| Campo         | Valor                                        |
| ------------- | -------------------------------------------- |
| **ID**        | RF-032                                       |
| **Nombre**    | Reactivación de usuarios o técnicos suspendidos |
| **Módulo**    | Administrador                                |
| **Prioridad** | Alta                                         |
| **Estado**    | Propuesta                                    |
| **Fecha**     | Mayo 2026                                    |

## Descripción

El sistema debe permitir al administrador reactivar usuarios o técnicos suspendidos (aquellos con `is_active = false` pero no eliminados), restaurando su acceso a la plataforma.

## Entradas

| Parámetro | Tipo | Obligatorio | Descripción                 |
| --------- | ---- | ----------- | --------------------------- |
| `id`      | int  | Sí          | ID del usuario/técnico      |

## Proceso

1. El administrador accede a una lista de cuentas inactivas (filtro `is_active=false`).
2. Hace clic en "Reactivar".
3. El backend cambia `is_active = true` y elimina `deleted_at` (si existe).
4. Se envía un correo al usuario/técnico notificando que su cuenta ha sido reactivada.
5. Se registra la acción en `audit_log`.

## Salidas

| Escenario                     | Código HTTP | Respuesta                         |
| ----------------------------- | ----------- | --------------------------------- |
| Reactivación exitosa          | 200         | `"Cuenta reactivada correctamente"` |
| Cuenta ya activa              | 400         | `"La cuenta ya está activa"`        |

## Endpoints asociados

| Método | Ruta                                 | Auth  | Descripción                           |
| ------ | ------------------------------------ | ----- | ------------------------------------- |
| PUT    | `/api/v1/admin/usuarios/{id}/reactivar` | Sí (admin) | Reactiva un usuario suspendido        |
| PUT    | `/api/v1/admin/tecnicos/{id}/reactivar` | Sí (admin) | Reactiva un técnico suspendido        |

## Reglas de negocio

- **RN-075:** La reactivación solo es posible si la cuenta no fue eliminada físicamente (solo suspendida).
- **RN-076:** La reactivación restaura el acceso sin necesidad de cambiar la contraseña.