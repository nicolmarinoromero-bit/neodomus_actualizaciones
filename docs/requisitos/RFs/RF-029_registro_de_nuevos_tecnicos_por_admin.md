
---

## RF-029_registro_de_nuevos_tecnicos_por_admin.md

```markdown
# RF-029 — Registro de nuevos técnicos por el administrador

<!--
  ¿Qué? El administrador puede crear cuentas de técnico.
  ¿Para qué? Incorporar nuevo personal a la plataforma.
  ¿Impacto? Permite escalar el equipo de trabajo.
-->

## Identificación

| Campo         | Valor                                        |
| ------------- | -------------------------------------------- |
| **ID**        | RF-029                                       |
| **Nombre**    | Registro de nuevos técnicos por el administrador |
| **Módulo**    | Administrador                                |
| **Prioridad** | Alta                                         |
| **Estado**    | Propuesta                                    |
| **Fecha**     | Mayo 2026                                    |

## Descripción

El sistema debe permitir al administrador registrar nuevos técnicos en la plataforma, ingresando sus datos personales y especialidad. El sistema debe enviar al técnico un correo con credenciales temporales.

## Entradas

| Campo              | Tipo   | Obligatorio | Validaciones                         |
| ------------------ | ------ | ----------- | ------------------------------------ |
| `nombre`           | string | Sí          | Mínimo 2 caracteres                  |
| `apellido`         | string | Sí          | Mínimo 2 caracteres                  |
| `tipo_documento`   | string | Sí          | `DNI`, `NIE`, `PASAPORTE`            |
| `numero_documento` | string | Sí          | Único en el sistema                  |
| `email`            | string | Sí          | Formato válido, único                |
| `telefono`         | string | Sí          | Formato E.164                        |
| `direccion`        | string | Sí          | Mínimo 5 caracteres                  |
| `especialidad`     | string | No          | Texto libre (ej. "electricidad")     |

## Proceso

1. El administrador accede a `/admin/tecnicos/nuevo`.
2. Completa el formulario y envía.
3. El backend valida que email y documento no existan.
4. Genera una contraseña aleatoria segura (12 caracteres alfanuméricos).
5. Hashea la contraseña con bcrypt y crea un usuario con `rol = 'tecnico'`.
6. Crea el registro en la tabla `tecnicos` con la especialidad y disponibilidad por defecto.
7. Envía un correo al técnico con sus credenciales temporales y enlace de login.
8. El técnico debe cambiar la contraseña en su primer inicio de sesión (ver RF-017).

## Salidas

| Escenario                     | Código HTTP | Respuesta                        |
| ----------------------------- | ----------- | -------------------------------- |
| Técnico creado                | 201         | Datos del técnico (sin contraseña) |
| Email o documento duplicado   | 400         | `"El email o documento ya existe"` |

## Endpoints asociados

| Método | Ruta                         | Auth  | Descripción                         |
| ------ | ---------------------------- | ----- | ----------------------------------- |
| POST   | `/api/v1/admin/tecnicos`     | Sí (admin) | Crea un nuevo técnico            |

## Reglas de negocio

- **RN-067:** La contraseña temporal debe expirar en 7 días si el técnico no la cambia.
- **RN-068:** El administrador no puede crear otro administrador; solo técnicos y usuarios (los usuarios se registran solos).