# HU-001 — Registro de cuenta

<!--
  ¿Qué? Historia de usuario que describe el registro de un nuevo cliente en Neodomus.
  ¿Para qué? Formalizar la necesidad de crear una cuenta personal para solicitar servicios.
  ¿Impacto? Es la puerta de entrada al sistema — sin registro, no hay usuarios.
-->

## Identificación

| Campo            | Valor              |
| ---------------- | ------------------ |
| **ID**           | HU-001             |
| **Título**       | Registro de cuenta |
| **Módulo**       | Autenticación      |
| **Prioridad**    | Alta               |
| **Estado**       | Propuesta          |
| **RF asociados** | RF-001             |

## Historia

**Como** usuario nuevo (cliente),  
**quiero** crear una cuenta proporcionando mis datos personales (nombre, apellido, tipo y número de documento, correo, dirección y teléfono) y una contraseña segura,  
**para** poder acceder a las funcionalidades de Neodomus y solicitar servicios domóticos.

## Criterios de aceptación

### CA-001.1 — Formulario completo
- **Dado que** estoy en la página de registro (`/register`),
- **cuando** veo el formulario,
- **entonces** debo encontrar campos para: nombre, apellido, tipo de documento (DNI/NIE/Pasaporte), número de documento, correo electrónico, dirección, teléfono, contraseña y confirmación de contraseña.

### CA-001.2 — Validación de campos obligatorios
- **Dado que** dejo algún campo obligatorio vacío,
- **cuando** envío el formulario,
- **entonces** debo ver un mensaje de error específico indicando qué campo falta.

### CA-001.3 — Validación de formato de correo
- **Dado que** ingreso un correo con formato inválido (ej. "usuario@dominio"),
- **cuando** envío el formulario,
- **entonces** debo ver el mensaje: "El correo electrónico no es válido".

### CA-001.4 — Validación de contraseña segura
- **Dado que** ingreso una contraseña que no cumple los requisitos (mínimo 8 caracteres, mayúscula, minúscula, número, carácter especial),
- **cuando** envío el formulario,
- **entonces** debo ver un mensaje descriptivo indicando los requisitos faltantes.

### CA-001.5 — Confirmación de contraseña
- **Dado que** la contraseña y su confirmación no coinciden,
- **cuando** envío el formulario,
- **entonces** debo ver el mensaje: "Las contraseñas no coinciden".

### CA-001.6 — Email duplicado
- **Dado que** intento registrarme con un correo que ya existe en el sistema,
- **cuando** envío el formulario,
- **entonces** debo ver el mensaje: "El correo electrónico ya está registrado".

### CA-001.7 — Documento duplicado
- **Dado que** intento registrarme con un número de documento ya existente,
- **cuando** envío el formulario,
- **entonces** debo ver el mensaje: "El número de documento ya está registrado".

### CA-001.8 — Registro exitoso
- **Dado que** todos los campos son válidos,
- **cuando** envío el formulario,
- **entonces** el sistema crea mi cuenta y me muestra un mensaje: "Revisa tu correo para verificar tu cuenta".

### CA-001.9 — Estado de carga
- **Dado que** envié el formulario,
- **cuando** la solicitud está en proceso,
- **entonces** el botón "Registrarse" debe estar deshabilitado y mostrar un indicador de carga.

### CA-001.10 — Enlace a inicio de sesión
- **Dado que** ya tengo cuenta,
- **cuando** estoy en la página de registro,
- **entonces** debo encontrar un enlace "¿Ya tienes cuenta? Inicia sesión" que me lleve a `/login`.

### CA-001.11 — Correo de verificación
- **Dado que** completé el registro exitosamente,
- **cuando** reviso mi bandeja de entrada,
- **entonces** debo recibir un correo con un enlace para verificar mi cuenta (válido por 24 horas).

### CA-001.12 — Bloqueo de login hasta verificar email
- **Dado que** me registré pero aún no verifiqué mi email,
- **cuando** intento iniciar sesión con mis credenciales,
- **entonces** debo ver el mensaje: "Debes verificar tu email antes de iniciar sesión".

### CA-001.13 — Activación exitosa desde el enlace
- **Dado que** hago clic en el enlace de verificación,
- **cuando** el token es válido,
- **entonces** mi cuenta se activa y soy redirigido al login con un mensaje de éxito.

### CA-001.14 — Token expirado
- **Dado que** el enlace de verificación tiene más de 24 horas,
- **cuando** hago clic en él,
- **entonces** debo ver un mensaje indicando que el enlace expiró y una opción para solicitar uno nuevo.