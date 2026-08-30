# RF-018 — Recordatorios de servicio

<!--
  ¿Qué? El sistema envía recordatorios automáticos antes de la fecha del servicio.
  ¿Para qué? Evitar olvidos o ausencias.
  ¿Impacto? Reduce cancelaciones de última hora y mejora la puntualidad.
-->

## Identificación

| Campo         | Valor                             |
| ------------- | --------------------------------- |
| **ID**        | RF-018                            |
| **Nombre**    | Recordatorios de servicio         |
| **Módulo**    | Notificaciones                    |
| **Prioridad** | Media                             |
| **Estado**    | Propuesta                         |
| **Fecha**     | Mayo 2026                         |

## Descripción

El sistema debe enviar recordatorios automáticos al usuario antes de la fecha programada del servicio: 24 horas antes y, opcionalmente, 1 hora antes (configurable por el usuario).

## Entradas

| Campo         | Tipo   | Descripción                    |
| ------------- | ------ | ------------------------------ |
| `cita_id`     | int    | Cita programada                |
| `recordatorio_1h` | bool | Preferencia del usuario (opcional) |

## Proceso

1. Un proceso programado (cron job) se ejecuta cada hora.
2. Selecciona las citas cuya fecha/hora están exactamente a 24 horas o 1 hora del momento actual.
3. Envía correo y notificación in-app al usuario.
4. Si el usuario tiene desactivados los recordatorios de 1 hora, solo envía el de 24 horas.

## Salidas

| Escenario                     | Código HTTP | Respuesta (efecto secundario) |
| ----------------------------- | ----------- | ----------------------------- |
| Recordatorio enviado          | (automático) | No visible para el usuario    |

## Endpoints asociados

| Método | Ruta (no expuesta directamente) | Auth | Descripción                                |
| ------ | ------------------------------- | ---- | ------------------------------------------ |
| (cron) | -                               | -    | Tarea programada que dispara los recordatorios |

## Reglas de negocio

- **RN-043:** Los recordatorios no se envían si la cita fue cancelada antes.
- **RN-044:** El usuario puede configurar en su perfil si desea recordatorios de 1 hora.