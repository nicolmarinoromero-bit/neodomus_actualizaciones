# RF-003 — Cierre de sesión

<!--
  ¿Qué? Finalización segura de la sesión activa.
  ¿Para qué? Proteger los datos del usuario en dispositivos compartidos.
  ¿Impacto? Previene accesos no autorizados posteriores al cierre.
-->

## Identificación

| Campo         | Valor                    |
| ------------- | ------------------------ |
| **ID**        | RF-003                   |
| **Nombre**    | Cierre de sesión         |
| **Módulo**    | Autenticación            |
| **Prioridad** | Alta                     |
| **Estado**    | Propuesta                |
| **Fecha**     | Mayo 2026                |

## Descripción

El sistema debe permitir a cualquier usuario autenticado cerrar su sesión de forma segura, invalidando su refresh token en el servidor y eliminando los tokens del cliente.

## Entradas

| Campo          | Tipo   | Obligatorio | Descripción                    |
| -------------- | ------ | ----------- | ------------------------------ |
| `refresh_token`| Texto  | Sí          | Token de renovación a invalidar |

## Proceso

1. El usuario hace clic en "Cerrar sesión" en la interfaz.
2. El frontend envía `POST /api/v1/auth/logout` con el `refresh_token`.
3. El backend marca el token como `used = true` (o lo elimina de la BD).
4. El frontend elimina `access_token` y `refresh_token` del almacenamiento local.
5. El usuario es redirigido a la página de login.

## Salidas

| Escenario           | Código HTTP | Respuesta                              |
| ------------------- | ----------- | -------------------------------------- |
| Cierre exitoso      | 200         | `"Sesión cerrada exitosamente"`        |
| Token inválido      | 401         | `"Token inválido o ya usado"`          |

## Endpoints asociados

| Método | Ruta                   | Auth | Descripción                     |
| ------ | ---------------------- | ---- | ------------------------------- |
| POST   | `/api/v1/auth/logout`  | No*  | Invalida el refresh token dado  |

## Reglas de negocio

- **RN-008:** El endpoint de logout no requiere el `access_token`, solo el `refresh_token`, para poder cerrar sesión incluso si el access token expiró.
- **RN-009:** El `refresh_token` invalidado no puede usarse nuevamente para renovar.