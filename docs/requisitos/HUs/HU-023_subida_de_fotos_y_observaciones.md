# HU-023 — Subida de fotos y observaciones al finalizar un servicio

<!--
  ¿Qué? El técnico puede adjuntar evidencias fotográficas y observaciones.
  ¿Para qué? Dejar constancia visual del trabajo realizado.
  ¿Impacto? Transparencia y calidad del servicio.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-023                                               |
| **Título**       | Subida de fotos y observaciones al finalizar un servicio |
| **Módulo**       | Técnico                                              |
| **Prioridad**    | Media                                                |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-024                                               |

## Historia

**Como** técnico autenticado,  
**quiero** subir fotos (evidencias) y observaciones después de finalizar un servicio,  
**para** dejar constancia de mi trabajo y que el cliente/administrador pueda verificar.

## Criterios de aceptación

### CA-023.1 — Sección de evidencias
- **Dado que** estoy en el detalle de una tarea en estado `en_progreso`,
- **cuando** veo la página,
- **entonces** encuentro un área para subir fotos (drag & drop o selector de archivos) y un campo de texto para observaciones.

### CA-023.2 — Subida de fotos
- **Dado que** selecciono hasta 5 archivos de imagen (JPG, PNG, máximo 5MB cada uno),
- **cuando** hago clic en "Subir evidencias",
- **entonces** las imágenes se cargan al servidor y se muestran en una galería previa.

### CA-023.3 — Obligatoriedad de al menos una foto
- **Dado que** intento marcar la tarea como `completado` sin haber subido ninguna foto,
- **cuando** lo intento,
- **entonces** el sistema me lo impide con el mensaje: "Debes subir al menos una foto antes de completar".

### CA-023.4 — Observaciones escritas
- **Dado que** escribo observaciones (máximo 500 caracteres),
- **cuando** guardo las evidencias,
- **entonces** el texto se almacena junto con las URLs de las fotos.

### CA-023.5 — Visualización por el cliente
- **Dado que** el servicio está `completado`,
- **cuando** el cliente accede al detalle de su cita,
- **entonces** puede ver las fotos (en modo solo lectura) y mis observaciones.

### CA-023.6 — Seguridad de las fotos
- **Dado que** intento acceder a las fotos de un servicio que no me corresponde,
- **cuando** lo hago (mediante URL directa),
- **entonces** el sistema deniega el acceso (403 o redirección a login).