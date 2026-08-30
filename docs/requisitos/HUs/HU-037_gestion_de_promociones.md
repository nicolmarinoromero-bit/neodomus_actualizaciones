# HU-037 — Creación de promociones o descuentos especiales

<!--
  ¿Qué? El administrador puede crear promociones.
  ¿Para qué? Atraer más usuarios a la plataforma.
  ¿Impacto? Aumenta las ventas y la fidelización.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-037                                               |
| **Título**       | Creación de promociones o descuentos especiales      |
| **Módulo**       | Administrador                                        |
| **Prioridad**    | Media                                                |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-038                                               |

## Historia

**Como** administrador,  
**quiero** crear promociones o descuentos especiales (porcentaje o monto fijo) aplicables a servicios específicos, categorías o todo el catálogo,  
**para** atraer más usuarios y fidelizar clientes.

## Criterios de aceptación

### CA-037.1 — Pantalla de promociones
- **Dado que** estoy en `/admin/promociones`,
- **cuando** veo la lista de promociones activas y pasadas,
- **entonces** tengo un botón "Crear promoción".

### CA-037.2 — Crear promoción
- **Dado que** hago clic en "Crear promoción",
- **cuando** se abre el formulario,
- **entonces** debo especificar:
  - Nombre de la promoción
  - Tipo: porcentaje o monto fijo
  - Valor (ej. 15% o $5000)
  - Aplicable a: servicio específico, categoría, o todo
  - Fecha de inicio y fecha de fin

### CA-037.3 — Validación de superposición
- **Dado que** creo una promoción que se solapa con otra activa para el mismo servicio/categoría,
- **cuando** intento guardar,
- **entonces** el sistema muestra: "Ya existe una promoción activa para este elemento en ese período".

### CA-037.4 — Aplicación automática
- **Dado que** la promoción está activa,
- **cuando** un usuario ve el catálogo,
- **entonces** el precio del servicio se muestra con descuento y se indica la promoción.

### CA-037.5 — Editar y eliminar promociones
- **Dado que** puedo editar una promoción (cambiar fechas, valor) o eliminarla,
- **cuando** lo hago,
- **entonces** los cambios surten efecto inmediatamente.