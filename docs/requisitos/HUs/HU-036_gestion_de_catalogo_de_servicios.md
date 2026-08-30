# HU-036 — Gestión del catálogo de servicios (administrador)

<!--
  ¿Qué? El administrador puede crear, editar o eliminar servicios.
  ¿Para qué? Mantener actualizada la oferta del sistema.
  ¿Impacto? Permite lanzar nuevos servicios o retirar los obsoletos.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-036                                               |
| **Título**       | Gestión del catálogo de servicios                    |
| **Módulo**       | Administrador                                        |
| **Prioridad**    | Alta                                                 |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-037                                               |

## Historia

**Como** administrador,  
**quiero** crear, editar o eliminar servicios del catálogo,  
**para** mantener actualizada la oferta de servicios domóticos que ofrecemos.

## Criterios de aceptación

### CA-036.1 — Lista de servicios (admin)
- **Dado que** estoy en `/admin/servicios/catalogo`,
- **cuando** veo la lista,
- **entonces** cada servicio tiene botones: "Editar", "Eliminar" (o "Desactivar").

### CA-036.2 — Crear nuevo servicio
- **Dado que** hago clic en "Nuevo servicio",
- **cuando** se abre un formulario,
- **entonces** debo ingresar: nombre, descripción corta, descripción larga, precio, duración estimada, categoría, imagen (opcional).

### CA-036.3 — Editar servicio
- **Dado que** modifico un servicio existente,
- **cuando** guardo los cambios,
- **entonces** el catálogo se actualiza inmediatamente para los usuarios.

### CA-036.4 — Eliminar servicio
- **Dado que** intento eliminar un servicio que tiene citas asociadas (pasadas o futuras),
- **cuando** lo intento,
- **entonces** el sistema me muestra un error: "No se puede eliminar: tiene citas asociadas. En su lugar, desactívelo".

### CA-036.5 — Desactivar servicio
- **Dado que** desmarcó la casilla "Activo" en la edición,
- **cuando** guardo,
- **entonces** el servicio ya no aparece en el catálogo público, pero las citas existentes se mantienen.