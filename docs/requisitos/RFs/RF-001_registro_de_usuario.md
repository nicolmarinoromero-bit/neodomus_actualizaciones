# RF-001 — Registro de usuario

<!--
  ¿Qué? Requisito funcional que define el registro de nuevos usuarios (clientes) en Neodomus.
  ¿Para qué? Documentar formalmente la creación de cuentas para clientes.
  ¿Impacto? Sin este requisito, no habría forma estandarizada de incorporar usuarios al sistema.
-->

## Identificación

| Campo         | Valor                    |
| ------------- | ------------------------ |
| **ID**        | RF-001                   |
| **Nombre**    | Registro de usuario      |
| **Módulo**    | Autenticación            |
| **Prioridad** | Alta                     |
| **Estado**    | Propuesta                |
| **Fecha**     | Mayo 2026                |

## Descripción

El sistema debe permitir que un nuevo usuario cree una cuenta proporcionando: nombre, apellido, tipo de documento, número de documento, correo electrónico, dirección, número de teléfono y contraseña. Tras el registro, el sistema envía un correo de verificación. El usuario debe hacer clic en el enlace del correo para activar su cuenta antes de poder iniciar sesión.

## Entradas

| Campo              | Tipo          | Obligatorio | Validaciones                                                                 |
| ------------------ | ------------- | ----------- | ---------------------------------------------------------------------------- |
| `nombre`           | Texto         | Sí          | Mínimo 2 caracteres, máximo 100                                              |
| `apellido`         | Texto         | Sí          | Mínimo 2 caracteres, máximo 100                                              |
| `tipo_documento`   | Enumerado     | Sí          | Valores: `DNI`, `NIE`, `PASAPORTE`                                           |
| `numero_documento` | Texto         | Sí          | Máximo 50 caracteres, único en el sistema                                    |
| `email`            | Texto (email) | Sí          | Formato válido, único, máximo 255 caracteres                                 |
| `direccion`        | Texto         | Sí          | Mínimo 5 caracteres, máximo 255                                              |
| `telefono`         | Texto         | Sí          | Formato internacional (E.164), máximo 20 caracteres                          |
| `password`         | Texto         | Sí          | Mínimo 8 caracteres, mayúscula, minúscula, número, carácter especial         |
| `confirm_password` | Texto         | Sí          | Debe coincidir con `password`                                                |

## Proceso

1. El usuario ingresa todos los campos en el formulario de registro.
2. El frontend valida los campos antes de enviar la solicitud.
3. El backend valida los datos con Pydantic (formatos, unicidad de email y documento).
4. La contraseña se hashea con bcrypt.
5. Se crea el registro en la tabla `usuarios` con `rol = 'usuario'` y `is_email_verified = false`.
6. Se genera un token UUID único de verificación (expiración 24h) en la tabla `email_verification_tokens`.
7. Se envía un correo al usuario con el enlace de verificación: `{FRONTEND_URL}/verify-email?token={token}`.
8. El usuario hace clic en el enlace → el backend valida el token y marca `is_email_verified = true`.

## Salidas

| Escenario           | Código HTTP | Respuesta                                                                                    |
| ------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| Registro exitoso    | 201         | Datos del usuario (`id`, `email`, `nombre`, `apellido`, `rol`, `is_email_verified: false`)   |
| Email duplicado     | 400         | `"El correo electrónico ya está registrado"`                                                 |
| Documento duplicado | 400         | `"El número de documento ya está registrado"`                                                |
| Datos inválidos     | 422         | Detalle de errores de validación                                                             |

## Endpoints asociados

| Método | Ruta                        | Auth | Descripción                                  |
| ------ | --------------------------- | ---- | -------------------------------------------- |
| POST   | `/api/v1/auth/register/client` | No   | Crea cuenta cliente y envía código 6 dígitos (`auth.py:64`) |
| POST   | `/api/v1/auth/verify-email?code` | No   | Activa cuenta con código 6 dígitos (`auth.py:72` `POST /auth/verify-email?code`) |

> **Nota implementación (2026-08):** Esquema real `ClientCreate` (`be/app/schemas/auth.py:16`) usa `first_name/last_name` upper, `documento` int, `telefono_cliente` int 10 dígitos, `direccion` opcional. Password valida `>=8 + mayúscula+minúscula+número` (`schemas/auth.py:5`); carácter especial opcional. Flujo real: código 6 dígitos `pending_registrations` expira 24h, `POST /auth/verify-email?code` + `POST /auth/resend-verification` 3/min. Ver `be/app/routers/auth.py:64-77`.

## Reglas de negocio

- **RN-001:** El correo electrónico y el número de documento deben ser únicos.
- **RN-002:** La contraseña nunca se almacena en texto plano; se usa bcrypt.
- **RN-003:** `is_email_verified` = false → el usuario no puede iniciar sesión hasta verificar.
- **RN-004:** El token de verificación expira en 24 horas y es de un solo uso.