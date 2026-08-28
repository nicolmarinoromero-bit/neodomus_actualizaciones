# HU-004 — Recuperación de contraseña

<!--
  ¿Qué? El usuario restablece su contraseña olvidada.
  ¿Para qué? Recuperar el acceso a su cuenta sin soporte manual.
  ¿Impacto? Reduce llamadas a soporte y mejora la experiencia.
-->

## Identificación

| Campo            | Valor                          |
| ---------------- | ------------------------------ |
| **ID**           | HU-004                         |
| **Título**       | Recuperación de contraseña     |
| **Módulo**       | Autenticación                  |
| **Prioridad**    | Alta                           |
| **Estado**       | Propuesta                      |
| **RF asociados** | RF-004                         |

## Historia

**Como** usuario registrado (cliente, técnico o administrador),  
**quiero** recuperar mi contraseña mediante un enlace enviado a mi correo electrónico,  
**para** volver a acceder a mi cuenta en caso de olvido.

## Criterios de aceptación

### CA-004.1 — Enlace "Olvidé mi contraseña"
- **Dado que** estoy en la página de login,
- **cuando** hago clic en "¿Olvidaste tu contraseña?",
- **entonces** soy redirigido a la página `/forgot-password` donde se me solicita mi correo electrónico.

### CA-004.2 — Validación de correo
- **Dado que** ingreso un correo con formato inválido o lo dejo vacío,
- **cuando** envío el formulario,
- **entonces** veo mensajes de error de validación.

### CA-004.3 — Respuesta genérica
- **Dado que** ingreso un correo existente o no existente,
- **cuando** envío la solicitud,
- **entonces** el sistema muestra siempre el mismo mensaje: "Si el correo está registrado, recibirás un enlace de recuperación".

### CA-004.4 — Recepción del correo
- **Dado que** mi correo está registrado en el sistema,
- **cuando** solicito la recuperación,
- **entonces** recibo un correo con un enlace único (válido por 1 hora) para restablecer mi contraseña.

### CA-004.5 — Formulario de nueva contraseña
- **Dado que** hago clic en el enlace del correo,
- **cuando** soy redirigido a `/reset-password?token=...`,
- **entonces** veo un formulario para ingresar y confirmar mi nueva contraseña.

### CA-004.6 — Validación de la nueva contraseña
- **Dado que** ingreso una contraseña débil (menos de 8 caracteres, sin mayúscula, etc.),
- **cuando** envío el formulario,
- **entonces** veo un mensaje de error detallado.

### CA-004.7 — Restablecimiento exitoso
- **Dado que** la nueva contraseña es válida,
- **cuando** envío el formulario,
- **entonces** el sistema actualiza mi contraseña y me muestra un mensaje de éxito con un enlace para ir al login.

### CA-004.8 — Token inválido o expirado
- **Dado que** intento usar un token que ya expiró, ya fue usado o es incorrecto,
- **cuando** envío el formulario,
- **entonces** veo el mensaje: "El enlace ha expirado o ya fue utilizado. Solicita un nuevo restablecimiento".

### CA-004.9 — Limitar reintentos
- **Dado que** solicito más de 5 recuperaciones en una misma hora desde mi IP,
- **cuando** envío una nueva solicitud,
- **entonces** veo un mensaje de error de "Demasiadas solicitudes, espera un momento".