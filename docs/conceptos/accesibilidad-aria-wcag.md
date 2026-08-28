# Accesibilidad Web — ARIA y WCAG para Neodomus

<!--
  ¿Qué? Documento pedagógico sobre estándares de accesibilidad web aplicados
        en Neodomus: WCAG 2.1 y ARIA (Accessible Rich Internet Applications).
  ¿Para qué? Explicar qué es la accesibilidad, por qué importa, y documentar
             exactamente cómo se implementó cada patrón en el código del proyecto.
  ¿Impacto? Una app inaccesible excluye a personas con discapacidades visuales,
             motrices o cognitivas. La accesibilidad no es opcional — en muchos
             países es un requisito legal (ADA en EE.UU., directiva EU 2016/2102).
-->

> **Estándar de referencia**: [WCAG 2.1 — W3C](https://www.w3.org/TR/WCAG21/)  
> **Especificación ARIA**: [WAI-ARIA 1.2 — W3C](https://www.w3.org/TR/wai-aria-1.2/)

---

## ¿Qué es la Accesibilidad Web?

La accesibilidad web garantiza que **todas las personas** puedan usar aplicaciones web,
independientemente de sus capacidades. Esto incluye personas que:

- Usan **lectores de pantalla** (NVDA, VoiceOver, JAWS) por discapacidad visual
- Navegan **solo con teclado** (sin ratón) por limitaciones motrices
- Tienen **daltonismo** y no pueden distinguir colores como información
- Usan **software de amplificación** por baja visión
- Tienen **dislexia** u otras diferencias cognitivas

### Los 4 principios WCAG — POUR

| Principio          | Descripción                                                       | Ejemplo                                         |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------------- |
| **P**erceptible    | La info debe presentarse de forma que el usuario pueda percibirla | Alt text en imágenes, contraste de colores      |
| **O**perable       | Los componentes deben ser operables por el usuario                | Navegación por teclado, sin trampas de foco     |
| **U**nderstandable | La información y UI deben ser comprensibles                       | Labels en formularios, mensajes de error claros |
| **R**obust         | El contenido debe interpretarse por tecnologías asistivas         | HTML semántico, ARIA roles                      |

---

## Niveles de Conformidad WCAG

| Nivel   | Descripción                                                            | Ejemplos de criterios                            |
| ------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| **A**   | Requisito mínimo — sin esto, el contenido es completamente inaccesible | Alternativas textuales (1.1.1), teclado (2.1.1)  |
| **AA**  | Estándar recomendado para la mayoría de sitios                         | Contraste 4.5:1 (1.4.3), reflow (1.4.10)         |
| **AAA** | Máxima accesibilidad — difícil de cumplir en todos los contenidos      | Contraste 7:1 (1.4.6), lenguaje de señas (1.2.6) |

> **Objetivo de Neodomus**: Conformidad **WCAG 2.1 AA** — nivel exigido por regulaciones y tiendas de aplicaciones.

---

## ¿Qué es ARIA?

**ARIA** (Accessible Rich Internet Applications) añade semántica adicional al HTML para describir comportamientos interactivos que HTML nativo no puede expresar.

```html
<!-- HTML nativo — el navegador ya sabe que esto es un botón -->
<button>Solicitar servicio</button>

<!-- ARIA necesario — un div actuando como botón necesita rol explícito -->
<div role="button" tabindex="0" onclick="...">Solicitar servicio</div>

<!-- ARIA para estado dinámico — no existe en HTML nativo -->
<div role="status" aria-busy="true">Cargando técnicos...</div>
<input aria-invalid="true" aria-describedby="fecha-error" />

Regla de oro: Primero HTML semántico
Usar ARIA solo cuando HTML nativo no es suficiente.
<button> es mejor que <div role="button">.
<main> es mejor que <div role="main">.

Estado de Accesibilidad — Neodomus (Módulos clave)
Resumen por componente
Componente / Página	Nivel	Criterios WCAG cumplidos
InputField.tsx (registro/login)	✅ AA+	1.1.1, 1.3.1, 3.3.1, 3.3.2, 4.1.2
Button.tsx (general)	✅ AA	4.1.2, 4.1.3
ServiceCard.tsx (catálogo)	✅ AA	1.1.1, 2.4.7
BookingForm.tsx (solicitud)	✅ AA+	1.3.1, 3.3.1, 4.1.2
PaymentCheckout.tsx	✅ AA	1.4.1, 2.4.6, 4.1.2
TechTaskMap.tsx (mapa de técnico)	✅ AA	1.1.1, 1.4.1, 2.1.1, 2.4.8
ChatWindow.tsx	✅ AA	1.3.1, 2.4.3, 4.1.2
NotificationBell.tsx	✅ AA	1.1.1, 2.4.1, 4.1.3
AdminTable.tsx (gestión de usuarios)	✅ AA+	1.3.1, 2.4.3, 2.4.6, 4.1.2
RatingStars.tsx (calificaciones)	✅ AA	1.4.1, 4.1.2
DashboardMetrics.tsx (admin)	✅ AA	1.4.1, 2.4.6
Implementaciones por criterio WCAG
WCAG 1.1.1 — Non-text Content (Nivel A)
¿Qué? Todo contenido no textual debe tener una alternativa textual.

Ejemplo en ServiceCard.tsx (imagen del servicio):

tsx

<img
  src={service.imageUrl}
  alt={`Imagen del servicio: ${service.name}`} // ✅ alt descriptivo
  className="w-full h-32 object-cover"
/>

Ejemplo en RatingStars.tsx (estrellas decorativas):
<div className="flex" aria-label={`Calificación: ${rating} de 5 estrellas`}>
  {[...Array(5)].map((_, i) => (
    <StarIcon
      key={i}
      className={i < rating ? "text-yellow-500" : "text-gray-300"}
      aria-hidden="true" // ✅ oculto porque el label ya comunica el valor
    />
  ))}
</div>

Regla práctica: Un ícono es decorativo si el texto adyacente ya comunica lo mismo. Necesita aria-hidden="true". Si el ícono es el ÚNICO contenido del botón, necesita aria-label.

WCAG 1.3.1 — Info and Relationships (Nivel A)
¿Qué? La información, estructura y relaciones deben ser determinables programáticamente (ej. lectores de pantalla).

Ejemplo en BookingForm.tsx (campos de fecha/hora):

<div className="mb-4">
  <label htmlFor="fecha" className="block text-sm font-medium">
    Fecha del servicio
  </label>
  <input
    id="fecha"
    type="date"
    aria-required="true"
    aria-describedby="fecha-helper"
  />
  <p id="fecha-helper" className="text-xs text-gray-500">
    La fecha debe ser al menos 24 horas después de hoy.
  </p>
</div>

Jerarquía de encabezados en el Dashboard del técnico:

<h1>Mis tareas</h1>           {/* nivel 1 */}
  <h2>Tareas pendientes</h2>    {/* nivel 2 */}
  <h2>Tareas completadas</h2>   {/* nivel 2 */}

  Los lectores de pantalla permiten saltar entre encabezados (ej. H en NVDA).

WCAG 1.4.1 — Use of Color (Nivel A)
¿Qué? El color no debe ser el ÚNICO medio para transmitir información.

Ejemplo en TechTaskMap.tsx (marcadores de citas vs entregas):

tsx

// ❌ Solo color (rojo para cita, azul para entrega) – inaccesible
<Marker icon={isCita ? redIcon : blueIcon} />

// ✅ Color + símbolo + texto alternativo
<Marker
  icon={isCita ? calendarIcon : packageIcon}
  aria-label={isCita ? "Cita de instalación" : "Entrega de producto"}
/>

Ejemplo en AdminTable.tsx (estado del técnico activo/inactivo):

tsx
<span
  className={tecnico.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
  aria-label={`Estado: ${tecnico.isActive ? "Activo" : "Inactivo"}`}
>
  {tecnico.isActive ? "Activo" : "Inactivo"}
</span>
WCAG 2.1.1 — Keyboard (Nivel A)
¿Qué? Toda la funcionalidad debe ser accesible mediante teclado.

Implementación en ChatWindow.tsx (accesibilidad del área de texto):

tsx
<textarea
  aria-label="Escribe tu mensaje"
  onKeyDown={(e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }}
  // ✅ Enter envía, Shift+Enter nueva línea – accesible y esperado
/>
Botón de enviar:

tsx
<button onClick={sendMessage} aria-label="Enviar mensaje">
  <SendIcon aria-hidden="true" />
  <span className="sr-only">Enviar</span> {/* texto oculto visualmente pero legible para AT */}
</button>
Navegación por teclado en el mapa:

Los marcadores deben ser focusables con tabindex="0" y responder a Enter.

El mapa debe tener un role="application" o aria-label="Mapa de tareas".

WCAG 2.4.1 — Bypass Blocks (Nivel A)
¿Qué? Debe existir un mecanismo para saltar bloques repetitivos (nav, header).

Implementación con <main> y links de salto:

tsx
// En AppLayout.tsx
<a href="#main-content" className="sr-only focus:not-sr-only">
  Saltar al contenido principal
</a>
<nav aria-label="Navegación principal">...</nav>
<main id="main-content" tabindex="-1">
  {/* contenido de la página */}
</main>
WCAG 4.1.2 — Name, Role, Value (Nivel A)
¿Qué? El nombre, rol y valor de los componentes de UI deben poder determinarse programáticamente.

Ejemplo en NotificationBell.tsx (campana con notificaciones no leídas):

tsx
<button
  aria-label={`Notificaciones ${unreadCount} sin leer`}
  aria-expanded={isOpen}
  aria-haspopup="dialog"
  onClick={toggleDropdown}
>
  <BellIcon aria-hidden="true" />
  {unreadCount > 0 && (
    <span className="sr-only">{unreadCount} notificaciones sin leer</span>
  )}
</button>
Ejemplo en AdminTable.tsx (acción "Eliminar técnico"):

tsx
<button
  aria-label={`Eliminar técnico ${tecnico.nombre}`}
  onClick={() => confirmDelete(tecnico.id)}
>
  <TrashIcon aria-hidden="true" />
  <span className="sr-only">Eliminar</span>
</button>
WCAG 4.1.3 — Status Messages (Nivel AA)
¿Qué? Los mensajes de estado (errores, cargas, confirmaciones) deben anunciarse a tecnologías asistivas sin mover el foco.

Ejemplo en PaymentCheckout.tsx (pago exitoso):

tsx
{paymentSuccess && (
  <div
    role="status"
    aria-live="polite"
    className="bg-green-100 text-green-800 p-4 rounded"
  >
    <p>¡Pago completado! Tu comprobante se envió a tu correo.</p>
  </div>
)}
Ejemplo en BookingForm.tsx (error de validación):

tsx
{error && (
  <div role="alert" aria-live="assertive" className="text-red-600 text-sm mt-1">
    {error}
  </div>
)}
Diferencia entre aria-live:

Valor	Comportamiento	Cuándo usar
polite	Espera a que termine la lectura actual	Mensajes informativos (éxito, actualización)
assertive	Interrumpe inmediatamente	Errores críticos (solo si es urgente)
WCAG 1.4.10 — Reflow (Nivel AA)
¿Qué? El contenido debe ser legible sin desplazamiento horizontal hasta un ancho equivalente a 320px (zoom 400%).

Implementación en Neodomus:

Uso de CSS Grid y Flexbox responsivo.

Medios queries: @media (max-width: 640px) { ... }

Las tablas en móvil se transforman en cards (patrón de responsividad).

Meta viewport: <meta name="viewport" content="width=device-width, initial-scale=1">.

Patrones ARIA específicos de Neodomus
Mapa de tareas (TechTaskMap.tsx)
tsx
<div
  role="application"
  aria-label="Mapa de tareas del técnico. Los marcadores representan citas o entregas."
>
  {/* marcadores con roles de enlaces o botones */}
  <button
    tabindex="0"
    aria-label={`Tarea: ${task.type} en ${task.address}`}
    onClick={() => showTaskDetails(task)}
  >
    {/* marcador renderizado */}
  </button>
</div>
Calificación con estrellas (RatingStars.tsx)
tsx
<div
  role="radiogroup"
  aria-label="Calificación del servicio"
>
  {[1,2,3,4,5].map(star => (
    <button
      key={star}
      role="radio"
      aria-checked={rating === star}
      aria-label={`${star} estrella${star !== 1 ? 's' : ''}`}
      onClick={() => setRating(star)}
    >
      ★
    </button>
  ))}
</div>
Ventana de chat con actualizaciones en vivo
tsx
<div
  role="log"
  aria-live="polite"
  aria-label="Historial de mensajes del chat"
  className="h-96 overflow-y-auto"
>
  {messages.map(msg => (
    <div key={msg.id} className="mb-2">
      <span className="font-bold">{msg.sender}:</span> {msg.text}
    </div>
  ))}
</div>
Progreso de carga de lista de técnicos
tsx
{isLoading && (
  <div
    role="progressbar"
    aria-label="Cargando lista de técnicos"
    aria-valuetext="Por favor espera"
    aria-busy="true"
  >
    <Spinner aria-hidden="true" />
    <span className="sr-only">Cargando técnicos disponibles...</span>
  </div>
)}
Checklist de Accesibilidad para Pull Requests (Neodomus)
Antes de fusionar cualquier PR con cambios de UI:

¿Todos los <img> tienen alt? (vacío alt="" para decorativas)

¿Todos los iconos decorativos tienen aria-hidden="true"?

¿Todos los botones con solo ícono tienen aria-label?

¿Todos los <input> tienen <label> asociada con htmlFor o aria-label?

¿Los mensajes de error usan role="alert" o aria-live="assertive"?

¿Los mensajes de éxito o carga usan role="status" o aria-live="polite"?

¿Los landmarks semánticos (<main>, <nav>, <header>) están presentes?

¿Las regiones con múltiples <nav> tienen aria-label únicos?

¿El color no es el único indicador de información? (ej. gráficas, estados)

¿La jerarquía de encabezados es lógica (<h1> → <h2> → <h3>)?

¿Los botones de alternancia (toggles) tienen aria-pressed o aria-checked?

¿Se puede acceder a todas las funciones solo con teclado (Tab, Enter, flechas)?

¿El mapa de técnicos es operable por teclado?

¿Las notificaciones de campana se anuncian con aria-live al aparecer?

¿El contraste de colores cumple 4.5:1 (texto normal) y 3:1 (componentes)?

Herramientas de Testing de Accesibilidad para Neodomus
Automáticas (integradas en CI)
json
// .github/workflows/accessibility.yml
- name: Run axe-core
  run: npx @axe-core/cli http://localhost:3000 --exit
Herramienta	Uso en Neodomus
axe DevTools	Extension para Chrome, prueba manual rápida
Lighthouse	CI o DevTools – genera score de accesibilidad
jest-axe	Tests unitarios de componentes React
Manuales (imprescindibles)
bash
# Test de teclado en todos los flujos clave:
# - Registro y login
# - Búsqueda y solicitud de servicio
# - Pago
# - Chat
# - Panel de técnico (mapa, cambio de estado)
# - Panel de administrador (tablas, asignaciones)

# Test con lector de pantalla (macOS: VoiceOver, Cmd+F5)
# Test con lector de pantalla (Windows: NVDA, Control+Alt+N)
Verificación de contraste
Colores corporativos: Negro #000000, Dorado #D4AF37, Blanco #FFFFFF.

Fondo blanco, texto negro → 21:1 ✅ AAA

Fondo negro, texto dorado #D4AF37 → 7.8:1 ✅ AAA

Dorado sobre gris claro (#F5F5F5) → 2.8:1 ❌ (no usar)

Recursos de Aprendizaje
Recurso	URL	Para qué
WCAG 2.1 Quick Reference	https://www.w3.org/WAI/WCAG21/quickref/	Criterios filtrables por nivel
WAI-ARIA Authoring Practices	https://www.w3.org/WAI/ARIA/apg/	Patrones de diseño accesible con ejemplos
A11y Project Checklist	https://www.a11yproject.com/checklist/	Checklist práctica
MDN ARIA	https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA	Referencia completa
Testing Library queries	https://testing-library.com/docs/queries/about	getByRole, getByLabelText
