# RF-027 — Comunicación con el usuario desde la plataforma (técnico)

<!--
  ¿Qué? El técnico puede chatear con el usuario desde la plataforma.
  ¿Para qué? Coordinar horarios o resolver detalles técnicos.
  ¿Impacto? Mejora la comunicación y la satisfacción.
-->

## Identificación

| Campo         | Valor                                                |
| ------------- | ---------------------------------------------------- |
| **ID**        | RF-027                                               |
| **Nombre**    | Comunicación con el usuario desde la plataforma (técnico) |
| **Módulo**    | Chat                                                 |
| **Prioridad** | Media                                                |
| **Estado**    | Propuesta                                            |
| **Fecha**     | Mayo 2026                                            |

## Descripción

El sistema debe permitir al técnico comunicarse con el usuario desde la plataforma mediante el mismo módulo de chat bidireccional, con el contexto del servicio.

## Entradas

| Campo         | Tipo   | Obligatorio | Validaciones                     |
| ------------- | ------ | ----------- | -------------------------------- |
| `cita_id`     | int    | Sí          | Cita debe pertenecer al técnico  |
| `mensaje`     | string | Sí          | Máximo 500 caracteres            |

## Proceso

(Análogo al RF-015 pero desde la perspectiva del técnico)

1. El técnico accede al detalle de una tarea asignada.
2. Hace clic en "Chatear con el cliente".
3. Se muestra el historial de mensajes.
4. Escribe y envía un mensaje.
5. El backend guarda el mensaje y notifica al usuario.
6. El usuario responde (ver RF-015).

## Salidas

| Escenario                     | Código HTTP | Respuesta                              |
| ----------------------------- | ----------- | -------------------------------------- |
| Mensaje enviado               | 201         | Datos del mensaje                      |
| Cita no pertenece al técnico  | 403         | `"No tienes permiso para chatear en esta conversación"` |

## Endpoints asociados

Los mismos del RF-015: `POST /api/v1/chat/enviar`, `GET /api/v1/chat/conversacion/{cita_id}`.

## Reglas de negocio

- **RN-064:** El técnico solo puede chatear en citas donde sea el asignado.