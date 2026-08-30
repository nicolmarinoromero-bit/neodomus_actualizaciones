# HU-002 — Inicio de sesión

<!--
  ¿Qué? El usuario accede a su cuenta con credenciales.
  ¿Para qué? Acceder a funcionalidades protegidas.
  ¿Impacto? Sin autenticación no se pueden gestionar servicios.
-->

## Identificación

| Campo            | Valor                |
| ---------------- | -------------------- |
| **ID**           | HU-002               |
| **Título**       | Inicio de sesión     |
| **Módulo**       | Autenticación        |
| **Prioridad**    | Alta                 |
| **Estado**       | Propuesta            |
| **RF asociados** | RF-002, RF-019       |

## Historia

**Como** usuario registrado (cliente, técnico o administrador),  
**quiero** iniciar sesión con mi correo electrónico y contraseña,  
**para** acceder de forma rápida y segura a mi perfil y a las funcionalidades de Neodomus.

## Criterios de aceptación

### CA-002.1 — Formulario de login
- **Dado que** estoy en la página de inicio de sesión (`/login`),
- **cuando** veo el formulario,
- **entonces** debo encontrar campos para correo electrónico y contraseña, un botón "Iniciar sesión" y un enlace "¿Olvidaste tu contraseña?".

### CA-002.2 — Validación de campos vacíos
- **Dado que** dejo vacío el campo de correo o contraseña,
- **cuando** intento enviar el formulario,
- **entonces** debo ver mensajes de error: "El correo es obligatorio" y/o "La contraseña es obligatoria".

### CA-002.3 — Credenciales incorrectas
- **Dado que** ingreso un correo que no existe o una contraseña errónea,
- **cuando** envío el formulario,
- **entonces** debo ver un mensaje genérico: "Credenciales incorrectas" (sin revelar si el correo existe).

### CA-002.4 — Email no verificado
- **Dado que** mi cuenta existe pero aún no he verificado mi email,
- **cuando** intento iniciar sesión,
- **entonces** debo ver el mensaje: "Debes verificar tu email antes de iniciar sesión. ¿No recibiste el correo? Solicita uno nuevo".

### CA-002.5 — Cuenta inactiva
- **Dado que** mi cuenta ha sido desactivada por el administrador,
- **cuando** intento iniciar sesión,
- **entonces** debo ver el mensaje: "Tu cuenta ha sido desactivada. Contacta con soporte".

### CA-002.6 — Redirección por rol
- **Dado que** mis credenciales son correctas y mi cuenta está verificada y activa,
- **cuando** inicio sesión exitosamente,
- **entonces** soy redirigido según mi rol:  
  - `usuario` → `/panel/dashboard`  
  - `tecnico` → `/tech/mapa`  
  - `admin` → `/admin/tecnicos`

### CA-002.7 — Persistencia de sesión
- **Dado que** inicio sesión,
- **cuando** cierro el navegador y vuelvo a abrirlo,
- **entonces** permanezco autenticado mientras el `refresh_token` no haya expirado (7 días).

### CA-002.8 — Expiración del access token
- **Dado que** han pasado más de 15 minutos de inactividad,
- **cuando** intento realizar una acción protegida,
- **entonces** el sistema debe renovar automáticamente mi `access_token` usando el `refresh_token` (sin que yo tenga que volver a escribir mi contraseña).