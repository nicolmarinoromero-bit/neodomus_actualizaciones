# HU-041 — Gestión de roles y permisos de acceso

<!--
  ¿Qué? El administrador puede definir qué puede hacer cada rol.
  ¿Para qué? Controlar la seguridad y jerarquía del sistema.
  ¿Impacto? Permite adaptar el sistema a diferentes niveles de autorización.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-041                                               |
| **Título**       | Gestión de roles y permisos de acceso                |
| **Módulo**       | Administrador                                        |
| **Prioridad**    | Media                                                |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-042                                               |

## Historia

**Como** administrador,  
**quiero** gestionar roles y permisos de acceso (qué puede hacer cada tipo de usuario),  
**para** controlar la seguridad y la jerarquía del sistema.

## Criterios de aceptación

### CA-041.1 — Roles predefinidos
- **Dado que** accedo a `/admin/configuracion/roles`,
- **cuando** veo la lista,
- **entonces** existen tres roles base: `usuario`, `tecnico`, `admin`. No se pueden eliminar.

### CA-041.2 — Editar permisos
- **Dado que** selecciono un rol,
- **cuando** veo sus permisos,
- **entonces** puedo marcar/desmarcar permisos como:
  - `citas:crear`
  - `citas:modificar_propia`
  - `tecnicos:asignar`
  - `reportes:ver`
  - etc.

### CA-041.3 — Crear roles personalizados
- **Dado que** hago clic en "Nuevo rol",
- **cuando** le doy un nombre y selecciono permisos,
- **entonces** puedo asignar ese rol a usuarios.

### CA-041.4 — Aplicación inmediata
- **Dado que** cambio los permisos de un rol,
- **cuando** guardo,
- **entonces** los usuarios con ese rol ven reflejados los cambios en su próxima acción (los endpoints verifican los permisos actualizados en BD, no solo en JWT).

### CA-041.5 — Seguridad
- **Dado que** un usuario intenta acceder a una acción para la que no tiene permiso,
- **cuando** lo hace,
- **entonces** el backend devuelve 403 Forbidden.