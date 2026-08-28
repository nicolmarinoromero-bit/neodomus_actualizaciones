# HU-006 — Eliminación de cuenta

<!--
  ¿Qué? El usuario puede eliminar su cuenta voluntariamente.
  ¿Para qué? Tener control sobre sus datos personales (RGPD).
  ¿Impacto? Confianza y cumplimiento legal.
-->

## Identificación

| Campo            | Valor                      |
| ---------------- | -------------------------- |
| **ID**           | HU-006                     |
| **Título**       | Eliminación de cuenta      |
| **Módulo**       | Perfil de usuario          |
| **Prioridad**    | Media                      |
| **Estado**       | Propuesta                  |
| **RF asociados** | RF-020                     |

## Historia

**Como** usuario autenticado (cliente),  
**quiero** eliminar mi cuenta de forma voluntaria,  
**para** ya no estar en la plataforma y ejercer mi derecho al olvido.

## Criterios de aceptación

### CA-006.1 — Opción de eliminar cuenta
- **Dado que** estoy en mi perfil (`/perfil`),
- **cuando** desplazo hacia abajo,
- **entonces** encuentro una sección "Zona de peligro" con un botón "Eliminar mi cuenta".

### CA-006.2 — Confirmación con contraseña
- **Dado que** hago clic en "Eliminar mi cuenta",
- **cuando** se muestra un diálogo pidiendo mi contraseña actual,
- **entonces** debo ingresarla para confirmar mi identidad.

### CA-006.3 — Advertencia de consecuencias
- **Dado que** estoy por confirmar la eliminación,
- **cuando** el diálogo muestra la advertencia,
- **entonces** se me informa que perderé mis datos y que tengo 30 días para arrepentirme contactando a soporte.

### CA-006.4 — Soft delete
- **Dado que** confirmo la eliminación con la contraseña correcta,
- **cuando** el sistema procesa la solicitud,
- **entonces** mi cuenta se desactiva (`is_active = false`) y se marca `deleted_at`, pero mis datos se conservan por 30 días.

### CA-006.5 — Cancelación de servicios futuros
- **Dado que** tengo citas pendientes o futuras,
- **cuando** elimino mi cuenta,
- **entonces** esas citas se cancelan automáticamente y se notifica a los técnicos.

### CA-006.6 — Correo de confirmación
- **Dado que** mi cuenta ha sido marcada para eliminación,
- **cuando** se procesa la solicitud,
- **entonces** recibo un correo informando que mi cuenta será eliminada definitivamente en 30 días, con instrucciones para cancelar el proceso.

### CA-006.7 — Periodo de gracia
- **Dado que** pasaron menos de 30 días desde que solicité la eliminación,
- **cuando** contacto a soporte,
- **entonces** pueden restaurar mi cuenta (reactivar `is_active` y limpiar `deleted_at`).

### CA-006.8 — Eliminación física
- **Dado que** pasaron más de 30 días sin que cancele,
- **cuando** un proceso batch se ejecuta,
- **entonces** mis datos se eliminan físicamente de la base de datos (o se anonimizan) y ya no puedo recuperar mi cuenta.