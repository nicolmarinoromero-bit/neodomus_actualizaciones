# RF-043 — Envío de comunicados o mensajes masivos

<!--
  ¿Qué? El administrador puede enviar comunicados masivos a usuarios y técnicos.
  ¿Para qué? Mantener comunicación constante y oficial.
  ¿Impacto? Difundir información importante (cambios de horarios, promociones, etc.).
-->

## Identificación

| Campo         | Valor                                      |
| ------------- | ------------------------------------------ |
| **ID**        | RF-043                                     |
| **Nombre**    | Envío de comunicados o mensajes masivos    |
| **Módulo**    | Administrador                              |
| **Prioridad** | Media                                      |
| **Estado**    | Propuesta                                  |
| **Fecha**     | Mayo 2026                                  |

## Descripción

El sistema debe permitir al administrador enviar comunicados o mensajes masivos a usuarios y técnicos, por correo electrónico y mediante notificaciones in-app.

## Entradas

| Campo           | Tipo    | Obligatorio | Validaciones                     |
| --------------- | ------- | ----------- | -------------------------------- |
| `titulo`        | string  | Sí          | Máximo 100 caracteres            |
| `mensaje`       | string  | Sí          | Máximo 2000 caracteres           |
| `destinatarios` | array   | Sí          | `usuarios`, `tecnicos`, `ambos`  |

## Proceso

1. El administrador accede a `/admin/comunicados`.
2. Completa el formulario con título, mensaje y destinatarios.
3. Puede programar el envío para una fecha futura (opcional).
4. Al enviar, el backend:
   - Consulta los emails de los destinatarios seleccionados.
   - Envía el correo (de forma asíncrona, en lotes para no saturar el servidor).
   - Crea registros de notificación in-app para cada destinatario.
5. Se registra la acción en `audit_log`.

## Salidas

| Escenario                     | Código HTTP | Respuesta                                |
| ----------------------------- | ----------- | ---------------------------------------- |
| Comunicado enviado            | 200         | `"Comunicado enviado a X destinatarios"` |
| Programado para fecha futura  | 200         | `"Comunicado programado para el {fecha}"`|

## Endpoints asociados

| Método | Ruta                             | Auth  | Descripción                          |
| ------ | -------------------------------- | ----- | ------------------------------------ |
| POST   | `/api/v1/admin/comunicados`      | Sí (admin) | Envía un comunicado masivo          |

## Reglas de negocio

- **RN-100:** Los comunicados no se envían a usuarios que hayan cancelado su suscripción a correos comerciales (opcional).
- **RN-101:** El envío de correos se realiza en segundo plano para no bloquear la respuesta.
- **RN-102:** Se debe mostrar una vista previa del mensaje antes de enviar.