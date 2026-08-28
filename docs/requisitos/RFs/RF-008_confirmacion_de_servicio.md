# RF-008 — Confirmación de servicio

<!--
  ¿Qué? Envío de confirmación al usuario después de agendar.
  ¿Para qué? Que el usuario sepa que su solicitud fue recibida correctamente.
  ¿Impacto? Reduce la incertidumbre y mejora la confianza.
-->

## Identificación

| Campo         | Valor                           |
| ------------- | ------------------------------- |
| **ID**        | RF-008                          |
| **Nombre**    | Confirmación de servicio        |
| **Módulo**    | Notificaciones                  |
| **Prioridad** | Alta                            |
| **Estado**    | Propuesta                       |
| **Fecha**     | Mayo 2026                       |

## Descripción

El sistema debe enviar al usuario una confirmación del servicio agendado por medio de la aplicación (notificación in-app) y por correo electrónico, incluyendo los detalles de la cita.

## Entradas

| Campo       | Tipo | Descripción                        |
| ----------- | ---- | ---------------------------------- |
| `cita_id`   | int  | ID de la cita recién creada        |
| `usuario`   | obj  | Datos del usuario                  |
| `servicio`  | obj  | Datos del servicio solicitado      |

## Proceso

1. Tras la creación de la cita (RF-007), el sistema dispara una notificación.
2. Se envía un correo con: tipo de servicio, fecha, hora, dirección, estado actual y enlace para ver el estado.
3. Se crea un registro en la tabla `notificaciones` (in-app).
4. El usuario ve la campana con un contador.

## Salidas

| Escenario          | Código HTTP | Respuesta                                           |
| ------------------ | ----------- | --------------------------------------------------- |
| Confirmación enviada | 200 (tras creación) | No se devuelve explícitamente; es un efecto secundario |

## Endpoints asociados

| Método | Ruta                       | Auth | Descripción                       |
| ------ | -------------------------- | ---- | --------------------------------- |
| (automático) | - | - | Disparado tras `POST /citas` |

## Reglas de negocio

- **RN-019:** El correo debe ser responsivo y tener el diseño de Neodomus.
- **RN-020:** Si el envío de correo falla, se debe registrar en logs y reintentar hasta 3 veces.