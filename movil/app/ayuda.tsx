// ─────────────────────────────────────────────────────────────
// /ayuda — ruta apilada en el Stack RAÍZ.
//
// Existe para que la navegación programática a Ayuda (footer,
// enlaces) conserve el historial real: Productos → Ayuda → Atrás →
// Productos. Renderiza exactamente la MISMA pantalla que el tab
// (PantallaAyuda), sin duplicar implementación.
// ─────────────────────────────────────────────────────────────

export { default } from "@/components/public/PantallaAyuda";
