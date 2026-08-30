
---

## RF-042_gestion_de_roles_y_permisos.md

```markdown
# RF-042 — Gestión de roles y permisos de acceso

<!--
  ¿Qué? El administrador puede gestionar roles y permisos de acceso.
  ¿Para qué? Controlar la seguridad y jerarquía del sistema.
  ¿Impacto? Permite definir qué puede hacer cada tipo de usuario.
-->

## Identificación

| Campo         | Valor                                      |
| ------------- | ------------------------------------------ |
| **ID**        | RF-042                                     |
| **Nombre**    | Gestión de roles y permisos de acceso      |
| **Módulo**    | Administrador                              |
| **Prioridad** | Media                                      |
| **Estado**    | Propuesta                                  |
| **Fecha**     | Mayo 2026                                  |

## Descripción

El sistema debe permitir al administrador gestionar los roles de usuario y sus permisos asociados. Inicialmente existen tres roles predefinidos (`usuario`, `tecnico`, `admin`). En versiones futuras se podrían crear roles personalizados.

## Entradas

| Campo         | Tipo   | Obligatorio | Descripción                         |
| ------------- | ------ | ----------- | ----------------------------------- |
| `rol`         | string | Sí          | Nombre del rol                      |
| `permisos`    | array  | Sí          | Lista de permisos (ej. `crear_cita`, `ver_reportes`) |

## Proceso

1. El administrador accede a `/admin/configuracion/roles`.
2. Visualiza la lista de roles existentes y sus permisos.
3. Puede editar los permisos de los roles predefinidos (no puede eliminar los roles base).
4. (Opcional) Puede crear un nuevo rol personalizado, asignándole un conjunto de permisos.
5. Guarda los cambios.
6. El backend actualiza la configuración de permisos en la tabla `configuracion` o en una tabla dedicada `roles_permisos`.
7. Los endpoints verifican los permisos mediante un middleware que consulta esta configuración.

## Salidas

| Escenario                     | Código HTTP | Respuesta                          |
| ----------------------------- | ----------- | ---------------------------------- |
| Permisos actualizados         | 200         | `"Roles y permisos actualizados"`  |
| Intento de eliminar rol base  | 400         | `"No se puede eliminar un rol predefinido"` |

## Endpoints asociados

| Método | Ruta                              | Auth  | Descripción                          |
| ------ | --------------------------------- | ----- | ------------------------------------ |
| GET    | `/api/v1/admin/config/roles`      | Sí (admin) | Obtiene la lista de roles y permisos |
| PUT    | `/api/v1/admin/config/roles`      | Sí (admin) | Actualiza los permisos de los roles  |
| POST   | `/api/v1/admin/config/roles`      | Sí (admin) | Crea un nuevo rol (opcional)         |

## Reglas de negocio

- **RN-097:** Los roles `usuario`, `tecnico` y `admin` son base y no se pueden eliminar.
- **RN-098:** Los permisos se definen a nivel de endpoint (ej. `citas:crear`, `tecnicos:asignar`).
- **RN-099:** Los cambios en roles/permisos se aplican inmediatamente para nuevas sesiones (los tokens JWT se regeneran al siguiente login, pero el middleware también consulta la BD).