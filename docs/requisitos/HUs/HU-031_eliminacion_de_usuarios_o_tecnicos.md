# HU-031 — Eliminación definitiva de usuarios o técnicos inactivos

<!--
  ¿Qué? El administrador puede eliminar cuentas definitivamente.
  ¿Para qué? Mantener la integridad de la base de datos y cumplir con normativas.
  ¿Impacto? Permite depurar cuentas no deseadas o de usuarios que ya no están.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-031                                               |
| **Título**       | Eliminación definitiva de usuarios o técnicos inactivos |
| **Módulo**       | Administrador                                        |
| **Prioridad**    | Alta                                                 |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-031                                               |

## Historia

**Como** administrador,  
**quiero** eliminar definitivamente usuarios o técnicos inactivos o con faltas graves,  
**para** mantener la integridad de la base de datos y cumplir con políticas de retención de datos.

## Criterios de aceptación

### CA-031.1 — Acción de eliminar en la lista
- **Dado que** estoy en `/admin/usuarios` o `/admin/tecnicos`,
- **cuando** veo una cuenta inactiva o que ha sido marcada para eliminación,
- **entonces** tengo un botón "Eliminar definitivamente".

### CA-031.2 — Verificación de citas pendientes
- **Dado que** hago clic en eliminar,
- **cuando** el sistema verifica si la cuenta tiene citas en estado `pendiente` o `confirmada`,
- **entonces** si las tiene, se muestra un error: "No se puede eliminar: tiene citas pendientes. Cancelelas primero".

### CA-031.3 — Confirmación irreversible
- **Dado que** la cuenta no tiene citas pendientes,
- **cuando** se muestra un diálogo de confirmación con advertencia de irreversibilidad,
- **entonces** debo escribir "ELIMINAR" o marcar una casilla de confirmación.

### CA-031.4 — Eliminación física o anonimización
- **Dado que** confirmo la eliminación,
- **cuando** el sistema procesa,
- **entonces** los datos personales se eliminan físicamente de la base de datos (o se anonimizan según la política de la empresa).

### CA-031.5 — Registro en auditoría
- **Dado que** la eliminación se completa,
- **cuando** se registra en `audit_log`,
- **entonces** queda constancia de qué administrador realizó la eliminación, a qué usuario/técnico, y la fecha/hora.