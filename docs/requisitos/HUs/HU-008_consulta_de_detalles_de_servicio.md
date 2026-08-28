# HU-008 — Consulta de detalles de servicio

<!--
  ¿Qué? El usuario obtiene información completa de un servicio específico.
  ¿Para qué? Tomar una decisión informada antes de contratar.
  ¿Impacto? Reduce dudas y posibles reclamaciones.
-->

## Identificación

| Campo            | Valor                                      |
| ---------------- | ------------------------------------------ |
| **ID**           | HU-008                                     |
| **Título**       | Consulta de detalles de servicio           |
| **Módulo**       | Catálogo                                   |
| **Prioridad**    | Alta                                       |
| **Estado**       | Propuesta                                  |
| **RF asociados** | RF-006                                     |

## Historia

**Como** usuario,  
**quiero** consultar el precio, la descripción detallada, la duración estimada y las promociones de cada servicio,  
**para** tomar una decisión informada antes de contratar.

## Criterios de aceptación

### CA-008.1 — Pantalla de detalle
- **Dado que** estoy en la página de detalle de un servicio (`/servicios/{id}`),
- **cuando** se carga,
- **entonces** veo:
  - Nombre del servicio
  - Descripción larga (puede incluir fotos)
  - Precio base y, si aplica, precio con descuento
  - Duración estimada (ej. "2 horas" o "90 minutos")
  - Categoría
  - Lista de requisitos previos (si los hay)
  - Un botón "Solicitar este servicio"

### CA-008.2 — Promociones activas
- **Dado que** el servicio tiene una promoción vigente,
- **cuando** veo el detalle,
- **entonces** se muestra claramente el descuento (ej. "15% OFF") y el precio final.

### CA-008.3 — Sin promoción
- **Dado que** el servicio no tiene promoción,
- **cuando** veo el detalle,
- **entonces** solo se muestra el precio base.

### CA-008.4 — Botón de solicitud solo para autenticados
- **Dado que** no he iniciado sesión,
- **cuando** veo la página de detalle,
- **entonces** el botón "Solicitar este servicio" me redirige a la página de login (`/login`) con un mensaje "Debes iniciar sesión para contratar".

### CA-008.5 — Servicio no encontrado
- **Dado que** intento acceder a un servicio con un ID que no existe,
- **cuando** entro a la URL,
- **entonces** veo una página personalizada de "Servicio no encontrado" (404) y un enlace para volver al catálogo.