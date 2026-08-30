# HU-007 — Visualización del catálogo de servicios

<!--
  ¿Qué? El usuario ve los servicios domóticos disponibles.
  ¿Para qué? Conocer las opciones antes de contratar.
  ¿Impacto? Es el punto de partida para solicitar un servicio.
-->

## Identificación

| Campo            | Valor                              |
| ---------------- | ---------------------------------- |
| **ID**           | HU-007                             |
| **Título**       | Visualización del catálogo de servicios |
| **Módulo**       | Catálogo                           |
| **Prioridad**    | Alta                               |
| **Estado**       | Propuesta                          |
| **RF asociados** | RF-005, RF-006                     |

## Historia

**Como** usuario (puedo estar autenticado o ser visitante),  
**quiero** ver un catálogo de servicios domóticos (instalación, mantenimiento, automatización, asesorías),  
**para** conocer todas las opciones antes de decidir cuál contratar.

## Criterios de aceptación

### CA-007.1 — Página de catálogo
- **Dado que** accedo a la página principal (`/`) o a `/servicios`,
- **cuando** se carga la página,
- **entonces** veo una lista de tarjetas con servicios, mostrando al menos: nombre, imagen (si existe), precio base y categoría.

### CA-007.2 — Paginación o scroll infinito
- **Dado que** hay más de 20 servicios en el catálogo,
- **cuando** desplazo hacia abajo o uso los botones de paginación,
- **entonces** se cargan más servicios sin recargar la página completa.

### CA-007.3 — Filtro por categoría
- **Dado que** selecciono una categoría (instalación, mantenimiento, automatización, asesoría) en un desplegable,
- **cuando** aplico el filtro,
- **entonces** la lista se actualiza mostrando solo servicios de esa categoría.

### CA-007.4 — Búsqueda por texto
- **Dado que** escribo un término en el campo de búsqueda (ej. "domótica"),
- **cuando** presiono "Buscar",
- **entonces** se muestran servicios cuyo nombre o descripción contengan el término.

### CA-007.5 — Ver detalle
- **Dado que** hago clic en una tarjeta de servicio,
- **cuando** navego a su página de detalle (`/servicios/{id}`),
- **entonces** veo toda la información: descripción larga, duración estimada, requisitos previos, promociones activas y el precio final.

### CA-007.6 — Indicador de carga
- **Dado que** los datos están cargando,
- **cuando** espero,
- **entonces** veo un spinner o skeleton (esqueletos de carga).

### CA-007.7 — Manejo de errores
- **Dado que** ocurre un error al consultar el catálogo (ej. servidor caído),
- **cuando** el sistema detecta el error,
- **entonces** muestra un mensaje amigable y un botón para reintentar.