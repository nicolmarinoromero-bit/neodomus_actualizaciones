# HU-029 — Edición de técnicos por el administrador

<!--
  ¿Qué? El administrador puede modificar los datos de los técnicos.
  ¿Para qué? Mantener actualizada la información laboral.
  ¿Impacto? Permite corregir errores o actualizar especialidades.
-->

## Identificación

| Campo            | Valor                                        |
| ---------------- | -------------------------------------------- |
| **ID**           | HU-029                                       |
| **Título**       | Edición de técnicos por el administrador     |
| **Módulo**       | Administrador                                |
| **Prioridad**    | Alta                                         |
| **Estado**       | Propuesta                                    |
| **RF asociados** | RF-030                                       |

## Historia

**Como** administrador,  
**quiero** editar la información de los técnicos ya registrados,  
**para** mantener sus datos actualizados (especialidad, estado activo/inactivo, etc.).

## Criterios de aceptación

### CA-029.1 — Lista de técnicos con acciones
- **Dado que** estoy en `/admin/tecnicos`,
- **cuando** veo la lista,
- **entonces** cada fila tiene un botón "Editar".

### CA-029.2 — Formulario de edición
- **Dado que** hago clic en "Editar",
- **cuando** se abre el formulario,
- **entonces** puedo modificar: nombre, apellido, teléfono, dirección, especialidad y el estado (activo/inactivo).  
  El email y número de documento **no son editables** directamente por razones de auditoría.

### CA-029.3 — Activación/desactivación
- **Dado que** desmarco la casilla "Activo",
- **cuando** guardo,
- **entonces** el técnico no podrá iniciar sesión y verá el mensaje "Cuenta desactivada".

### CA-029.4 — Guardado exitoso
- **Dado que** modifico datos válidos,
- **cuando** guardo,
- **entonces** el sistema actualiza la información y muestra un mensaje de éxito.

### CA-029.5 — Auditoría de cambios
- **Dado que** realizo una edición,
- **cuando** guardo,
- **entonces** se registra en `audit_log` qué campos cambié, los valores anteriores y nuevos, y mi ID de administrador.