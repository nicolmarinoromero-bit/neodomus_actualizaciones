# HU-021 — Consulta de detalles de la tarea asignada (técnico)

<!--
  ¿Qué? El técnico puede ver toda la información de una tarea específica.
  ¿Para qué? Prepararse con las herramientas necesarias y ubicar al cliente.
  ¿Impacto? Mejora la eficiencia y la calidad del servicio.
-->

## Identificación

| Campo            | Valor                                          |
| ---------------- | ---------------------------------------------- |
| **ID**           | HU-021                                         |
| **Título**       | Consulta de detalles de la tarea asignada      |
| **Módulo**       | Técnico                                        |
| **Prioridad**    | Alta                                           |
| **Estado**       | Propuesta                                      |
| **RF asociados** | RF-022                                         |

## Historia

**Como** técnico autenticado,  
**quiero** consultar los detalles completos del servicio asignado (cliente, dirección, fecha, hora, tipo de trabajo, comentarios),  
**para** prepararme con las herramientas necesarias y saber a dónde dirigirme.

## Criterios de aceptación

### CA-021.1 — Acceso al detalle
- **Dado que** estoy en la lista de mis tareas (`/tech/mis-tareas`),
- **cuando** hago clic en una tarea,
- **entonces** navego a `/tech/tarea/{id}` donde veo toda la información.

### CA-021.2 — Datos del cliente
- **Dado que** estoy en el detalle,
- **cuando** reviso la sección "Cliente",
- **entonces** veo: nombre, teléfono y dirección completa.

### CA-021.3 — Geolocalización y mapa
- **Dado que** la dirección tiene coordenadas geográficas (lat, lng),
- **cuando** veo el detalle,
- **entonces** aparece un mapa pequeño (Leaflet) con un marcador en la ubicación, y un botón "Cómo llegar" que abre Google Maps/Waze con la ruta.

### CA-021.4 — Comentarios del usuario
- **Dado que** el usuario dejó comentarios adicionales al solicitar el servicio,
- **cuando** veo la sección "Comentarios del cliente",
- **entonces** los leo para estar atento a detalles especiales (ej. "timbre roto", "portón con perro").

### CA-021.5 — Historial de cambios (opcional)
- **Dado que** hubo cambios de estado previos,
- **cuando** veo la línea de tiempo,
- **entonces** sé cuándo fue asignada la tarea y cuándo cambió a `en_progreso` (si aplica).