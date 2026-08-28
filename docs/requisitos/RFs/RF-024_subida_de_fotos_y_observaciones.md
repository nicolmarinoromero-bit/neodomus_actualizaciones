# RF-024 — Subida de fotos y observaciones

<!--
  ¿Qué? El técnico puede subir evidencias fotográficas y comentarios al finalizar un servicio.
  ¿Para qué? Dejar constancia visual del trabajo realizado.
  ¿Impacto? Transparencia y calidad del servicio.
-->

## Identificación

| Campo         | Valor                                    |
| ------------- | ---------------------------------------- |
| **ID**        | RF-024                                   |
| **Nombre**    | Subida de fotos y observaciones          |
| **Módulo**    | Técnico                                  |
| **Prioridad** | Media                                    |
| **Estado**    | Propuesta                                |
| **Fecha**     | Mayo 2026                                |

## Descripción

El sistema debe permitir al técnico subir fotos (evidencias) y observaciones escritas después de finalizar un servicio, antes de marcarlo como `completado`. Las fotos se almacenan en un servicio de almacenamiento (Supabase Storage o similar) con políticas de acceso restringido.

## Entradas

| Campo          | Tipo            | Obligatorio | Validaciones                          |
| -------------- | --------------- | ----------- | ------------------------------------- |
| `fotos`        | archivos (multipart) | Sí (al menos una) | JPG, PNG, máximo 5MB c/u, hasta 5 archivos |
| `observaciones`| string          | No          | Máximo 500 caracteres                 |

## Proceso

1. El técnico accede al detalle de la tarea en estado `en_progreso`.
2. Ve un área para subir fotos (drag & drop o selector de archivos) y un campo de texto.
3. Selecciona las fotos, escribe observaciones y hace clic en "Guardar evidencias".
4. El backend recibe los archivos, los valida (tamaño, formato) y los sube al almacenamiento.
5. Las URLs de las fotos se guardan en la tabla `evidencias` (o en un campo JSON de `citas`).
6. Las observaciones se guardan en la tabla `citas` (campo `observaciones_tecnico`).
7. El técnico puede entonces marcar la tarea como `completada` (RF-023).

## Salidas

| Escenario                     | Código HTTP | Respuesta                                |
| ----------------------------- | ----------- | ---------------------------------------- |
| Evidencias guardadas          | 200         | `"Fotos y observaciones guardadas"`      |
| Formato de archivo inválido   | 400         | `"Solo se permiten archivos JPG o PNG"`  |
| Tamaño excedido               | 400         | `"Cada foto no puede superar los 5MB"`   |

## Endpoints asociados

| Método | Ruta                                 | Auth | Descripción                          |
| ------ | ------------------------------------ | ---- | ------------------------------------ |
| POST   | `/api/v1/tech/tarea/{id}/evidencias` | Sí   | Sube fotos y observaciones           |

## Reglas de negocio

- **RN-058:** Las fotos no son visibles públicamente; solo el usuario de la cita, el técnico y el administrador pueden verlas.
- **RN-059:** Las observaciones del técnico se diferencian de los comentarios del usuario en la interfaz.