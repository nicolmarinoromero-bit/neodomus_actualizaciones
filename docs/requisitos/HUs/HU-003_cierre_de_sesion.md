# HU-003 — Cierre de sesión

<!--
  ¿Qué? El usuario finaliza su sesión activa.
  ¿Para qué? Proteger sus datos en dispositivos compartidos.
  ¿Impacto? Evita que otra persona use la sesión sin permiso.
-->

## Identificación

| Campo            | Valor                |
| ---------------- | -------------------- |
| **ID**           | HU-003               |
| **Título**       | Cierre de sesión     |
| **Módulo**       | Autenticación        |
| **Prioridad**    | Alta                 |
| **Estado**       | Propuesta            |
| **RF asociados** | RF-003               |

## Historia

**Como** usuario autenticado (cliente, técnico o administrador),  
**quiero** cerrar mi sesión de forma segura,  
**para** proteger mis datos personales y de pago cuando ya no uso el sistema.

## Criterios de aceptación

### CA-003.1 — Botón de cierre visible
- **Dado que** he iniciado sesión,
- **cuando** navego por la interfaz,
- **entonces** encuentro un botón o enlace "Cerrar sesión" en el menú de usuario (normalmente en la esquina superior derecha).

### CA-003.2 — Confirmación (opcional)
- **Dado que** hago clic en "Cerrar sesión",
- **cuando** el sistema muestra un diálogo de confirmación,
- **entonces** si confirmo, se procede al cierre; si cancelo, permanezco en la sesión.

### CA-003.3 — Invalidad de refresh token
- **Dado que** confirmo el cierre,
- **cuando** el frontend llama al endpoint `POST /api/v1/auth/logout` con mi `refresh_token`,
- **entonces** el backend invalida ese token (no podrá usarse para renovar).

### CA-003.4 — Limpieza de tokens locales
- **Dado que** el backend responde exitosamente (o incluso si falla la comunicación),
- **cuando** el frontend recibe la orden,
- **entonces** elimina `access_token` y `refresh_token` del almacenamiento local.

### CA-003.5 — Redirección al login
- **Dado que** el cierre fue exitoso,
- **cuando** la sesión se cierra,
- **entonces** soy redirigido a la página de inicio de sesión (`/login`).

### CA-003.6 — Imposibilidad de acceder a rutas protegidas
- **Dado que** cerré sesión,
- **cuando** intento acceder a una ruta protegida (ej. `/panel/dashboard`),
- **entonces** el sistema me redirige a `/login` sin mostrar el contenido.