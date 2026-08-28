# RF-013 — Calificación del servicio

<!--
  ¿Qué? El usuario puede calificar el servicio recibido.
  ¿Para qué? Contribuir a la reputación del técnico y la plataforma.
  ¿Impacto? Mejora la calidad del servicio y la confianza.
-->

## Identificación

| Campo         | Valor                         |
| ------------- | ----------------------------- |
| **ID**        | RF-013                        |
| **Nombre**    | Calificación del servicio     |
| **Módulo**    | Calificaciones                |
| **Prioridad** | Media                         |
| **Estado**    | Propuesta                     |
| **Fecha**     | Mayo 2026                     |

## Descripción

El sistema debe permitir al usuario calificar el servicio recibido (1 a 5 estrellas) y dejar un comentario opcional después de que la cita haya sido marcada como `completada`.

## Entradas

| Campo         | Tipo   | Obligatorio | Validaciones                        |
| ------------- | ------ | ----------- | ----------------------------------- |
| `cita_id`     | int    | Sí          | Debe existir y estar `completada`   |
| `puntuacion`  | int    | Sí          | 1 ≤ valor ≤ 5                       |
| `comentario`  | string | No          | Máximo 500 caracteres               |

## Proceso

1. Usuario accede a una cita completada en `/mis-servicios` y hace clic en "Calificar".
2. Se muestra un modal con estrellas y campo de comentario.
3. Usuario selecciona puntuación y envía.
4. Backend verifica que la cita esté `completada` y que no tenga calificación previa.
5. Guarda la calificación en tabla `calificaciones` y actualiza el promedio del técnico en la tabla `tecnicos`.
6. Notifica al técnico que recibió una nueva calificación.

## Salidas

| Escenario                     | Código HTTP | Respuesta                         |
| ----------------------------- | ----------- | --------------------------------- |
| Calificación guardada         | 201         | `"Calificación registrada"`       |
| Servicio no completado        | 400         | `"El servicio debe estar completado para calificar"` |
| Ya calificado                 | 400         | `"Ya calificaste este servicio"`  |

## Endpoints asociados

| Método | Ruta                         | Auth | Descripción                    |
| ------ | ---------------------------- | ---- | ------------------------------ |
| POST   | `/api/v1/calificaciones`     | Sí   | Registra una calificación      |
| GET    | `/api/v1/tecnicos/{id}/calificaciones` | Sí | Lista calificaciones de un técnico |

## Reglas de negocio

- **RN-031:** Solo una calificación por cita.
- **RN-032:** La calificación promedio del técnico se actualiza automáticamente.
- **RN-033:** El comentario puede ser editado por el administrador si es ofensivo.