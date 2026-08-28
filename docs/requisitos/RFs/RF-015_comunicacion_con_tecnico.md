# RF-015 — Comunicación con el técnico asignado

<!--
  ¿Qué? El usuario puede chatear con el técnico asignado a su servicio.
  ¿Para qué? Coordinar detalles o resolver dudas antes del servicio.
  ¿Impacto? Mejora la satisfacción y reduce malentendidos.
-->

## Identificación

| Campo         | Valor                               |
| ------------- | ----------------------------------- |
| **ID**        | RF-015                              |
| **Nombre**    | Comunicación con el técnico asignado |
| **Módulo**    | Chat                                |
| **Prioridad** | Media                               |
| **Estado**    | Propuesta                           |
| **Fecha**     | Mayo 2026                           |

## Descripción

El sistema debe permitir la comunicación directa entre el usuario y el técnico asignado mediante un chat integrado en la plataforma, mostrando el contexto del servicio (dirección, fecha, tipo de trabajo).

## Entradas

| Campo         | Tipo   | Obligatorio | Validaciones                     |
| ------------- | ------ | ----------- | -------------------------------- |
| `cita_id`     | int    | Sí          | Cita debe tener técnico asignado |
| `mensaje`     | string | Sí          | Máximo 500 caracteres            |

## Proceso

1. Usuario accede al detalle de su cita `confirmada` o `en_progreso`.
2. Hace clic en "Chatear con el técnico".
3. La interfaz muestra el historial de mensajes y un formulario para nuevo mensaje.
4. El backend almacena el mensaje con timestamp y `leido = false`.
5. El técnico recibe una notificación in-app (y correo resumen) de nuevo mensaje.
6. El técnico responde (ver RF-027).

## Salidas

| Escenario                 | Código HTTP | Respuesta                              |
| ------------------------- | ----------- | -------------------------------------- |
| Mensaje enviado           | 201         | Datos del mensaje (`id`, `created_at`) |
| Cita sin técnico asignado | 400         | `"Aún no hay técnico asignado"`        |

## Endpoints asociados

| Método | Ruta                                  | Auth | Descripción                          |
| ------ | ------------------------------------- | ---- | ------------------------------------ |
| POST   | `/api/v1/chat/enviar`                 | Sí   | Envía un mensaje en una conversación |
| GET    | `/api/v1/chat/conversacion/{cita_id}` | Sí   | Obtiene el historial de mensajes     |

## Reglas de negocio

- **RN-036:** El chat es solo entre el usuario propietario de la cita y el técnico asignado.
- **RN-037:** Los mensajes se guardan indefinidamente para auditoría.
- **RN-038:** El contexto del servicio se muestra en el encabezado del chat.