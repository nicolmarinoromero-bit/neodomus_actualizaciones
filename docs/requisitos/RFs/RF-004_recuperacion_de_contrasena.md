# RF-004 — Recuperación de contraseña

<!--
  ¿Qué? Permite a un usuario restablecer su contraseña olvidada.
  ¿Para qué? Recuperar acceso a la cuenta sin soporte manual.
  ¿Impacto? Reduce la carga de soporte y mejora la experiencia.
-->

## Identificación

| Campo         | Valor                          |
| ------------- | ------------------------------ |
| **ID**        | RF-004                         |
| **Nombre**    | Recuperación de contraseña     |
| **Módulo**    | Autenticación                  |
| **Prioridad** | Alta                           |
| **Estado**    | Propuesta                      |
| **Fecha**     | Mayo 2026                      |

## Descripción

El sistema debe permitir a cualquier usuario (cliente, técnico, administrador) recuperar su contraseña mediante el envío de un enlace único al correo electrónico registrado, válido por 1 hora y de un solo uso.

## Entradas

| Campo   | Tipo          | Obligatorio | Validaciones          |
| ------- | ------------- | ----------- | --------------------- |
| `email` | Texto (email) | Sí          | Formato válido        |

> **Actualización 2026-08:** Flujo real es código 6 dígitos: `POST /auth/forgot-password` 3/min (`auth.py:199` BackgroundTasks) → `POST /auth/verify-code` (`auth.py:231`) → `POST /auth/reset-password` con `token` 6 dígitos (`schemas/auth.py:62`). Expira 10 min (`config.py:25`). No link UUID 1h.

## Proceso

1. Usuario ingresa su email en `/forgot-password`.
2. Backend verifica si el email existe (pero responde genéricamente).
3. Si existe, genera un token UUID, lo guarda en `password_reset_tokens` con `expires_at = now + 1h`, `used = false`.
4. Envía un correo con el enlace: `{FRONTEND_URL}/reset-password?token={token}`.
5. Usuario hace clic → frontend muestra formulario para nueva contraseña.
6. Backend valida token (existente, no expirado, no usado), hashea la nueva contraseña, actualiza `hashed_password`, marca token como `used = true`.

## Salidas

| Escenario                        | Código HTTP | Respuesta                                            |
| -------------------------------- | ----------- | ---------------------------------------------------- |
| Solicitud exitosa (email exista o no) | 200     | `"Si el email está registrado, recibirás un enlace"` |
| Token inválido/expirado          | 400         | `"El enlace ha expirado o ya fue utilizado"`        |
| Nueva contraseña débil           | 422         | Detalle de validación                                |

## Endpoints asociados

| Método | Ruta                           | Auth | Descripción                          |
| ------ | ------------------------------ | ---- | ------------------------------------ |
| POST   | `/api/v1/auth/forgot-password` | No   | Solicita envío de email de recuperación |
| POST   | `/api/v1/auth/reset-password`  | No   | Restablece la contraseña con token   |

## Reglas de negocio

- **RN-010:** La respuesta de "solicitud exitosa" es siempre la misma, sin importar si el email existe, para evitar enumeración de usuarios.
- **RN-011:** El token de reseteo expira en 1 hora.
- **RN-012:** Se aplica rate limiting de 5 solicitudes por hora por IP.