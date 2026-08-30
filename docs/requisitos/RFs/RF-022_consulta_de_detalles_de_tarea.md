
---

## RF-022_consulta_de_detalles_de_tarea.md

```markdown
# RF-022 — Consulta de detalles de la tarea asignada

<!--
  ¿Qué? El técnico puede ver toda la información de una tarea específica.
  ¿Para qué? Prepararse con las herramientas necesarias y ubicar al cliente.
  ¿Impacto? Mejora la eficiencia y la calidad del servicio.
-->

## Identificación

| Campo         | Valor                                |
| ------------- | ------------------------------------ |
| **ID**        | RF-022                               |
| **Nombre**    | Consulta de detalles de la tarea asignada |
| **Módulo**    | Técnico                              |
| **Prioridad** | Alta                                 |
| **Estado**    | Propuesta                            |
| **Fecha**     | Mayo 2026                            |

## Descripción

El sistema debe permitir al técnico consultar los detalles completos del servicio asignado: tipo de servicio, datos del cliente, dirección, fecha, hora, comentarios del usuario y geolocalización (si está disponible).

## Entradas

| Parámetro | Tipo | Obligatorio | Descripción          |
| --------- | ---- | ----------- | -------------------- |
| `id`      | int  | Sí          | ID de la tarea (cita)|

## Proceso

1. El técnico hace clic en una tarea desde la lista.
2. Navega a `/tech/tarea/{id}`.
3. El backend verifica que la tarea pertenezca al técnico autenticado.
4. Retorna todos los campos de la cita, incluyendo datos del cliente (nombre, teléfono).
5. Si la dirección tiene coordenadas, se muestra un mapa con un marcador.
6. Se incluye un botón "Cómo llegar" que abre Google Maps/Waze con la ubicación.

## Salidas

```json
{
  "id": 101,
  "cliente": {
    "nombre": "Carlos Gómez",
    "telefono": "+5491122334455"
  },
  "direccion": "Av. Siempreviva 742",
  "latitud": -34.6037,
  "longitud": -58.3816,
  "fecha": "2026-06-15",
  "hora": "10:00:00",
  "servicio_nombre": "Instalación domótica",
  "comentarios_usuario": "Timbre roto, tocar el timbre",
  "estado": "pendiente"
}
Endpoints asociados
Método	Ruta	Auth	Descripción
GET	/api/v1/tech/tarea/{id}	Sí	Obtiene el detalle completo de la tarea
Reglas de negocio
RN-053: El técnico solo puede acceder a sus propias tareas (403 si no es el asignado).

RN-054: El número de teléfono del cliente se muestra para que el técnico pueda contactarlo si es necesario.