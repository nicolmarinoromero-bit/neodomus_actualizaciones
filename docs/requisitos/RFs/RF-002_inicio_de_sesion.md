# RF-002 — Inicio de sesión

<!--
  ¿Qué? Autenticación de usuarios mediante correo electrónico y contraseña.
  ¿Para qué? Permitir el acceso seguro a la plataforma.
  ¿Impacto? Es la puerta de entrada a las funcionalidades protegidas.
-->

## Identificación

| Campo         | Valor                |
| ------------- | -------------------- |
| **ID**        | RF-002               |
| **Nombre**    | Inicio de sesión     |
| **Módulo**    | Autenticación        |
| **Prioridad** | Alta                 |
| **Estado**    | Propuesta            |
| **Fecha**     | Mayo 2026            |

## Descripción

El sistema debe permitir a usuarios, técnicos y administradores iniciar sesión mediante su correo electrónico y contraseña, generando un par de tokens JWT (access y refresh) y redirigiendo según el rol del usuario.

## Entradas

| Campo      | Tipo          | Obligatorio | Validaciones                       |
| ---------- | ------------- | ----------- | ---------------------------------- |
| `email`    | Texto (email) | Sí          | Formato válido, registrado         |
| `password` | Texto         | Sí          | No vacío (verificación con hash)   |

## Proceso

1. El usuario ingresa email y contraseña en `/login`.
2. El backend busca el usuario por email.
3. Si no existe, responde con "Credenciales incorrectas" (respuesta genérica).
4. Si existe, verifica la contraseña con bcrypt.
5. Si es incorrecta, responde con el mismo mensaje genérico.
6. Si es correcta, verifica `is_email_verified` y `is_active`.
7. Genera `access_token` (15 min) y `refresh_token` (7 días), ambos conteniendo `user_id` y `rol`.
8. Retorna los tokens y redirige según el rol.

## Salidas

| Escenario                         | Código HTTP | Respuesta                                                        |
| --------------------------------- | ----------- | ---------------------------------------------------------------- |
| Login exitoso                     | 200         | `{ "access_token": "...", "refresh_token": "...", "rol": "..." }` |
| Credenciales incorrectas          | 401         | `"Credenciales incorrectas"` (genérico)                         |
| Email no verificado               | 403         | `"Debes verificar tu email antes de iniciar sesión"`            |
| Cuenta inactiva                   | 403         | `"Tu cuenta ha sido desactivada. Contacta con soporte"`         |

## Endpoints asociados

| Método | Ruta                    | Auth | Descripción                       |
| ------ | ----------------------- | ---- | --------------------------------- |
| POST   | `/api/v1/auth/login`    | No   | Autenticación y obtención de tokens |
| POST   | `/api/v1/auth/refresh`  | No*  | Renovación del access token        |

## Reglas de negocio

- **RN-005:** La respuesta de error es genérica para evitar enumeración de usuarios (OWASP A07).
- **RN-006:** El `access_token` tiene 15 minutos de vida; el `refresh_token` 7 días.
- **RN-007:** El token JWT contiene el rol del usuario para autorización sin consultar la BD.