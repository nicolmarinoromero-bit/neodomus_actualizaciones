# RF-025 — Visualización de calificaciones y comentarios del técnico

<!--
  ¿Qué? El técnico puede ver las calificaciones que los usuarios le han dejado.
  ¿Para qué? Conocer su nivel de desempeño y mejorar.
  ¿Impacto? Retroalimentación para la mejora continua.
-->

## Identificación

| Campo         | Valor                                              |
| ------------- | -------------------------------------------------- |
| **ID**        | RF-025                                             |
| **Nombre**    | Visualización de calificaciones y comentarios del técnico |
| **Módulo**    | Técnico                                            |
| **Prioridad** | Media                                              |
| **Estado**    | Propuesta                                          |
| **Fecha**     | Mayo 2026                                          |

## Descripción

El sistema debe permitir al técnico visualizar las calificaciones y comentarios recibidos por los usuarios, así como su calificación promedio.

## Entradas

| Parámetro | Tipo   | Obligatorio | Descripción               |
| --------- | ------ | ----------- | ------------------------- |
| `page`    | int    | No          | Página para paginación    |

## Proceso

1. El técnico accede a `/tech/mis-calificaciones`.
2. El backend consulta la tabla `calificaciones` donde `tecnico_id = current_user.id`.
3. Calcula el promedio y el total de calificaciones.
4. Retorna la lista paginada, ordenada por fecha descendente.
5. El frontend muestra el promedio con estrellas y cada calificación con: nombre del usuario (parcial), puntuación, comentario, fecha.

## Salidas

```json
{
  "promedio": 4.8,
  "total": 12,
  "calificaciones": [
    {
      "usuario_nombre": "Carlos G.",
      "puntuacion": 5,
      "comentario": "Excelente trabajo",
      "fecha": "2026-05-20"
    }
  ]
}
Endpoints asociados
Método	Ruta	Auth	Descripción
GET	/api/v1/tech/mis-calificaciones	Sí	Lista las calificaciones del técnico
Reglas de negocio
RN-060: El nombre del usuario se muestra parcialmente (primer nombre + inicial del apellido) para proteger su privacidad.

RN-061: El técnico puede reportar un comentario inapropiado al administrador.