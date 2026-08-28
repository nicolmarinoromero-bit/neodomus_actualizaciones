# RF-016 — Historial de servicios anteriores

<!--
  ¿Qué? El usuario puede consultar sus servicios completados anteriormente.
  ¿Para qué? Ver qué técnicos lo han atendido y repetir servicios fácilmente.
  ¿Impacto? Fidelización y facilidad para contratar nuevamente.
-->

## Identificación

| Campo         | Valor                                  |
| ------------- | -------------------------------------- |
| **ID**        | RF-016                                 |
| **Nombre**    | Historial de servicios anteriores      |
| **Módulo**    | Servicios (Citas)                      |
| **Prioridad** | Media                                  |
| **Estado**    | Propuesta                              |
| **Fecha**     | Mayo 2026                              |

## Descripción

El sistema debe permitir al usuario consultar su historial de servicios anteriores (estado `completada` o `cancelada`) con opción de volver a contratar el mismo servicio.

## Entradas

| Parámetro | Tipo   | Obligatorio | Descripción                 |
| --------- | ------ | ----------- | --------------------------- |
| `fecha_desde` | date | No          | Filtro por fecha de inicio   |
| `fecha_hasta` | date | No          | Filtro por fecha de fin      |

## Proceso

1. Usuario accede a `/historial-servicios`.
2. Backend consulta citas con estado `completada` o `cancelada` del usuario, ordenadas por fecha descendente.
3. Retorna lista paginada.
4. En cada ítem, se muestra un botón "Contratar de nuevo" que redirige al formulario de solicitud con datos precargados.

## Salidas

```json
{
  "historial": [
    {
      "id": 101,
      "servicio_nombre": "Instalación",
      "fecha": "2026-05-10",
      "tecnico_nombre": "Juan Técnico",
      "calificacion": 5
    }
  ]
}
Endpoints asociados
Método	Ruta	Auth	Descripción
GET	/api/v1/citas/historial	Sí	Lista las citas finalizadas del usuario
Reglas de negocio
RN-039: El historial incluye solo servicios completados o cancelados (no pendientes/confirmados).

RN-040: Al hacer clic en "Contratar de nuevo", se redirige a /servicios/{id}/solicitar con la dirección precargada del perfil.