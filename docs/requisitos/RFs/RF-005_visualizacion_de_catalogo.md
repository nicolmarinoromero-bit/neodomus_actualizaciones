# RF-005 — Visualización del catálogo de servicios

<!--
  ¿Qué? El usuario debe poder ver la lista de servicios domóticos disponibles.
  ¿Para qué? Conocer las opciones antes de contratar.
  ¿Impacto? Es la puerta de entrada al negocio.
-->

## Identificación

| Campo         | Valor                                |
| ------------- | ------------------------------------ |
| **ID**        | RF-005                               |
| **Nombre**    | Visualización del catálogo de servicios |
| **Módulo**    | Catálogo                             |
| **Prioridad** | Alta                                 |
| **Estado**    | Propuesta                            |
| **Fecha**     | Mayo 2026                            |

## Descripción

El sistema debe mostrar al usuario (autenticado o no) el catálogo de servicios domóticos disponibles, con paginación, filtros por categoría y búsqueda por texto.

## Entradas

| Parámetro   | Tipo   | Obligatorio | Descripción                    |
| ----------- | ------ | ----------- | ------------------------------ |
| `categoria` | string | No          | `instalacion`, `mantenimiento`, `automatizacion`, `asesoria` |
| `buscar`    | string | No          | Texto a buscar en nombre/descripción |
| `page`      | int    | No          | Número de página (default 1)   |
| `per_page`  | int    | No          | Elementos por página (default 20, max 50) |

## Proceso

1. El cliente (o visitante) accede a `/servicios` con parámetros opcionales.
2. El backend consulta la tabla `servicios` con filtros, paginación y orden.
3. Retorna la lista de servicios con sus campos básicos.
4. El frontend renderiza las tarjetas.

## Salidas

```json
{
  "data": [
    {
      "id": 1,
      "nombre": "Instalación de domótica",
      "precio": 25000.00,
      "categoria": "instalacion",
      "imagen_url": "..."
    }
  ],
  "total": 15,
  "page": 1,
  "per_page": 20
}
Endpoints asociados
Método	Ruta	Auth	Descripción
GET	/api/v1/servicios	Opcional	Lista paginada del catálogo
GET	/api/v1/servicios/{id}	Opcional	Detalle de un servicio específico
Reglas de negocio
RN-013: El catálogo es público (no requiere autenticación) para atraer clientes.

RN-014: Solo se muestran servicios con is_active = true.
