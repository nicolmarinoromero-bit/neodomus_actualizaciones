
---

## RF-017_edicion_de_datos_personales.md

```markdown
# RF-017 — Edición de datos personales

<!--
  ¿Qué? El usuario y el técnico pueden editar sus datos personales.
  ¿Para qué? Mantener la información actualizada.
  ¿Impacto? Mejora la comunicación y la logística.
-->

## Identificación

| Campo         | Valor                              |
| ------------- | ---------------------------------- |
| **ID**        | RF-017                             |
| **Nombre**    | Edición de datos personales        |
| **Módulo**    | Perfil de usuario                  |
| **Prioridad** | Media                              |
| **Estado**    | Propuesta                          |
| **Fecha**     | Mayo 2026                          |

## Descripción

El sistema debe permitir a usuarios y técnicos editar sus datos personales y dirección después de haber iniciado sesión. El correo electrónico no debe ser editable sin un proceso de verificación adicional.

## Entradas

| Campo         | Tipo   | Obligatorio | Validaciones                        |
| ------------- | ------ | ----------- | ----------------------------------- |
| `nombre`      | string | No          | Mínimo 2 caracteres                 |
| `apellido`    | string | No          | Mínimo 2 caracteres                 |
| `direccion`   | string | No          | Mínimo 5 caracteres                 |
| `telefono`    | string | No          | Formato E.164                       |

## Proceso

1. Usuario accede a `/perfil`.
2. Ve los datos actuales en un formulario editable (excepto email y documento).
3. Modifica los campos permitidos y guarda.
4. Backend actualiza la tabla `usuarios`.
5. Se registra el cambio en `audit_log`.

## Salidas

| Escenario               | Código HTTP | Respuesta                       |
| ----------------------- | ----------- | ------------------------------- |
| Actualización exitosa   | 200         | `"Datos actualizados correctamente"` |
| Dato inválido           | 422         | Detalle de validación           |

## Endpoints asociados

| Método | Ruta                    | Auth | Descripción                   |
| ------ | ----------------------- | ---- | ----------------------------- |
| PUT    | `/api/v1/users/me`      | Sí   | Actualiza el perfil del usuario |

## Reglas de negocio

- **RN-041:** El email no se puede modificar directamente; si se necesita, se debe verificar el nuevo email.
- **RN-042:** El número de documento nunca se puede modificar (por razones de auditoría).