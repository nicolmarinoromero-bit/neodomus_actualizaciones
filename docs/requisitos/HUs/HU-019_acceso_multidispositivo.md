# HU-019 — Acceso desde cualquier dispositivo (móvil, tablet, PC)

<!--
  ¿Qué? La plataforma es responsiva y funciona en distintos dispositivos.
  ¿Para qué? Usar el sistema desde cualquier lugar.
  ¿Impacto? Mayor alcance y comodidad.
-->

## Identificación

| Campo            | Valor                                        |
| ---------------- | -------------------------------------------- |
| **ID**           | HU-019                                       |
| **Título**       | Acceso desde cualquier dispositivo           |
| **Módulo**       | Frontend / UX                                |
| **Prioridad**    | Alta                                         |
| **Estado**       | Propuesta                                    |
| **RF asociados** | RF-019                                       |

## Historia

**Como** usuario,  
**quiero** acceder a la plataforma desde cualquier dispositivo (móvil, tablet o computador),  
**para** usar el sistema desde casa, el trabajo o mientras viajo.

## Criterios de aceptación

### CA-019.1 — Diseño responsivo en móvil
- **Dado que** accedo desde un smartphone (ancho de pantalla ≤ 480px),
- **cuando** la página se carga,
- **entonces** la interfaz se reorganiza en una columna, el menú se colapsa en un botón hamburguesa, y los botones tienen un tamaño táctil mínimo de 44×44px.

### CA-019.2 — Tablet (≥ 768px)
- **Dado que** accedo desde una tablet,
- **cuando** la página se carga,
- **entonces** se aprovecha el espacio mostrando dos columnas en el catálogo y la barra lateral colapsable.

### CA-019.3 — Escritorio (≥ 1024px)
- **Dado que** accedo desde un computador,
- **cuando** la página se carga,
- **entonces** veo la barra lateral fija, múltiples columnas y soporte de navegación por teclado (TAB, ENTER).

### CA-019.4 — Mapa del técnico en móvil
- **Dado que** soy técnico y accedo desde un móvil,
- **cuando** voy a `/tech/mapa`,
- **entonces** el mapa es táctil (pinch zoom, arrastre) y los marcadores se pueden seleccionar con un toque.

### CA-019.5 — Funcionalidad completa en todos los dispositivos
- **Dado que** cambio de dispositivo,
- **cuando** utilizo la misma cuenta,
- **entonces** todas las funcionalidades (solicitar servicio, pagar, chatear, mapa, panel de admin) están disponibles y funcionan correctamente.