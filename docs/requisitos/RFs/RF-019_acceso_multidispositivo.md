# RF-019 — Acceso multidispositivo

<!--
  ¿Qué? La plataforma debe ser accesible desde móviles, tablets y computadores.
  ¿Para qué? Usar el sistema desde cualquier lugar.
  ¿Impacto? Mayor alcance y comodidad.
-->

## Identificación

| Campo         | Valor                            |
| ------------- | -------------------------------- |
| **ID**        | RF-019                           |
| **Nombre**    | Acceso multidispositivo          |
| **Módulo**    | Frontend / UX                    |
| **Prioridad** | Alta                             |
| **Estado**    | Propuesta                        |
| **Fecha**     | Mayo 2026                        |

## Descripción

El sistema debe ser completamente responsivo, adaptándose a diferentes tamaños de pantalla: móviles (320px - 480px), tablets (768px - 1024px) y escritorio (≥1024px). Todas las funcionalidades deben estar disponibles en todos los dispositivos.

## Entradas

| Dispositivo | Resolución típica | Comportamiento esperado              |
| ----------- | ----------------- | ------------------------------------ |
| Móvil       | 320-480px         | Menú hamburguesa, elementos en columna, botones táctiles grandes |
| Tablet      | 768-1024px        | Dos columnas, barra lateral colapsable |
| Escritorio  | ≥1024px           | Barra lateral fija, múltiples columnas, soporte de teclado |

## Proceso

1. El frontend utiliza CSS Grid y Flexbox con media queries.
2. Las tablas en móvil se transforman en tarjetas.
3. El mapa de técnicos (Leaflet) es táctil y permite pinch zoom.
4. Los componentes (modales, alertas) se ajustan al 90% del ancho de la pantalla en móvil.

## Salidas

No aplica código de respuesta específico; es un atributo de calidad del frontend.

## Reglas de negocio

- **RN-045:** El tamaño táctil mínimo de los botones debe ser 44×44 px.
- **RN-046:** No se pierde ninguna funcionalidad al cambiar de dispositivo (ej. el mapa del técnico debe funcionar en móvil).