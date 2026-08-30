# HU-005 — Edición de datos personales

<!--
  ¿Qué? El usuario puede actualizar su información de perfil.
  ¿Para qué? Mantener sus datos actualizados (dirección, teléfono, etc.).
  ¿Impacto? Mejora la comunicación y la logística.
-->

## Identificación

| Campo            | Valor                          |
| ---------------- | ------------------------------ |
| **ID**           | HU-005                         |
| **Título**       | Edición de datos personales    |
| **Módulo**       | Perfil de usuario              |
| **Prioridad**    | Media                          |
| **Estado**       | Propuesta                      |
| **RF asociados** | RF-017                         |

## Historia

**Como** usuario autenticado (cliente o técnico),  
**quiero** editar mis datos personales (nombre, apellido, dirección, teléfono) y contraseña,  
**para** mantener mi información actualizada en la plataforma.

## Criterios de aceptación

### CA-005.1 — Acceso a la pantalla de perfil
- **Dado que** he iniciado sesión,
- **cuando** hago clic en mi nombre o avatar en la barra superior y selecciono "Mi perfil",
- **entonces** accedo a `/perfil` donde veo mis datos actuales en un formulario editable.

### CA-005.2 — Campos editables
- **Dado que** veo el formulario de perfil,
- **cuando** intento modificar los campos,
- **entonces** puedo cambiar: nombre, apellido, dirección y teléfono.  
  El correo electrónico y el número de documento **no son editables** directamente.

### CA-005.3 — Validación de campos
- **Dado que** ingreso un nombre con menos de 2 caracteres o un teléfono con formato inválido,
- **cuando** guardo los cambios,
- **entonces** veo mensajes de error específicos.

### CA-005.4 — Guardado exitoso
- **Dado que** los cambios son válidos,
- **cuando** hago clic en "Guardar cambios",
- **entonces** el sistema actualiza mi perfil y me muestra un mensaje de éxito.

### CA-005.5 — Cambio de contraseña
- **Dado que** en la misma pantalla hay una sección "Cambiar contraseña",
- **cuando** ingreso mi contraseña actual, la nueva y su confirmación,
- **entonces** el sistema valida la actual y actualiza la nueva si es correcta.

### CA-005.6 — Solicitud de cambio de email (flujo especial)
- **Dado que** deseo cambiar mi correo electrónico,
- **cuando** hago clic en "Cambiar email",
- **entonces** se inicia un flujo que requiere verificar el nuevo email (envío de enlace) y confirmar mi contraseña actual.