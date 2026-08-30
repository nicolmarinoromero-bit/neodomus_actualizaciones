# RF-030 — Edición de técnicos por el administrador

<!--
  ¿Qué? El administrador puede modificar los datos de los técnicos existentes.
  ¿Para qué? Mantener actualizada la información laboral.
  ¿Impacto? Permite corregir errores o actualizar especialidades.
-->

## Identificación

| Campo         | Valor                                    |
| ------------- | ---------------------------------------- |
| **ID**        | RF-030                                   |
| **Nombre**    | Edición de técnicos por el administrador |
| **Módulo**    | Administrador                            |
| **Prioridad** | Alta                                     |
| **Estado**    | Propuesta                                |
| **Fecha**     | Mayo 2026                                |

## Descripción

El sistema debe permitir al administrador editar la información de los técnicos registrados, incluyendo datos personales, especialidad y estado (activo/inactivo).

## Entradas

| Campo              | Tipo    | Obligatorio | Validaciones                     |
| ------------------ | ------- | ----------- | -------------------------------- |
| `nombre`           | string  | No          | Mínimo 2 caracteres              |
| `apellido`         | string  | No          | Mínimo 2 caracteres              |
| `telefono`         | string  | No          | Formato E.164                    |
| `direccion`        | string  | No          | Mínimo 5 caracteres              |
| `especialidad`     | string  | No          | -                                |
| `is_active`        | boolean | Sí          | Si `false`, el técnico no puede iniciar sesión |

## Proceso

1. El administrador accede a `/admin/tecnicos`, hace clic en "Editar" de un técnico.
2. El formulario muestra los datos actuales (excepto email y documento, que no son editables directamente).
3. Modifica los campos permitidos y guarda.
4. El backend actualiza la tabla `usuarios` y `tecnicos`.
5. Registra el cambio en `audit_log` con los campos modificados.

## Salidas

| Escenario                     | Código HTTP | Respuesta                          |
| ----------------------------- | ----------- | ---------------------------------- |
| Técnico actualizado           | 200         | `"Técnico actualizado correctamente"` |
| Datos inválidos               | 422         | Detalle de validación              |

## Endpoints asociados

| Método | Ruta                                 | Auth  | Descripción                       |
| ------ | ------------------------------------ | ----- | --------------------------------- |
| PUT    | `/api/v1/admin/tecnicos/{id}`        | Sí (admin) | Actualiza los datos de un técnico |

## Reglas de negocio

- **RN-069:** El correo electrónico y número de documento no pueden modificarse por razones de auditoría.
- **RN-070:** Al cambiar `is_active = false`, el técnico es bloqueado automáticamente y no puede iniciar sesión.
- **RN-071:** Se debe notificar al técnico por correo cuando su cuenta es desactivada o reactivada.
