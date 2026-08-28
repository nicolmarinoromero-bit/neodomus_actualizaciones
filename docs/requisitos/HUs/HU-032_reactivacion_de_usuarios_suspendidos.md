# HU-032 — Reactivación de usuarios o técnicos suspendidos

<!--
  ¿Qué? El administrador puede reactivar cuentas previamente suspendidas.
  ¿Para qué? Permitir el regreso al sistema tras corregir fallas.
  ¿Impacto? Flexibilidad en la gestión de cuentas.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-032                                               |
| **Título**       | Reactivación de usuarios o técnicos suspendidos      |
| **Módulo**       | Administrador                                        |
| **Prioridad**    | Alta                                                 |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-032                                               |

## Historia

**Como** administrador,  
**quiero** reactivar técnicos o usuarios suspendidos si corrigen sus fallas o lo solicitan,  
**para** permitirles regresar al sistema.

## Criterios de aceptación

### CA-032.1 — Lista de cuentas inactivas
- **Dado que** estoy en `/admin/usuarios` o `/admin/tecnicos`,
- **cuando** aplico un filtro para mostrar solo cuentas inactivas (`is_active = false`),
- **entonces** veo una lista de cuentas suspendidas.

### CA-032.2 — Botón "Reactivar"
- **Dado que** selecciono una cuenta suspendida,
- **cuando** hago clic en "Reactivar",
- **entonces** el sistema cambia `is_active = true` y elimina `deleted_at` (si existía).

### CA-032.3 — Notificación al usuario
- **Dado que** la reactivación es exitosa,
- **cuando** se guarda el cambio,
- **entonces** el sistema envía un correo al usuario/técnico informándole que su cuenta ha sido reactivada y que ya puede iniciar sesión.

### CA-032.4 — Registro en auditoría
- **Dado que** reactivo una cuenta,
- **cuando** se registra en `audit_log`,
- **entonces** queda constancia del administrador que realizó la reactivación y la fecha.